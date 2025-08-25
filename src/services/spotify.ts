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
import { formatDuration } from "../utils/format";

type SpotifyEntityType = "album" | "artist" | "track";

class SpotifyClient {
  private client: OAuth2Client;
  private token: OAuth2Token | null = null;

  constructor() {
    this.client = new OAuth2Client({
      server: "https://accounts.spotify.com",
      clientId: import.meta.env.SPOTIFY_CLIENT_ID,
      clientSecret: import.meta.env.SPOTIFY_CLIENT_SECRET,
      tokenEndpoint: "/api/token",
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

const client = new SpotifyClient();

async function spotifyFetch<T extends z.Schema>(
  path: string,
  schema: T,
): Promise<z.infer<T>> {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${await client.getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new APIError(
      `Spotify API request failed with status: ${response.status}`,
      response.status,
    );
  }

  const rawData = await response.json();
  return schema.parse(rawData);
}

const SpotifyAlbumSchema = z.object({
  id: z.string(),
  name: z.string(),
  release_date: z.string(),
  images: z.array(
    z.object({
      url: z.string(),
      width: z.number(),
      height: z.number(),
    }),
  ),
  artists: z.array(
    z.object({
      name: z.string(),
    }),
  ),
  type: z.literal("album"),
});

const SpotifyArtistSchema = z.object({
  id: z.string(),
  images: z.array(
    z.object({
      url: z.string(),
      width: z.number(),
      height: z.number(),
    }),
  ),
  name: z.string(),
  type: z.literal("artist"),
});

const SpotifyTrackSchema = z.object({
  album: SpotifyAlbumSchema,
  artists: z.array(
    z.object({
      name: z.string(),
    }),
  ),
  duration_ms: z.number(),
  external_ids: z.object({
    isrc: z.string(),
  }),
  id: z.string(),
  name: z.string(),
  type: z.literal("track"),
});

const SpotifyAlbumSearchSchema = z.object({
  albums: z.object({
    items: z.array(SpotifyAlbumSchema),
  }),
});
const SpotifyArtistSearchSchema = z.object({
  artists: z.object({
    items: z.array(SpotifyArtistSchema),
  }),
});
const SpotifyTrackSearchSchema = z.object({
  tracks: z.object({
    items: z.array(SpotifyTrackSchema),
  }),
});

function spotifyAlbumToAlbum(album: z.infer<typeof SpotifyAlbumSchema>): Album {
  return {
    type: "album",
    name: album.name,
    releaseDate: album.release_date,
    url: `https://open.spotify.com/album/${album.id}`,
    artists: album.artists.map((artist) => ({
      name: artist.name,
      url: `https://open.spotify.com/artist/${artist.id}`,
    })),
    images: album.images,
  };
}

function spotifyArtistToArtist(
  artist: z.infer<typeof SpotifyArtistSchema>,
): Artist {
  return {
    type: "artist",
    name: artist.name,
    url: `https://open.spotify.com/artist/${artist.id}`,
    images: artist.images,
  };
}

function spotifyTrackToSong(track: z.infer<typeof SpotifyTrackSchema>): Song {
  return {
    type: "song",
    name: track.name,
    url: `https://open.spotify.com/track/${track.id}`,
    durationSeconds: track.duration_ms / 1000,
    durationFormatted: formatDuration(track.duration_ms / 1000),
    images: track.album.images,
    isrc: track.external_ids.isrc,
    artists: track.artists.map((artist) => ({
      name: artist.name,
      url: `https://open.spotify.com/artist/${artist.id}`,
    })),
    album: {
      name: track.album.name,
      url: `https://open.spotify.com/album/${track.album.id}`,
    },
  };
}

async function getAlbum(id: string, countryCode: string): Promise<Album> {
  const response = await spotifyFetch(
    `/albums/${encodeURIComponent(id)}?market=${countryCode}`,
    SpotifyAlbumSchema,
  );
  return spotifyAlbumToAlbum(response);
}

async function getArtist(id: string): Promise<Artist> {
  const response = await spotifyFetch(
    `/artists/${encodeURIComponent(id)}`,
    SpotifyArtistSchema,
  );
  return spotifyArtistToArtist(response);
}

async function getSong(id: string, countryCode: string): Promise<Song> {
  const response = await spotifyFetch(
    `/tracks/${encodeURIComponent(id)}?market=${countryCode}`,
    SpotifyTrackSchema,
  );
  return spotifyTrackToSong(response);
}

export async function getSpotifyEntity(
  type: MusicEntityType,
  id: string,
  countryCode: string | undefined = "FI",
) {
  switch (type) {
    case "album":
      return getAlbum(id, countryCode);
    case "artist":
      return getArtist(id);
    case "song":
      return getSong(id, countryCode);
  }
}

export async function searchSpotifyEntity(
  type: MusicEntityType,
  query: string,
  countryCode: string | undefined = "FI",
): Promise<MusicEntity | null> {
  const spotifyType = mapEntityTypeToSpotifyType(type);
  const normalizedQuery = normalizeQuery(query);
  const schema = (() => {
    switch (type) {
      case "album":
        return SpotifyAlbumSearchSchema;
      case "artist":
        return SpotifyArtistSearchSchema;
      case "song":
        return SpotifyTrackSearchSchema;
      default:
        throw new Error(`Unsupported Spotify entity type: ${type}`);
    }
  })();

  const response = await spotifyFetch(
    `/search?q=${encodeURIComponent(normalizedQuery)}&type=${spotifyType}&market=${countryCode}&limit=1`,
    schema,
  );

  switch (type) {
    case "album": {
      const firstResult = (response as z.infer<typeof SpotifyAlbumSearchSchema>)
        .albums.items[0];
      return firstResult ? spotifyAlbumToAlbum(firstResult) : null;
    }
    case "artist": {
      const firstResult = (
        response as z.infer<typeof SpotifyArtistSearchSchema>
      ).artists.items[0];
      return firstResult ? spotifyArtistToArtist(firstResult) : null;
    }
    case "song": {
      const firstResult = (response as z.infer<typeof SpotifyTrackSearchSchema>)
        .tracks.items[0];
      return firstResult ? spotifyTrackToSong(firstResult) : null;
    }
  }
}

function mapEntityTypeToSpotifyType(type: MusicEntityType): SpotifyEntityType {
  switch (type) {
    case "album":
      return "album";
    case "artist":
      return "artist";
    case "song":
      return "track";
    default:
      throw new Error(`Unsupported Spotify entity type: ${type}`);
  }
}

export function spotifyEntityTypeToMusicEntityType(
  type: string,
): MusicEntityType {
  switch (type) {
    case "album":
      return "album";
    case "artist":
      return "artist";
    case "track":
      return "song";
    default:
      throw new Error(`Unsupported Spotify entity type: ${type}`);
  }
}

function normalizeQuery(query: string) {
  return query
    .normalize("NFKC")
    .replace(/\p{C}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function assertSpotifyEntityId(id: string | undefined): void {
  if (!id || !/^[a-zA-Z0-9]+$/.test(id)) {
    throw new Error(`Invalid Spotify entity ID: ${id}`);
  }
}
