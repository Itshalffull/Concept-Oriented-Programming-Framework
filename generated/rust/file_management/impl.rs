// FileManagement concept implementation
// Upload, track usage, and garbage-collect files with reference counting.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::FileManagementHandler;
use serde_json::json;

pub struct FileManagementHandlerImpl;

#[async_trait]
impl FileManagementHandler for FileManagementHandlerImpl {
    async fn upload(
        &self,
        input: FileManagementUploadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileManagementUploadOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("file", &input.file).await?;
        if existing.is_some() {
            return Ok(FileManagementUploadOutput::Error {
                message: "File already exists".to_string(),
            });
        }

        storage.put("file", &input.file, json!({
            "file": input.file,
            "data": input.data,
            "mimeType": input.mime_type,
            "usages": "[]",
        })).await?;

        Ok(FileManagementUploadOutput::Ok { file: input.file })
    }

    async fn add_usage(
        &self,
        input: FileManagementAddUsageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileManagementAddUsageOutput, Box<dyn std::error::Error>> {
        let record = storage.get("file", &input.file).await?;
        let Some(mut record) = record else {
            return Ok(FileManagementAddUsageOutput::Notfound {
                message: "File not found".to_string(),
            });
        };

        let usages_str = record.get("usages").and_then(|v| v.as_str()).unwrap_or("[]");
        let mut usages: Vec<String> = serde_json::from_str(usages_str).unwrap_or_default();
        if !usages.contains(&input.entity) {
            usages.push(input.entity);
        }
        record["usages"] = json!(serde_json::to_string(&usages)?);
        storage.put("file", &input.file, record).await?;

        Ok(FileManagementAddUsageOutput::Ok)
    }

    async fn remove_usage(
        &self,
        input: FileManagementRemoveUsageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileManagementRemoveUsageOutput, Box<dyn std::error::Error>> {
        let record = storage.get("file", &input.file).await?;
        let Some(mut record) = record else {
            return Ok(FileManagementRemoveUsageOutput::Notfound {
                message: "File not found".to_string(),
            });
        };

        let usages_str = record.get("usages").and_then(|v| v.as_str()).unwrap_or("[]");
        let mut usages: Vec<String> = serde_json::from_str(usages_str).unwrap_or_default();
        usages.retain(|u| u != &input.entity);
        record["usages"] = json!(serde_json::to_string(&usages)?);
        storage.put("file", &input.file, record).await?;

        Ok(FileManagementRemoveUsageOutput::Ok)
    }

    async fn garbage_collect(
        &self,
        _input: FileManagementGarbageCollectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileManagementGarbageCollectOutput, Box<dyn std::error::Error>> {
        let all_files = storage.find("file", None).await?;
        let mut removed: i64 = 0;

        for record in &all_files {
            let usages_str = record.get("usages").and_then(|v| v.as_str()).unwrap_or("[]");
            let usages: Vec<String> = serde_json::from_str(usages_str).unwrap_or_default();
            if usages.is_empty() {
                if let Some(file) = record.get("file").and_then(|v| v.as_str()) {
                    storage.del("file", file).await?;
                    removed += 1;
                }
            }
        }

        Ok(FileManagementGarbageCollectOutput::Ok { removed })
    }

    async fn get_file(
        &self,
        input: FileManagementGetFileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileManagementGetFileOutput, Box<dyn std::error::Error>> {
        let record = storage.get("file", &input.file).await?;
        match record {
            None => Ok(FileManagementGetFileOutput::Notfound {
                message: "File not found".to_string(),
            }),
            Some(record) => Ok(FileManagementGetFileOutput::Ok {
                data: record.get("data").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                mime_type: record.get("mimeType").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_upload_success() {
        let storage = InMemoryStorage::new();
        let handler = FileManagementHandlerImpl;
        let result = handler.upload(
            FileManagementUploadInput {
                file: "logo.png".to_string(),
                data: "base64data".to_string(),
                mime_type: "image/png".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FileManagementUploadOutput::Ok { file } => {
                assert_eq!(file, "logo.png");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_upload_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = FileManagementHandlerImpl;
        handler.upload(
            FileManagementUploadInput {
                file: "logo.png".to_string(),
                data: "data1".to_string(),
                mime_type: "image/png".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.upload(
            FileManagementUploadInput {
                file: "logo.png".to_string(),
                data: "data2".to_string(),
                mime_type: "image/png".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FileManagementUploadOutput::Error { .. } => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_add_usage_notfound() {
        let storage = InMemoryStorage::new();
        let handler = FileManagementHandlerImpl;
        let result = handler.add_usage(
            FileManagementAddUsageInput {
                file: "missing.png".to_string(),
                entity: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FileManagementAddUsageOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_usage_notfound() {
        let storage = InMemoryStorage::new();
        let handler = FileManagementHandlerImpl;
        let result = handler.remove_usage(
            FileManagementRemoveUsageInput {
                file: "missing.png".to_string(),
                entity: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FileManagementRemoveUsageOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_garbage_collect_removes_unused() {
        let storage = InMemoryStorage::new();
        let handler = FileManagementHandlerImpl;
        handler.upload(
            FileManagementUploadInput {
                file: "unused.png".to_string(),
                data: "data".to_string(),
                mime_type: "image/png".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.garbage_collect(
            FileManagementGarbageCollectInput {},
            &storage,
        ).await.unwrap();
        match result {
            FileManagementGarbageCollectOutput::Ok { removed } => {
                assert!(removed >= 1);
            },
        }
    }

    #[tokio::test]
    async fn test_get_file_notfound() {
        let storage = InMemoryStorage::new();
        let handler = FileManagementHandlerImpl;
        let result = handler.get_file(
            FileManagementGetFileInput { file: "missing.png".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FileManagementGetFileOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
