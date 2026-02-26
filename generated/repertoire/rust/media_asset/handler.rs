// generated: media_asset/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait MediaAssetHandler: Send + Sync {
    async fn create_media(
        &self,
        input: MediaAssetCreateMediaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MediaAssetCreateMediaOutput, Box<dyn std::error::Error>>;

    async fn extract_metadata(
        &self,
        input: MediaAssetExtractMetadataInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MediaAssetExtractMetadataOutput, Box<dyn std::error::Error>>;

    async fn generate_thumbnail(
        &self,
        input: MediaAssetGenerateThumbnailInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MediaAssetGenerateThumbnailOutput, Box<dyn std::error::Error>>;

    async fn get_media(
        &self,
        input: MediaAssetGetMediaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MediaAssetGetMediaOutput, Box<dyn std::error::Error>>;

}
