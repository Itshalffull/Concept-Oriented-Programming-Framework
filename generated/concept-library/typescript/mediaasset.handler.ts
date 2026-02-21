// generated: mediaasset.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./mediaasset.types";

export interface MediaAssetHandler {
  createMedia(input: T.MediaAssetCreateMediaInput, storage: ConceptStorage):
    Promise<T.MediaAssetCreateMediaOutput>;
  extractMetadata(input: T.MediaAssetExtractMetadataInput, storage: ConceptStorage):
    Promise<T.MediaAssetExtractMetadataOutput>;
  generateThumbnail(input: T.MediaAssetGenerateThumbnailInput, storage: ConceptStorage):
    Promise<T.MediaAssetGenerateThumbnailOutput>;
  getMedia(input: T.MediaAssetGetMediaInput, storage: ConceptStorage):
    Promise<T.MediaAssetGetMediaOutput>;
}
