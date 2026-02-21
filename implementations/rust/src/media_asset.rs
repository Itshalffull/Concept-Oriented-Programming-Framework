// MediaAsset Concept Implementation (Rust)
//
// Media kit — creates media records with type/source/metadata,
// extracts metadata from stored media, and generates thumbnail URIs.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── CreateMedia ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaAssetCreateMediaInput {
    pub media_type: String,
    pub source: String,
    pub metadata: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MediaAssetCreateMediaOutput {
    #[serde(rename = "ok")]
    Ok { media_id: String },
}

// ── ExtractMetadata ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaAssetExtractMetadataInput {
    pub media_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MediaAssetExtractMetadataOutput {
    #[serde(rename = "ok")]
    Ok { media_id: String, metadata: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── GenerateThumbnail ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaAssetGenerateThumbnailInput {
    pub media_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MediaAssetGenerateThumbnailOutput {
    #[serde(rename = "ok")]
    Ok {
        media_id: String,
        thumbnail_uri: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct MediaAssetHandler;

impl MediaAssetHandler {
    pub async fn create_media(
        &self,
        input: MediaAssetCreateMediaInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<MediaAssetCreateMediaOutput> {
        let media_id = format!("media_{}", rand::random::<u32>());
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "media",
                &media_id,
                json!({
                    "media_id": media_id,
                    "media_type": input.media_type,
                    "source": input.source,
                    "metadata": input.metadata,
                    "created_at": now,
                }),
            )
            .await?;
        Ok(MediaAssetCreateMediaOutput::Ok { media_id })
    }

    pub async fn extract_metadata(
        &self,
        input: MediaAssetExtractMetadataInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<MediaAssetExtractMetadataOutput> {
        let existing = storage.get("media", &input.media_id).await?;
        match existing {
            None => Ok(MediaAssetExtractMetadataOutput::NotFound {
                message: format!("media '{}' not found", input.media_id),
            }),
            Some(record) => {
                let metadata = record["metadata"]
                    .as_str()
                    .unwrap_or("{}")
                    .to_string();
                Ok(MediaAssetExtractMetadataOutput::Ok {
                    media_id: input.media_id,
                    metadata,
                })
            }
        }
    }

    pub async fn generate_thumbnail(
        &self,
        input: MediaAssetGenerateThumbnailInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<MediaAssetGenerateThumbnailOutput> {
        let existing = storage.get("media", &input.media_id).await?;
        match existing {
            None => Ok(MediaAssetGenerateThumbnailOutput::NotFound {
                message: format!("media '{}' not found", input.media_id),
            }),
            Some(record) => {
                let source = record["source"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let thumbnail_uri = format!("/thumbnails/{}/{}", input.media_id, source);

                // Store the thumbnail URI back on the media record
                let mut updated = record.clone();
                updated["thumbnail_uri"] = json!(thumbnail_uri);
                storage.put("media", &input.media_id, updated).await?;

                Ok(MediaAssetGenerateThumbnailOutput::Ok {
                    media_id: input.media_id,
                    thumbnail_uri,
                })
            }
        }
    }
}
