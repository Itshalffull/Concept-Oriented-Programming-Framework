// generated: mediaasset.types.ts

export interface MediaAssetCreateMediaInput {
  asset: string;
  source: string;
  file: string;
}

export type MediaAssetCreateMediaOutput =
  { variant: "ok"; asset: string }
  | { variant: "error"; message: string };

export interface MediaAssetExtractMetadataInput {
  asset: string;
}

export type MediaAssetExtractMetadataOutput =
  { variant: "ok"; metadata: string }
  | { variant: "notfound"; message: string };

export interface MediaAssetGenerateThumbnailInput {
  asset: string;
}

export type MediaAssetGenerateThumbnailOutput =
  { variant: "ok"; thumbnail: string }
  | { variant: "notfound"; message: string };

export interface MediaAssetGetMediaInput {
  asset: string;
}

export type MediaAssetGetMediaOutput =
  { variant: "ok"; asset: string; metadata: string; thumbnail: string }
  | { variant: "notfound"; message: string };

