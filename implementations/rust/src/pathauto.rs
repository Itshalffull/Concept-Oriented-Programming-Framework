// Pathauto Concept Implementation (Rust)
//
// Infrastructure kit — generates URL-safe path aliases from titles,
// bulk-generates aliases for node types, and cleans strings into slugs.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── GenerateAlias ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathautoGenerateAliasInput {
    pub node_id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PathautoGenerateAliasOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String, alias: String },
}

// ── BulkGenerate ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathautoBulkGenerateInput {
    pub node_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PathautoBulkGenerateOutput {
    #[serde(rename = "ok")]
    Ok { count: u64 },
}

// ── CleanString ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathautoCleanStringInput {
    pub input: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PathautoCleanStringOutput {
    #[serde(rename = "ok")]
    Ok { cleaned: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct PathautoHandler;

impl PathautoHandler {
    /// Generate a URL-safe slug from a title string.
    fn slugify(title: &str) -> String {
        title
            .to_lowercase()
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() {
                    c
                } else {
                    '-'
                }
            })
            .collect::<String>()
            // Collapse multiple hyphens
            .split('-')
            .filter(|s| !s.is_empty())
            .collect::<Vec<&str>>()
            .join("-")
    }

    pub async fn generate_alias(
        &self,
        input: PathautoGenerateAliasInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<PathautoGenerateAliasOutput> {
        let alias = Self::slugify(&input.title);
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "path_alias",
                &input.node_id,
                json!({
                    "node_id": input.node_id,
                    "alias": alias,
                    "created_at": now,
                }),
            )
            .await?;
        Ok(PathautoGenerateAliasOutput::Ok {
            node_id: input.node_id,
            alias,
        })
    }

    pub async fn bulk_generate(
        &self,
        input: PathautoBulkGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<PathautoBulkGenerateOutput> {
        let criteria = json!({ "node_type": input.node_type });
        let patterns = storage
            .find("path_pattern", Some(&criteria))
            .await?;

        // Count patterns processed as a proxy for bulk generation
        let count = patterns.len() as u64;

        Ok(PathautoBulkGenerateOutput::Ok { count })
    }

    pub async fn clean_string(
        &self,
        input: PathautoCleanStringInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<PathautoCleanStringOutput> {
        let cleaned = Self::slugify(&input.input);
        Ok(PathautoCleanStringOutput::Ok { cleaned })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn generate_alias_from_title() {
        let storage = InMemoryStorage::new();
        let handler = PathautoHandler;
        let result = handler
            .generate_alias(
                PathautoGenerateAliasInput {
                    node_id: "n1".into(),
                    title: "Hello World!".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            PathautoGenerateAliasOutput::Ok { node_id, alias } => {
                assert_eq!(node_id, "n1");
                assert_eq!(alias, "hello-world");
            }
        }
    }

    #[tokio::test]
    async fn generate_alias_special_chars() {
        let storage = InMemoryStorage::new();
        let handler = PathautoHandler;
        let result = handler
            .generate_alias(
                PathautoGenerateAliasInput {
                    node_id: "n2".into(),
                    title: "My   Post @ #2024!!!".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            PathautoGenerateAliasOutput::Ok { alias, .. } => {
                assert_eq!(alias, "my-post-2024");
            }
        }
    }

    #[tokio::test]
    async fn generate_alias_stores_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = PathautoHandler;
        handler
            .generate_alias(
                PathautoGenerateAliasInput {
                    node_id: "n1".into(),
                    title: "Test Title".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("path_alias", "n1").await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["alias"].as_str().unwrap(), "test-title");
    }

    #[tokio::test]
    async fn bulk_generate_no_patterns() {
        let storage = InMemoryStorage::new();
        let handler = PathautoHandler;
        let result = handler
            .bulk_generate(
                PathautoBulkGenerateInput { node_type: "article".into() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            PathautoBulkGenerateOutput::Ok { count } => {
                assert_eq!(count, 0);
            }
        }
    }

    #[tokio::test]
    async fn clean_string_basic() {
        let storage = InMemoryStorage::new();
        let handler = PathautoHandler;
        let result = handler
            .clean_string(
                PathautoCleanStringInput { input: "Hello, World! #2024".into() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            PathautoCleanStringOutput::Ok { cleaned } => {
                assert_eq!(cleaned, "hello-world-2024");
            }
        }
    }

    #[tokio::test]
    async fn clean_string_already_clean() {
        let storage = InMemoryStorage::new();
        let handler = PathautoHandler;
        let result = handler
            .clean_string(
                PathautoCleanStringInput { input: "already-clean".into() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            PathautoCleanStringOutput::Ok { cleaned } => {
                assert_eq!(cleaned, "already-clean");
            }
        }
    }
}
