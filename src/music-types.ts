export type MusicEntityType = "album" | "artist" | "song";

export type MusicEntity = Album | Artist | Song;

interface BaseMusicEntity {
  type: MusicEntityType;
  name: string;
  url: string;
  images: Image[];
}

export interface Album extends BaseMusicEntity {
  type: "album";
  releaseDate: string;
  artists: string[];
}

export interface Artist extends BaseMusicEntity {
  type: "artist";
}

export interface Song extends BaseMusicEntity {
  type: "song";
  durationSeconds: number;
  isrc: string;
  artists: string[];
  album: {
    name: string;
    url: string;
  };
}

export interface Image {
  url: string;
  width: number;
  height: number;
}
