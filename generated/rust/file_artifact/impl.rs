// FileArtifact concept implementation
// Registers project files with role, language, and provenance metadata.
// See Architecture doc Section 4.1

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::FileArtifactHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ARTIFACT_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_artifact_id() -> String {
    let id = ARTIFACT_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("artifact-{}", id)
}

/// Infer the role of a file from its path.
fn infer_role(node: &str) -> &str {
    if node.contains(".spec.") || node.contains(".concept.") {
        "spec"
    } else if node.contains(".handler.") {
        "handler"
    } else if node.contains(".test.") || node.contains(".spec.test.") {
        "test"
    } else if node.contains(".sync.") {
        "sync"
    } else if node.ends_with(".yaml") || node.ends_with(".yml") || node.ends_with(".json") {
        "config"
    } else if node.ends_with(".md") {
        "doc"
    } else {
        "source"
    }
}

/// Infer language from file extension.
fn infer_language(node: &str) -> &str {
    if node.ends_with(".ts") || node.ends_with(".tsx") {
        "typescript"
    } else if node.ends_with(".rs") {
        "rust"
    } else if node.ends_with(".go") {
        "go"
    } else if node.ends_with(".swift") {
        "swift"
    } else if node.ends_with(".sol") {
        "solidity"
    } else if node.ends_with(".py") {
        "python"
    } else if node.ends_with(".js") || node.ends_with(".jsx") {
        "javascript"
    } else {
        ""
    }
}

pub struct FileArtifactHandlerImpl;

#[async_trait]
impl FileArtifactHandler for FileArtifactHandlerImpl {
    async fn register(
        &self,
        input: FileArtifactRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileArtifactRegisterOutput, Box<dyn std::error::Error>> {
        // Check for duplicate registration by file path
        let existing = storage.find("artifact", Some(&json!({"node": input.node}))).await?;
        if !existing.is_empty() {
            if let Some(id) = existing[0].get("id").and_then(|v| v.as_str()) {
                return Ok(FileArtifactRegisterOutput::AlreadyRegistered {
                    existing: id.to_string(),
                });
            }
        }

        let role = if input.role.is_empty() { infer_role(&input.node).to_string() } else { input.role };
        let language = if input.language.is_empty() { infer_language(&input.node).to_string() } else { input.language };
        let id = next_artifact_id();

        storage.put("artifact", &id, json!({
            "id": id,
            "node": input.node,
            "role": role,
            "language": language,
            "encoding": "utf-8",
            "generationSource": "",
            "schemaRef": "",
        })).await?;

        // Index by node path for fast lookup
        storage.put("artifact_by_node", &input.node, json!({
            "artifactId": id,
        })).await?;

        Ok(FileArtifactRegisterOutput::Ok { artifact: id })
    }

    async fn set_provenance(
        &self,
        input: FileArtifactSetProvenanceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileArtifactSetProvenanceOutput, Box<dyn std::error::Error>> {
        let data = storage.get("artifact", &input.artifact).await?;
        match data {
            None => Ok(FileArtifactSetProvenanceOutput::Notfound),
            Some(mut record) => {
                record["generationSource"] = json!({"spec": input.spec, "generator": input.generator}).to_string().into();
                storage.put("artifact", &input.artifact, record).await?;
                Ok(FileArtifactSetProvenanceOutput::Ok)
            }
        }
    }

    async fn find_by_role(
        &self,
        input: FileArtifactFindByRoleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileArtifactFindByRoleOutput, Box<dyn std::error::Error>> {
        let matches = storage.find("artifact", Some(&json!({"role": input.role}))).await?;
        let artifacts: Vec<serde_json::Value> = matches.iter().map(|m| {
            json!({
                "id": m.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                "node": m.get("node").and_then(|v| v.as_str()).unwrap_or(""),
                "role": m.get("role").and_then(|v| v.as_str()).unwrap_or(""),
                "language": m.get("language").and_then(|v| v.as_str()).unwrap_or(""),
            })
        }).collect();
        Ok(FileArtifactFindByRoleOutput::Ok {
            artifacts: serde_json::to_string(&artifacts)?,
        })
    }

    async fn find_generated_from(
        &self,
        input: FileArtifactFindGeneratedFromInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileArtifactFindGeneratedFromOutput, Box<dyn std::error::Error>> {
        let all = storage.find("artifact", None).await?;
        let matches: Vec<serde_json::Value> = all.iter().filter(|a| {
            if let Some(gs) = a.get("generationSource").and_then(|v| v.as_str()) {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(gs) {
                    return parsed.get("spec").and_then(|v| v.as_str()) == Some(&input.spec);
                }
            }
            false
        }).map(|m| {
            json!({
                "id": m.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                "node": m.get("node").and_then(|v| v.as_str()).unwrap_or(""),
                "role": m.get("role").and_then(|v| v.as_str()).unwrap_or(""),
            })
        }).collect();

        if matches.is_empty() {
            return Ok(FileArtifactFindGeneratedFromOutput::NoGeneratedFiles);
        }

        Ok(FileArtifactFindGeneratedFromOutput::Ok {
            artifacts: serde_json::to_string(&matches)?,
        })
    }

    async fn get(
        &self,
        input: FileArtifactGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileArtifactGetOutput, Box<dyn std::error::Error>> {
        let data = storage.get("artifact", &input.artifact).await?;
        match data {
            None => Ok(FileArtifactGetOutput::Notfound {
                message: format!("Artifact {} not found", input.artifact),
            }),
            Some(record) => Ok(FileArtifactGetOutput::Ok {
                artifact: input.artifact,
                node: record.get("node").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                role: record.get("role").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                language: record.get("language").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                encoding: record.get("encoding").and_then(|v| v.as_str()).unwrap_or("utf-8").to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_success() {
        let storage = InMemoryStorage::new();
        let handler = FileArtifactHandlerImpl;
        let result = handler.register(
            FileArtifactRegisterInput {
                node: "src/main.ts".to_string(),
                role: "".to_string(),
                language: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FileArtifactRegisterOutput::Ok { artifact } => {
                assert!(!artifact.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_infers_role_and_language() {
        let storage = InMemoryStorage::new();
        let handler = FileArtifactHandlerImpl;
        let result = handler.register(
            FileArtifactRegisterInput {
                node: "handlers/echo.handler.ts".to_string(),
                role: "".to_string(),
                language: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FileArtifactRegisterOutput::Ok { artifact } => {
                let get_result = handler.get(
                    FileArtifactGetInput { artifact: artifact.clone() },
                    &storage,
                ).await.unwrap();
                match get_result {
                    FileArtifactGetOutput::Ok { role, language, .. } => {
                        assert_eq!(role, "handler");
                        assert_eq!(language, "typescript");
                    },
                    _ => panic!("Expected Ok from get"),
                }
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_set_provenance_notfound() {
        let storage = InMemoryStorage::new();
        let handler = FileArtifactHandlerImpl;
        let result = handler.set_provenance(
            FileArtifactSetProvenanceInput {
                artifact: "nonexistent".to_string(),
                spec: "spec.concept".to_string(),
                generator: "rust-gen".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FileArtifactSetProvenanceOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_find_by_role() {
        let storage = InMemoryStorage::new();
        let handler = FileArtifactHandlerImpl;
        handler.register(
            FileArtifactRegisterInput {
                node: "src/app.test.ts".to_string(),
                role: "".to_string(),
                language: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.find_by_role(
            FileArtifactFindByRoleInput { role: "test".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FileArtifactFindByRoleOutput::Ok { artifacts } => {
                assert!(artifacts.contains("test"));
            },
        }
    }

    #[tokio::test]
    async fn test_find_generated_from_no_files() {
        let storage = InMemoryStorage::new();
        let handler = FileArtifactHandlerImpl;
        let result = handler.find_generated_from(
            FileArtifactFindGeneratedFromInput { spec: "missing.concept".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FileArtifactFindGeneratedFromOutput::NoGeneratedFiles => {},
            _ => panic!("Expected NoGeneratedFiles variant"),
        }
    }

    #[tokio::test]
    async fn test_get_notfound() {
        let storage = InMemoryStorage::new();
        let handler = FileArtifactHandlerImpl;
        let result = handler.get(
            FileArtifactGetInput { artifact: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FileArtifactGetOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
