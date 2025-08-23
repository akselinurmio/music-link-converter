import { OAuth2Client, type OAuth2Token } from "@badgateway/oauth2-client";
import { z } from "astro:schema";
import type {
  Album,
  Artist,
  MusicEntity,
  MusicEntityType,
  Song,
} from "../music-types";

type TidalEntityType = "tracks" | "albums" | "artists";

const TidalArtistSchema = z.object({
  id: z.string(),
  type: z.literal("artists"),
  attributes: z.object({
    name: z.string(),
  }),
});

const TidalArtistResponseSchema = z.object({
  data: TidalArtistSchema,
});

const TidalTrackSchema = z.object({
  id: z.string(),
  type: z.literal("tracks"),
  attributes: z.object({
    title: z.string(),
    isrc: z.string(),
    duration: z.string(),
  }),
});

const TidalTrackResponseSchema = z.object({
  data: TidalTrackSchema,
  included: z.array(TidalArtistSchema),
});

const TidalAlbumSchema = z.object({
  id: z.string(),
  type: z.literal("albums"),
  attributes: z.object({
    title: z.string(),
    releaseDate: z.string().date(),
  }),
});

const TidalCoverArtSchema = z.object({
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

const TidalAlbumResponseSchema = z.object({
  data: TidalAlbumSchema,
  included: z.array(z.union([TidalArtistSchema, TidalCoverArtSchema])),
});

const TidalSearchResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["tracks", "albums", "artists"]),
    }),
  ),
});

class TidalClient {
  private client: OAuth2Client;
  private token: OAuth2Token | null = null;

  constructor() {
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

async function getAlbum(id: string, countryCode: string): Promise<Album> {
  const { data, included } = await tidalFetch(
    `/albums/${encodeURIComponent(id)}?countryCode=${encodeURIComponent(countryCode)}&include=artists,coverArt`,
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
    url: generateTidalUrl("albums", id),
    artists,
    images,
  };
}

async function getArtist(id: string, countryCode: string): Promise<Artist> {
  const { data } = await tidalFetch(
    `/artists/${encodeURIComponent(id)}?countryCode=${encodeURIComponent(countryCode)}`,
    TidalArtistResponseSchema,
  );

  return {
    type: "artist",
    name: data.attributes.name,
    url: generateTidalUrl("artists", id),
  };
}

async function getSong(id: string, countryCode: string): Promise<Song> {
  const { data, included } = await tidalFetch(
    `/tracks/${encodeURIComponent(id)}?countryCode=${encodeURIComponent(countryCode)}&include=artists`,
    TidalTrackResponseSchema,
  );

  const artists = included
    .filter((item) => item.type === "artists")
    .map((item) => item.attributes.name);

  return {
    type: "song",
    name: data.attributes.title,
    url: generateTidalUrl("tracks", id),
    duration: data.attributes.duration,
    isrc: data.attributes.isrc,
    artists,
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
    `/searchResults/${encodeURIComponent(normalizedQuery)}/relationships/${tidalType}?countryCode=${encodeURIComponent(countryCode)}`,
    TidalSearchResponseSchema,
  );
  const [firstResult] = searchResults;

  return firstResult ? getTidalEntity(type, firstResult.id, countryCode) : null;
}

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
    throw new Error(`Tidal API request failed with status: ${response.status}`);
  }

  const rawData = await response.json();
  return schema.parse(rawData);
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
    .normalize("NFKC")
    .replace(/\p{C}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function generateTidalUrl(type: TidalEntityType, id: string): string {
  const singularType = type.slice(0, -1); // Remove 's' from plural types
  return `https://tidal.com/browse/${singularType}/${id}`;
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

export function assertTidalEntityId(id: string): void {
  if (!/^\d+$/.test(id)) {
    throw new Error(`Invalid Tidal entity ID: ${id}`);
  }
}
