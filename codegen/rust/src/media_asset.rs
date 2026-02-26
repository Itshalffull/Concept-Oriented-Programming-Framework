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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn create_media() {
        let storage = InMemoryStorage::new();
        let handler = MediaAssetHandler;
        let result = handler
            .create_media(
                MediaAssetCreateMediaInput {
                    media_type: "image".into(),
                    source: "photo.jpg".into(),
                    metadata: r#"{"width": 800, "height": 600}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            MediaAssetCreateMediaOutput::Ok { media_id } => {
                assert!(media_id.starts_with("media_"));
            }
        }
    }

    #[tokio::test]
    async fn extract_metadata_existing() {
        let storage = InMemoryStorage::new();
        let handler = MediaAssetHandler;
        let create_result = handler
            .create_media(
                MediaAssetCreateMediaInput {
                    media_type: "image".into(),
                    source: "photo.jpg".into(),
                    metadata: r#"{"width": 1920}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();
        let media_id = match create_result {
            MediaAssetCreateMediaOutput::Ok { media_id } => media_id,
        };

        let result = handler
            .extract_metadata(
                MediaAssetExtractMetadataInput { media_id: media_id.clone() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            MediaAssetExtractMetadataOutput::Ok { media_id: mid, metadata } => {
                assert_eq!(mid, media_id);
                assert!(metadata.contains("1920"));
            }
            MediaAssetExtractMetadataOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn extract_metadata_not_found() {
        let storage = InMemoryStorage::new();
        let handler = MediaAssetHandler;
        let result = handler
            .extract_metadata(
                MediaAssetExtractMetadataInput { media_id: "missing".into() },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, MediaAssetExtractMetadataOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn generate_thumbnail_existing() {
        let storage = InMemoryStorage::new();
        let handler = MediaAssetHandler;
        let create_result = handler
            .create_media(
                MediaAssetCreateMediaInput {
                    media_type: "image".into(),
                    source: "photo.jpg".into(),
                    metadata: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        let media_id = match create_result {
            MediaAssetCreateMediaOutput::Ok { media_id } => media_id,
        };

        let result = handler
            .generate_thumbnail(
                MediaAssetGenerateThumbnailInput { media_id: media_id.clone() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            MediaAssetGenerateThumbnailOutput::Ok { media_id: mid, thumbnail_uri } => {
                assert_eq!(mid, media_id);
                assert!(thumbnail_uri.starts_with("/thumbnails/"));
                assert!(thumbnail_uri.contains("photo.jpg"));
            }
            MediaAssetGenerateThumbnailOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn generate_thumbnail_not_found() {
        let storage = InMemoryStorage::new();
        let handler = MediaAssetHandler;
        let result = handler
            .generate_thumbnail(
                MediaAssetGenerateThumbnailInput { media_id: "missing".into() },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, MediaAssetGenerateThumbnailOutput::NotFound { .. }));
    }
}
