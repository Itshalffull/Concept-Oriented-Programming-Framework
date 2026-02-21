// FileManagement Concept Implementation (Rust)
//
// Media kit — uploads files with metadata, tracks file usage by entities,
// removes usage references, and garbage-collects unused files.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Upload ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileManagementUploadInput {
    pub file_id: String,
    pub destination: String,
    pub metadata: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FileManagementUploadOutput {
    #[serde(rename = "ok")]
    Ok { file_id: String },
}

// ── AddUsage ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileManagementAddUsageInput {
    pub file_id: String,
    pub entity_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FileManagementAddUsageOutput {
    #[serde(rename = "ok")]
    Ok { file_id: String },
    #[serde(rename = "file_notfound")]
    FileNotFound { message: String },
}

// ── RemoveUsage ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileManagementRemoveUsageInput {
    pub file_id: String,
    pub entity_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FileManagementRemoveUsageOutput {
    #[serde(rename = "ok")]
    Ok { file_id: String },
    #[serde(rename = "file_notfound")]
    FileNotFound { message: String },
}

// ── GarbageCollect ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileManagementGarbageCollectInput {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FileManagementGarbageCollectOutput {
    #[serde(rename = "ok")]
    Ok { removed_count: u64 },
}

// ── Handler ───────────────────────────────────────────────

pub struct FileManagementHandler;

impl FileManagementHandler {
    pub async fn upload(
        &self,
        input: FileManagementUploadInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FileManagementUploadOutput> {
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "file",
                &input.file_id,
                json!({
                    "file_id": input.file_id,
                    "destination": input.destination,
                    "metadata": input.metadata,
                    "uploaded_at": now,
                }),
            )
            .await?;
        Ok(FileManagementUploadOutput::Ok {
            file_id: input.file_id,
        })
    }

    pub async fn add_usage(
        &self,
        input: FileManagementAddUsageInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FileManagementAddUsageOutput> {
        let file = storage.get("file", &input.file_id).await?;
        if file.is_none() {
            return Ok(FileManagementAddUsageOutput::FileNotFound {
                message: format!("file '{}' not found", input.file_id),
            });
        }

        let key = format!("{}:{}", input.file_id, input.entity_id);
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "file_usage",
                &key,
                json!({
                    "file_id": input.file_id,
                    "entity_id": input.entity_id,
                    "added_at": now,
                }),
            )
            .await?;
        Ok(FileManagementAddUsageOutput::Ok {
            file_id: input.file_id,
        })
    }

    pub async fn remove_usage(
        &self,
        input: FileManagementRemoveUsageInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FileManagementRemoveUsageOutput> {
        let file = storage.get("file", &input.file_id).await?;
        if file.is_none() {
            return Ok(FileManagementRemoveUsageOutput::FileNotFound {
                message: format!("file '{}' not found", input.file_id),
            });
        }

        let key = format!("{}:{}", input.file_id, input.entity_id);
        storage.del("file_usage", &key).await?;
        Ok(FileManagementRemoveUsageOutput::Ok {
            file_id: input.file_id,
        })
    }

    pub async fn garbage_collect(
        &self,
        _input: FileManagementGarbageCollectInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FileManagementGarbageCollectOutput> {
        let all_files = storage.find("file", None).await?;
        let all_usages = storage.find("file_usage", None).await?;

        // Collect file IDs that have at least one usage
        let used_file_ids: Vec<String> = all_usages
            .iter()
            .filter_map(|u| u["file_id"].as_str().map(String::from))
            .collect();

        let mut removed_count: u64 = 0;
        for file in &all_files {
            let file_id = file["file_id"].as_str().unwrap_or("");
            if !used_file_ids.contains(&file_id.to_string()) {
                storage.del("file", file_id).await?;
                removed_count += 1;
            }
        }

        Ok(FileManagementGarbageCollectOutput::Ok { removed_count })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn upload_file() {
        let storage = InMemoryStorage::new();
        let handler = FileManagementHandler;
        let result = handler
            .upload(
                FileManagementUploadInput {
                    file_id: "file1".into(),
                    destination: "/uploads/file1.png".into(),
                    metadata: r#"{"size": 1024}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            FileManagementUploadOutput::Ok { file_id } => {
                assert_eq!(file_id, "file1");
            }
        }
    }

    #[tokio::test]
    async fn add_usage_existing_file() {
        let storage = InMemoryStorage::new();
        let handler = FileManagementHandler;
        handler
            .upload(
                FileManagementUploadInput {
                    file_id: "f1".into(),
                    destination: "/uploads/f1.png".into(),
                    metadata: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .add_usage(
                FileManagementAddUsageInput { file_id: "f1".into(), entity_id: "node1".into() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            FileManagementAddUsageOutput::Ok { file_id } => assert_eq!(file_id, "f1"),
            FileManagementAddUsageOutput::FileNotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn add_usage_missing_file() {
        let storage = InMemoryStorage::new();
        let handler = FileManagementHandler;
        let result = handler
            .add_usage(
                FileManagementAddUsageInput { file_id: "missing".into(), entity_id: "e1".into() },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, FileManagementAddUsageOutput::FileNotFound { .. }));
    }

    #[tokio::test]
    async fn remove_usage() {
        let storage = InMemoryStorage::new();
        let handler = FileManagementHandler;
        handler
            .upload(
                FileManagementUploadInput {
                    file_id: "f1".into(),
                    destination: "/uploads/f1.png".into(),
                    metadata: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        handler
            .add_usage(
                FileManagementAddUsageInput { file_id: "f1".into(), entity_id: "node1".into() },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .remove_usage(
                FileManagementRemoveUsageInput { file_id: "f1".into(), entity_id: "node1".into() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            FileManagementRemoveUsageOutput::Ok { file_id } => assert_eq!(file_id, "f1"),
            FileManagementRemoveUsageOutput::FileNotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn garbage_collect_removes_unused_files() {
        let storage = InMemoryStorage::new();
        let handler = FileManagementHandler;
        // Upload two files
        handler
            .upload(
                FileManagementUploadInput {
                    file_id: "used".into(),
                    destination: "/uploads/used.png".into(),
                    metadata: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        handler
            .upload(
                FileManagementUploadInput {
                    file_id: "unused".into(),
                    destination: "/uploads/unused.png".into(),
                    metadata: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        // Add usage only for the first file
        handler
            .add_usage(
                FileManagementAddUsageInput { file_id: "used".into(), entity_id: "e1".into() },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .garbage_collect(FileManagementGarbageCollectInput {}, &storage)
            .await
            .unwrap();
        match result {
            FileManagementGarbageCollectOutput::Ok { removed_count } => {
                assert_eq!(removed_count, 1);
            }
        }
    }

    #[tokio::test]
    async fn garbage_collect_no_files() {
        let storage = InMemoryStorage::new();
        let handler = FileManagementHandler;
        let result = handler
            .garbage_collect(FileManagementGarbageCollectInput {}, &storage)
            .await
            .unwrap();
        match result {
            FileManagementGarbageCollectOutput::Ok { removed_count } => {
                assert_eq!(removed_count, 0);
            }
        }
    }
}
