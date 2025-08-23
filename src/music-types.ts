export type MusicEntityType = "album" | "artist" | "song";

export type MusicEntity = Album | Artist | Song;

interface BaseMusicEntity {
  type: MusicEntityType;
  name: string;
  url: string;
}

export interface Album extends BaseMusicEntity {
  type: "album";
  releaseDate: string;
  images: Image[];
  artists: string[];
}

export interface Artist extends BaseMusicEntity {
  type: "artist";
}

export interface Song extends BaseMusicEntity {
  type: "song";
  duration: string;
  isrc: string;
  artists: string[];
}

export interface Image {
  url: string;
  width: number;
  height: number;
}
