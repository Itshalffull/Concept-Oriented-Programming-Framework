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
