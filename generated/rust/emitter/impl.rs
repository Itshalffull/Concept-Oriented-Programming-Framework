// Emitter Handler Implementation
//
// Content-addressed file output management. Skips writes when
// content hash matches existing file. Handles formatting,
// orphan cleanup, batch writes, source traceability, and
// drift detection.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::EmitterHandler;
use serde_json::json;
use sha2::{Sha256, Digest};

const FILES_RELATION: &str = "files";
const SOURCE_MAP_RELATION: &str = "sourceMap";

fn sha256_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn file_key(path: &str) -> String {
    path.replace('\\', "/")
}

fn get_extension(path: &str) -> String {
    if let Some(pos) = path.rfind('.') {
        path[pos + 1..].to_lowercase()
    } else {
        String::new()
    }
}

/// Write a single file to storage, returning write result info.
async fn write_file_internal(
    storage: &dyn ConceptStorage,
    path: &str,
    content: &str,
    sources: Option<&serde_json::Value>,
) -> Result<(bool, String, String), Box<dyn std::error::Error>> {
    let hash = sha256_hash(content);
    let key = file_key(path);

    let existing = storage.get(FILES_RELATION, &key).await?;
    if let Some(ref e) = existing {
        if e.get("hash").and_then(|v| v.as_str()) == Some(&hash) {
            return Ok((false, path.to_string(), hash));
        }
    }

    let now = chrono::Utc::now().to_rfc3339();
    storage.put(FILES_RELATION, &key, json!({
        "id": key,
        "path": path,
        "hash": hash,
        "content": content,
        "sizeBytes": content.len(),
        "generatedAt": now,
        "formatted": false,
    })).await?;

    if let Some(src) = sources {
        storage.put(SOURCE_MAP_RELATION, &key, json!({
            "path": path,
            "sources": src,
        })).await?;
    }

    Ok((true, path.to_string(), hash))
}

pub struct EmitterHandlerImpl;

#[async_trait]
impl EmitterHandler for EmitterHandlerImpl {
    async fn write(
        &self,
        input: EmitterWriteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterWriteOutput, Box<dyn std::error::Error>> {
        if input.path.is_empty() {
            return Ok(EmitterWriteOutput::Error {
                message: "path is required".to_string(),
                path: String::new(),
            });
        }

        let sources_val = input.sources.as_ref().map(|s| json!(s));
        match write_file_internal(storage, &input.path, &input.content, sources_val.as_ref()).await {
            Ok((written, path, content_hash)) => {
                Ok(EmitterWriteOutput::Ok { written, path, content_hash })
            }
            Err(e) => Ok(EmitterWriteOutput::Error {
                message: e.to_string(),
                path: input.path,
            }),
        }
    }

    async fn write_batch(
        &self,
        input: EmitterWriteBatchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterWriteBatchOutput, Box<dyn std::error::Error>> {
        if input.files.is_empty() {
            return Ok(EmitterWriteBatchOutput::Ok {
                results: vec![],
            });
        }

        let mut results = Vec::new();
        for file in &input.files {
            let path = file.get("path").and_then(|v| v.as_str()).unwrap_or("");
            let content = file.get("content").and_then(|v| v.as_str()).unwrap_or("");
            let sources = file.get("sources");

            match write_file_internal(storage, path, content, sources).await {
                Ok((written, p, hash)) => {
                    results.push(json!({"path": p, "written": written, "contentHash": hash}));
                }
                Err(e) => {
                    return Ok(EmitterWriteBatchOutput::Error {
                        message: e.to_string(),
                        failed_path: path.to_string(),
                    });
                }
            }
        }

        Ok(EmitterWriteBatchOutput::Ok { results })
    }

    async fn format(
        &self,
        input: EmitterFormatInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterFormatOutput, Box<dyn std::error::Error>> {
        let key = file_key(&input.path);
        let record = storage.get(FILES_RELATION, &key).await?;

        match record {
            Some(mut r) => {
                let ext = get_extension(&input.path);
                let has_formatter = matches!(ext.as_str(),
                    "ts" | "tsx" | "js" | "jsx" | "json" | "css" | "scss" |
                    "html" | "yaml" | "yml" | "md" | "py" | "go" | "rs" | "swift"
                );

                if !has_formatter {
                    return Ok(EmitterFormatOutput::Ok { changed: false });
                }

                r["formatted"] = json!(true);
                storage.put(FILES_RELATION, &key, r).await?;
                Ok(EmitterFormatOutput::Ok { changed: true })
            }
            None => Ok(EmitterFormatOutput::Error {
                message: format!("file not found at {}", input.path),
            }),
        }
    }

    async fn clean(
        &self,
        input: EmitterCleanInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterCleanOutput, Box<dyn std::error::Error>> {
        let normalized_dir = input.output_dir.replace('\\', "/").trim_end_matches('/').to_string();
        let current_set: std::collections::HashSet<String> = input.current_manifest.iter()
            .map(|f| file_key(f))
            .collect();

        let all_files = storage.find(FILES_RELATION, None).await?;
        let mut removed = Vec::new();

        for file in &all_files {
            let file_path = file.get("path").and_then(|v| v.as_str()).unwrap_or("");
            let normalized = file_key(file_path);

            if !normalized.starts_with(&format!("{}/", normalized_dir)) {
                continue;
            }

            if !current_set.contains(&normalized) {
                storage.del(FILES_RELATION, &normalized).await?;
                storage.del(SOURCE_MAP_RELATION, &normalized).await?;
                removed.push(file_path.to_string());
            }
        }

        Ok(EmitterCleanOutput::Ok { removed })
    }

    async fn manifest(
        &self,
        input: EmitterManifestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterManifestOutput, Box<dyn std::error::Error>> {
        let normalized_dir = input.output_dir.replace('\\', "/").trim_end_matches('/').to_string();
        let all_files = storage.find(FILES_RELATION, None).await?;
        let mut files = Vec::new();

        for file in &all_files {
            let file_path = file.get("path").and_then(|v| v.as_str()).unwrap_or("");
            let normalized = file_key(file_path);

            if normalized.starts_with(&format!("{}/", normalized_dir)) {
                files.push(json!({
                    "path": file_path,
                    "hash": file.get("hash").and_then(|v| v.as_str()).unwrap_or(""),
                    "lastWritten": file.get("generatedAt").and_then(|v| v.as_str()).unwrap_or(""),
                }));
            }
        }

        Ok(EmitterManifestOutput::Ok { files })
    }

    async fn trace(
        &self,
        input: EmitterTraceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterTraceOutput, Box<dyn std::error::Error>> {
        let key = file_key(&input.output_path);
        let file_record = storage.get(FILES_RELATION, &key).await?;
        if file_record.is_none() {
            return Ok(EmitterTraceOutput::NotFound { path: input.output_path });
        }

        let source_map = storage.get(SOURCE_MAP_RELATION, &key).await?;
        let sources = source_map
            .and_then(|s| s.get("sources").cloned())
            .unwrap_or(json!([]));

        let sources_vec: Vec<serde_json::Value> = serde_json::from_value(sources).unwrap_or_default();
        Ok(EmitterTraceOutput::Ok { sources: sources_vec })
    }

    async fn affected(
        &self,
        input: EmitterAffectedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterAffectedOutput, Box<dyn std::error::Error>> {
        let all_source_maps = storage.find(SOURCE_MAP_RELATION, None).await?;
        let mut outputs = Vec::new();

        for record in &all_source_maps {
            if let Some(sources) = record.get("sources").and_then(|v| v.as_array()) {
                for source in sources {
                    if source.get("sourcePath").and_then(|v| v.as_str()) == Some(&input.source_path)
                        || source.get("source_path").and_then(|v| v.as_str()) == Some(&input.source_path) {
                        if let Some(path) = record.get("path").and_then(|v| v.as_str()) {
                            outputs.push(path.to_string());
                        }
                        break;
                    }
                }
            }
        }

        Ok(EmitterAffectedOutput::Ok { outputs })
    }

    async fn audit(
        &self,
        input: EmitterAuditInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterAuditOutput, Box<dyn std::error::Error>> {
        let normalized_dir = input.output_dir.replace('\\', "/").trim_end_matches('/').to_string();
        let all_files = storage.find(FILES_RELATION, None).await?;
        let mut status = Vec::new();

        for file in &all_files {
            let file_path = file.get("path").and_then(|v| v.as_str()).unwrap_or("");
            let normalized = file_key(file_path);

            if !normalized.starts_with(&format!("{}/", normalized_dir)) {
                continue;
            }

            let stored_hash = file.get("hash").and_then(|v| v.as_str()).unwrap_or("");
            let content = file.get("content").and_then(|v| v.as_str());

            match content {
                Some(c) => {
                    let actual_hash = sha256_hash(c);
                    let state = if actual_hash == stored_hash { "current" } else { "drifted" };
                    status.push(json!({
                        "path": file_path,
                        "state": state,
                        "expectedHash": stored_hash,
                        "actualHash": actual_hash,
                    }));
                }
                None => {
                    status.push(json!({
                        "path": file_path,
                        "state": "missing",
                        "expectedHash": stored_hash,
                        "actualHash": null,
                    }));
                }
            }
        }

        Ok(EmitterAuditOutput::Ok { status })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_write_success() {
        let storage = InMemoryStorage::new();
        let handler = EmitterHandlerImpl;
        let result = handler.write(
            EmitterWriteInput {
                path: "output/test.ts".to_string(),
                content: "console.log('hello');".to_string(),
                format_hint: None,
                sources: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            EmitterWriteOutput::Ok { written, path, content_hash } => {
                assert!(written);
                assert_eq!(path, "output/test.ts");
                assert!(!content_hash.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_write_empty_path() {
        let storage = InMemoryStorage::new();
        let handler = EmitterHandlerImpl;
        let result = handler.write(
            EmitterWriteInput {
                path: "".to_string(),
                content: "content".to_string(),
                format_hint: None,
                sources: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            EmitterWriteOutput::Error { message, .. } => {
                assert!(message.contains("required"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_write_skips_unchanged() {
        let storage = InMemoryStorage::new();
        let handler = EmitterHandlerImpl;
        handler.write(
            EmitterWriteInput {
                path: "output/same.ts".to_string(),
                content: "same content".to_string(),
                format_hint: None,
                sources: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.write(
            EmitterWriteInput {
                path: "output/same.ts".to_string(),
                content: "same content".to_string(),
                format_hint: None,
                sources: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            EmitterWriteOutput::Ok { written, .. } => {
                assert!(!written);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_format_file_not_found() {
        let storage = InMemoryStorage::new();
        let handler = EmitterHandlerImpl;
        let result = handler.format(
            EmitterFormatInput {
                path: "nonexistent.ts".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EmitterFormatOutput::Error { .. } => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_trace_not_found() {
        let storage = InMemoryStorage::new();
        let handler = EmitterHandlerImpl;
        let result = handler.trace(
            EmitterTraceInput {
                output_path: "nonexistent.ts".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EmitterTraceOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }
}
