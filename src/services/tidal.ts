import { OAuth2Client, type OAuth2Token } from "@badgateway/oauth2-client";
import { z } from "astro:schema";
import type {
  Album,
  Artist,
  MusicEntity,
  MusicEntityType,
  Song,
} from "../music-types";
import { APIError } from "../utils/errors";
import { Temporal } from "@js-temporal/polyfill";

class TidalClient {
  private client: OAuth2Client;
  private token: OAuth2Token | null = null;

  constructor() {
    if (
      !import.meta.env.TIDAL_CLIENT_ID ||
      !import.meta.env.TIDAL_CLIENT_SECRET
    ) {
      throw new Error("TIDAL_CLIENT_ID and TIDAL_CLIENT_SECRET must be set");
    }

    this.client = new OAuth2Client({
      server: "https://auth.tidal.com/v1",
      clientId: import.meta.env.TIDAL_CLIENT_ID,
      clientSecret: import.meta.env.TIDAL_CLIENT_SECRET,
      tokenEndpoint: "/v1/oauth2/token",
    });
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    const expiresAt = this.token?.expiresAt ?? 0;

    if (!this.token || expiresAt <= now) {
      this.token = await this.client.clientCredentials();
    }

    return this.token.accessToken;
  }
}

const client = new TidalClient();

async function tidalFetch<T extends z.Schema>(
  path: string,
  schema: T,
): Promise<z.infer<T>> {
  const response = await fetch(`https://openapi.tidal.com/v2${path}`, {
    headers: {
      Authorization: `Bearer ${await client.getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new APIError(
      `Tidal API request failed with status: ${response.status}`,
      response.status,
    );
  }

  const rawData = await response.json();
  return schema.parse(rawData);
}

type TidalEntityType = "tracks" | "albums" | "artists";

const TidalArtworkSchema = z.object({
  id: z.string(),
  type: z.literal("artworks"),
  attributes: z.object({
    mediaType: z.literal("IMAGE"),
    files: z.array(
      z.object({
        href: z.string().url(),
        meta: z.object({
          width: z.number(),
          height: z.number(),
        }),
      }),
    ),
  }),
});

const TidalArtworkResponseSchema = z.object({
  included: z.array(TidalArtworkSchema).optional(),
});

const TidalArtistSchema = z.object({
  id: z.string(),
  type: z.literal("artists"),
  attributes: z.object({
    name: z.string(),
  }),
});

const TidalArtistResponseSchema = z.object({
  data: TidalArtistSchema,
  included: z.array(TidalArtworkSchema).optional(),
});

const TidalAlbumSchema = z.object({
  id: z.string(),
  type: z.literal("albums"),
  attributes: z.object({
    title: z.string(),
    releaseDate: z.string(),
  }),
  relationships: z.object({
    artists: z.object({
      data: z.array(
        z.object({
          id: z.string(),
          type: z.literal("artists"),
        }),
      ),
    }),
  }),
});

const SimpleAlbumSchema = TidalAlbumSchema.omit({
  relationships: true,
});

const TidalAlbumResponseSchema = z.object({
  data: TidalAlbumSchema,
  included: z
    .array(z.union([TidalArtistSchema, TidalArtworkSchema]))
    .optional(),
});

const TidalTrackSchema = z.object({
  id: z.string(),
  type: z.literal("tracks"),
  attributes: z.object({
    title: z.string(),
    isrc: z.string(),
    duration: z.string(),
  }),
  relationships: z.object({
    artists: z.object({
      data: z.array(
        z.object({
          id: z.string(),
          type: z.literal("artists"),
        }),
      ),
    }),
    albums: z.object({
      data: z.array(
        z.object({
          id: z.string(),
          type: z.literal("albums"),
        }),
      ),
    }),
  }),
});

const TidalTrackResponseSchema = z.object({
  data: TidalTrackSchema,
  included: z.array(z.union([TidalArtistSchema, SimpleAlbumSchema])),
});

const TidalSearchResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["tracks", "albums", "artists"]),
    }),
  ),
});

async function getAlbum(id: string, countryCode: string): Promise<Album> {
  const { data, included = [] } = await tidalFetch(
    `/albums/${encodeURIComponent(id)}?countryCode=${countryCode}&include=artists,coverArt`,
    TidalAlbumResponseSchema,
  );

  const artists = included
    .filter((item) => item.type === "artists")
    .map((item) => item.attributes.name);

  const images = included
    .filter((item) => item.type === "artworks")
    .flatMap((item) =>
      item.attributes.files.map((file) => ({
        url: file.href,
        width: file.meta.width,
        height: file.meta.height,
      })),
    );

  return {
    type: "album",
    name: data.attributes.title,
    releaseDate: data.attributes.releaseDate,
    url: `https://tidal.com/browse/album/${id}`,
    artists,
    images,
  };
}

async function getArtist(id: string, countryCode: string): Promise<Artist> {
  const { data, included = [] } = await tidalFetch(
    `/artists/${encodeURIComponent(id)}?countryCode=${countryCode}&include=profileArt`,
    TidalArtistResponseSchema,
  );

  const images = included.flatMap((item) =>
    item.attributes.files.map((file) => ({
      url: file.href,
      width: file.meta.width,
      height: file.meta.height,
    })),
  );

  return {
    type: "artist",
    name: data.attributes.name,
    url: `https://tidal.com/browse/artist/${id}`,
    images,
  };
}

async function getSong(id: string, countryCode: string): Promise<Song> {
  const { data, included } = await tidalFetch(
    `/tracks/${encodeURIComponent(id)}?countryCode=${countryCode}&include=albums,artists`,
    TidalTrackResponseSchema,
  );

  const durationSeconds = Temporal.Duration.from(
    data.attributes.duration,
  ).total("seconds");

  const albumId = data.relationships.albums.data[0].id;

  const { included: albumArtwork = [] } = await tidalFetch(
    `/albums/${encodeURIComponent(albumId)}/relationships/coverArt?countryCode=${countryCode}&include=coverArt`,
    TidalArtworkResponseSchema,
  );

  const albumTitle = included.find((item) => item.type === "albums")!.attributes
    .title!;

  const artists = data.relationships.artists.data
    .map((item) => included.find((artist) => artist.id === item.id)!)
    .filter((item) => item.type === "artists")
    .map((artist) => artist.attributes.name);

  const images = albumArtwork.flatMap((item) =>
    item.attributes.files.map((file) => ({
      url: file.href,
      width: file.meta.width,
      height: file.meta.height,
    })),
  );

  return {
    type: "song",
    name: data.attributes.title,
    url: `https://tidal.com/browse/track/${id}`,
    durationSeconds,
    isrc: data.attributes.isrc,
    artists,
    album: {
      name: albumTitle,
      url: `https://tidal.com/browse/album/${albumId}`,
    },
    images,
  };
}

export async function getTidalEntity(
  type: MusicEntityType,
  id: string,
  countryCode: string | undefined = "FI",
) {
  switch (type) {
    case "album":
      return getAlbum(id, countryCode);
    case "artist":
      return getArtist(id, countryCode);
    case "song":
      return getSong(id, countryCode);
    default:
      throw new Error(`Unsupported Tidal entity type: ${type}`);
  }
}

export async function searchTidalEntity(
  type: MusicEntityType,
  query: string,
  countryCode: string | undefined = "FI",
): Promise<MusicEntity | null> {
  const tidalType = mapEntityTypeToTidalType(type);
  const normalizedQuery = normalizeQuery(query);

  const { data: searchResults } = await tidalFetch(
    `/searchResults/${encodeURIComponent(normalizedQuery)}/relationships/${tidalType}?countryCode=${countryCode}`,
    TidalSearchResponseSchema,
  );
  const [firstResult] = searchResults;

  return firstResult ? getTidalEntity(type, firstResult.id, countryCode) : null;
}

function mapEntityTypeToTidalType(type: MusicEntityType): TidalEntityType {
  switch (type) {
    case "album":
      return "albums";
    case "artist":
      return "artists";
    case "song":
      return "tracks";
  }
}

function normalizeQuery(input: string) {
  return input
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tidalShareUrlTypeToEntityType(type: string): MusicEntityType {
  switch (type) {
    case "track":
      return "song";
    case "album":
      return "album";
    case "artist":
      return "artist";
    default:
      throw new Error(`Unsupported Tidal share URL type: ${type}`);
  }
}

export function assertTidalEntityId(id: string | undefined): void {
  if (!id || !/^\d+$/.test(id)) {
    throw new Error(`Invalid Tidal entity ID: ${id}`);
  }
}
