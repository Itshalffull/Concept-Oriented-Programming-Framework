// Media asset implementation
// Source-abstracted asset facade with metadata extraction
// and thumbnail generation. Manages asset lifecycle.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::MediaAssetHandler;
use serde_json::json;

pub struct MediaAssetHandlerImpl;

#[async_trait]
impl MediaAssetHandler for MediaAssetHandlerImpl {
    async fn create_media(
        &self,
        input: MediaAssetCreateMediaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MediaAssetCreateMediaOutput, Box<dyn std::error::Error>> {
        if let Some(_) = storage.get("mediaAsset", &input.asset).await? {
            return Ok(MediaAssetCreateMediaOutput::Error {
                message: "Asset already exists".into(),
            });
        }

        let now = chrono::Utc::now().to_rfc3339();
        storage.put("mediaAsset", &input.asset, json!({
            "asset": input.asset,
            "sourcePlugin": input.source,
            "originalFile": input.file,
            "metadata": "",
            "thumbnail": "",
            "createdAt": now,
            "updatedAt": now,
        })).await?;

        Ok(MediaAssetCreateMediaOutput::Ok { asset: input.asset })
    }

    async fn extract_metadata(
        &self,
        input: MediaAssetExtractMetadataInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MediaAssetExtractMetadataOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("mediaAsset", &input.asset).await? {
            Some(r) => r,
            None => return Ok(MediaAssetExtractMetadataOutput::Notfound {
                message: "Asset does not exist".into(),
            }),
        };

        let file = existing.get("originalFile")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let source = existing.get("sourcePlugin")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let now = chrono::Utc::now().to_rfc3339();

        let extension = file.rsplit('.').next().unwrap_or("unknown");
        let metadata = json!({
            "fileName": file,
            "source": source,
            "fileType": extension,
            "extractedAt": now,
        });
        let metadata_str = serde_json::to_string(&metadata)?;

        let mut updated = existing.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("metadata".into(), json!(metadata_str));
            obj.insert("updatedAt".into(), json!(now));
        }
        storage.put("mediaAsset", &input.asset, updated).await?;

        Ok(MediaAssetExtractMetadataOutput::Ok { metadata: metadata_str })
    }

    async fn generate_thumbnail(
        &self,
        input: MediaAssetGenerateThumbnailInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MediaAssetGenerateThumbnailOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("mediaAsset", &input.asset).await? {
            Some(r) => r,
            None => return Ok(MediaAssetGenerateThumbnailOutput::Notfound {
                message: "Asset does not exist".into(),
            }),
        };

        let file = existing.get("originalFile")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let now = chrono::Utc::now().to_rfc3339();
        let thumbnail = format!("thumb_{}", file);

        let mut updated = existing.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("thumbnail".into(), json!(thumbnail));
            obj.insert("updatedAt".into(), json!(now));
        }
        storage.put("mediaAsset", &input.asset, updated).await?;

        Ok(MediaAssetGenerateThumbnailOutput::Ok { thumbnail })
    }

    async fn get_media(
        &self,
        input: MediaAssetGetMediaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MediaAssetGetMediaOutput, Box<dyn std::error::Error>> {
        match storage.get("mediaAsset", &input.asset).await? {
            Some(record) => {
                let metadata = record.get("metadata")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let thumbnail = record.get("thumbnail")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                Ok(MediaAssetGetMediaOutput::Ok {
                    asset: input.asset,
                    metadata,
                    thumbnail,
                })
            }
            None => Ok(MediaAssetGetMediaOutput::Notfound {
                message: "Asset does not exist".into(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_media_success() {
        let storage = InMemoryStorage::new();
        let handler = MediaAssetHandlerImpl;
        let result = handler.create_media(
            MediaAssetCreateMediaInput { asset: "a1".into(), source: "upload".into(), file: "photo.jpg".into() },
            &storage,
        ).await.unwrap();
        match result {
            MediaAssetCreateMediaOutput::Ok { asset } => assert_eq!(asset, "a1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_media_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = MediaAssetHandlerImpl;
        handler.create_media(
            MediaAssetCreateMediaInput { asset: "a1".into(), source: "s".into(), file: "f.png".into() },
            &storage,
        ).await.unwrap();
        let result = handler.create_media(
            MediaAssetCreateMediaInput { asset: "a1".into(), source: "s".into(), file: "f.png".into() },
            &storage,
        ).await.unwrap();
        match result {
            MediaAssetCreateMediaOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_extract_metadata_success() {
        let storage = InMemoryStorage::new();
        let handler = MediaAssetHandlerImpl;
        handler.create_media(
            MediaAssetCreateMediaInput { asset: "a1".into(), source: "upload".into(), file: "doc.pdf".into() },
            &storage,
        ).await.unwrap();
        let result = handler.extract_metadata(
            MediaAssetExtractMetadataInput { asset: "a1".into() },
            &storage,
        ).await.unwrap();
        match result {
            MediaAssetExtractMetadataOutput::Ok { metadata } => {
                assert!(metadata.contains("pdf"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_extract_metadata_not_found() {
        let storage = InMemoryStorage::new();
        let handler = MediaAssetHandlerImpl;
        let result = handler.extract_metadata(
            MediaAssetExtractMetadataInput { asset: "missing".into() },
            &storage,
        ).await.unwrap();
        match result {
            MediaAssetExtractMetadataOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_thumbnail() {
        let storage = InMemoryStorage::new();
        let handler = MediaAssetHandlerImpl;
        handler.create_media(
            MediaAssetCreateMediaInput { asset: "a1".into(), source: "s".into(), file: "img.png".into() },
            &storage,
        ).await.unwrap();
        let result = handler.generate_thumbnail(
            MediaAssetGenerateThumbnailInput { asset: "a1".into() },
            &storage,
        ).await.unwrap();
        match result {
            MediaAssetGenerateThumbnailOutput::Ok { thumbnail } => {
                assert!(thumbnail.starts_with("thumb_"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_media_not_found() {
        let storage = InMemoryStorage::new();
        let handler = MediaAssetHandlerImpl;
        let result = handler.get_media(
            MediaAssetGetMediaInput { asset: "nope".into() },
            &storage,
        ).await.unwrap();
        match result {
            MediaAssetGetMediaOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
