import type { MusicEntity, MusicEntityType } from "../music-types";
import {
  assertSpotifyEntityId,
  getSpotifyEntity,
  searchSpotifyEntity,
  spotifyEntityTypeToMusicEntityType,
} from "./spotify";
import {
  assertTidalEntityId,
  getTidalEntity,
  searchTidalEntity,
  tidalShareUrlTypeToEntityType,
} from "./tidal";
import { ValidationError } from "../utils/errors";

export interface ParsedUrl {
  service: "spotify" | "tidal";
  type: MusicEntityType;
  id: string;
}

export interface ConversionResult {
  fromUrl: ParsedUrl | null;
  toService: "spotify" | "tidal" | null;
  fromEntity: MusicEntity | null;
  toEntity: MusicEntity | null;
  error: Error | null;
}

async function getUrlData(urlParameter: string | null): Promise<ParsedUrl> {
  try {
    if (!urlParameter) {
      throw new ValidationError("No URL provided");
    }

    const { protocol, hostname, pathname } = new URL(urlParameter);

    if (protocol === "spotify:") {
      const [type, id] = pathname.split(":");
      assertSpotifyEntityId(id);
      return {
        service: "spotify",
        type: spotifyEntityTypeToMusicEntityType(type),
        id,
      };
    } else if (protocol === "tidal:") {
      const type = tidalShareUrlTypeToEntityType(hostname);
      const id = pathname.slice(1);
      assertTidalEntityId(id);
      return { service: "tidal", type, id };
    } else if (protocol === "https:" || protocol === "http:") {
      if (hostname === "open.spotify.com") {
        const pathParts = pathname.split("/").filter((part) => part.length > 0);
        if (pathParts.length < 2) {
          throw new ValidationError("Invalid Spotify URL format");
        }
        const type = spotifyEntityTypeToMusicEntityType(pathParts.at(-2)!);
        const id = pathParts.at(-1)!;
        assertSpotifyEntityId(id);
        return { service: "spotify", type, id };
      } else if (hostname === "tidal.com") {
        const match = pathname.match(
          /\/(?<type>track|album|artist)\/(?<id>\d+)(?:\/|$)/,
        );

        if (!match) {
          throw new ValidationError("Invalid Tidal URL format");
        }

        const type = tidalShareUrlTypeToEntityType(match.groups!.type);
        const id = match.groups!.id;
        return { service: "tidal", type, id };
      }
    }

    throw new ValidationError("Unsupported URL format");
  } catch (err) {
    if (err instanceof ValidationError) {
      throw err;
    }

    throw new ValidationError("Invalid URL format");
  }
}

export async function convertMusicLink(
  urlParameter: string | null,
  country?: string,
): Promise<ConversionResult> {
  let fromUrl: ParsedUrl | null = null;
  let toService: "spotify" | "tidal" | null = null;
  let fromEntity: MusicEntity | null = null;
  let toEntity: MusicEntity | null = null;
  let error: Error | null = null;

  try {
    fromUrl = await getUrlData(urlParameter);
    toService = fromUrl.service === "spotify" ? "tidal" : "spotify";

    fromEntity =
      fromUrl.service === "tidal"
        ? await getTidalEntity(fromUrl.type, fromUrl.id, country)
        : await getSpotifyEntity(fromUrl.type, fromUrl.id, country);

    if (fromEntity) {
      const query = createQuery(fromEntity, toService);

      toEntity =
        fromUrl.service === "tidal"
          ? await searchSpotifyEntity(fromUrl.type, query, country)
          : await searchTidalEntity(fromUrl.type, query, country);
    }
  } catch (err) {
    error = err as Error;
    console.error(err);
  }

  return {
    fromUrl,
    toService,
    fromEntity,
    toEntity,
    error,
  };
}

function createQuery(entity: MusicEntity, service: "spotify" | "tidal") {
  if (
    service === "spotify" &&
    entity.type !== "artist" &&
    entity.artists.length === 1
  ) {
    return `${entity.artists.map((artist) => `artist:"${artist.name}"`).join(" ")} ${entity.name}`;
  }

  return entity.type === "artist"
    ? entity.name
    : `${entity.artists.map((artist) => artist.name).join(" ")} ${entity.name}`;
}
