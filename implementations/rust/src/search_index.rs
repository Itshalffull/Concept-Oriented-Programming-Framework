// SearchIndex Concept Implementation (Rust)
//
// Manages search indexes with item indexing and text search.
// See Architecture doc Sections on search and indexing.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── CreateIndex ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateIndexInput {
    pub index_id: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CreateIndexOutput {
    #[serde(rename = "ok")]
    Ok { index_id: String },
}

// ── IndexItem ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexItemInput {
    pub index_id: String,
    pub node_id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum IndexItemOutput {
    #[serde(rename = "ok")]
    Ok { index_id: String, node_id: String },
}

// ── RemoveItem ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveItemInput {
    pub index_id: String,
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RemoveItemOutput {
    #[serde(rename = "ok")]
    Ok { index_id: String, node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Search ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchInput {
    pub index_id: String,
    pub query_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SearchOutput {
    #[serde(rename = "ok")]
    Ok { index_id: String, results: String },
}

// ── Reindex ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReindexInput {
    pub index_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ReindexOutput {
    #[serde(rename = "ok")]
    Ok { index_id: String, count: u64 },
}

// ── Handler ───────────────────────────────────────────────

pub struct SearchIndexHandler;

impl SearchIndexHandler {
    pub async fn create_index(
        &self,
        input: CreateIndexInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CreateIndexOutput> {
        let config: serde_json::Value =
            serde_json::from_str(&input.config).unwrap_or(json!({}));

        storage
            .put(
                "search_index",
                &input.index_id,
                json!({
                    "index_id": input.index_id,
                    "config": config,
                }),
            )
            .await?;

        Ok(CreateIndexOutput::Ok {
            index_id: input.index_id,
        })
    }

    pub async fn index_item(
        &self,
        input: IndexItemInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<IndexItemOutput> {
        let item_key = format!("{}:{}", input.index_id, input.node_id);

        // Tokenize content to lowercase words for simple search
        let tokens: Vec<String> = input
            .content
            .to_lowercase()
            .split_whitespace()
            .map(String::from)
            .collect();

        storage
            .put(
                "indexed_item",
                &item_key,
                json!({
                    "index_id": input.index_id,
                    "node_id": input.node_id,
                    "content": input.content,
                    "tokens": tokens,
                }),
            )
            .await?;

        Ok(IndexItemOutput::Ok {
            index_id: input.index_id,
            node_id: input.node_id,
        })
    }

    pub async fn remove_item(
        &self,
        input: RemoveItemInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RemoveItemOutput> {
        let item_key = format!("{}:{}", input.index_id, input.node_id);
        let existing = storage.get("indexed_item", &item_key).await?;

        if existing.is_none() {
            return Ok(RemoveItemOutput::NotFound {
                message: format!(
                    "Item '{}' not found in index '{}'",
                    input.node_id, input.index_id
                ),
            });
        }

        storage.del("indexed_item", &item_key).await?;

        Ok(RemoveItemOutput::Ok {
            index_id: input.index_id,
            node_id: input.node_id,
        })
    }

    pub async fn search(
        &self,
        input: SearchInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SearchOutput> {
        let all_items = storage
            .find(
                "indexed_item",
                Some(&json!({ "index_id": input.index_id })),
            )
            .await?;

        let query_lower = input.query_text.to_lowercase();
        let query_tokens: Vec<&str> = query_lower.split_whitespace().collect();

        let matching: Vec<serde_json::Value> = all_items
            .into_iter()
            .filter(|item| {
                let content = item["content"]
                    .as_str()
                    .unwrap_or("")
                    .to_lowercase();
                query_tokens.iter().any(|token| content.contains(token))
            })
            .map(|item| {
                json!({
                    "node_id": item["node_id"],
                    "content": item["content"],
                })
            })
            .collect();

        Ok(SearchOutput::Ok {
            index_id: input.index_id,
            results: serde_json::to_string(&matching)?,
        })
    }

    pub async fn reindex(
        &self,
        input: ReindexInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ReindexOutput> {
        let all_items = storage
            .find(
                "indexed_item",
                Some(&json!({ "index_id": input.index_id })),
            )
            .await?;

        let count = all_items.len() as u64;

        // Re-tokenize all items
        for item in all_items {
            let node_id = item["node_id"].as_str().unwrap_or("").to_string();
            let content = item["content"].as_str().unwrap_or("").to_string();
            let item_key = format!("{}:{}", input.index_id, node_id);

            let tokens: Vec<String> = content
                .to_lowercase()
                .split_whitespace()
                .map(String::from)
                .collect();

            storage
                .put(
                    "indexed_item",
                    &item_key,
                    json!({
                        "index_id": input.index_id,
                        "node_id": node_id,
                        "content": content,
                        "tokens": tokens,
                    }),
                )
                .await?;
        }

        Ok(ReindexOutput::Ok {
            index_id: input.index_id,
            count,
        })
    }
}
