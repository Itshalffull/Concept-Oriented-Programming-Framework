// Query Concept Implementation (Rust)
//
// Manages query definitions with filters and sort rules.
// See Architecture doc Sections on query and data retrieval.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Create ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInput {
    pub query_string: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CreateOutput {
    #[serde(rename = "ok")]
    Ok { query_id: String },
}

// ── Execute ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteInput {
    pub query_id: String,
    pub storage_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ExecuteOutput {
    #[serde(rename = "ok")]
    Ok { query_id: String, results: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── AddFilter ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddFilterInput {
    pub query_id: String,
    pub field: String,
    pub operator: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AddFilterOutput {
    #[serde(rename = "ok")]
    Ok { query_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── AddSort ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddSortInput {
    pub query_id: String,
    pub field: String,
    pub direction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AddSortOutput {
    #[serde(rename = "ok")]
    Ok { query_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct QueryHandler;

impl QueryHandler {
    pub async fn create(
        &self,
        input: CreateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CreateOutput> {
        let query_id = format!(
            "query_{}",
            input
                .query_string
                .to_lowercase()
                .replace(' ', "_")
                .chars()
                .take(20)
                .collect::<String>()
        );

        storage
            .put(
                "query_def",
                &query_id,
                json!({
                    "query_id": query_id,
                    "query_string": input.query_string,
                    "scope": input.scope,
                    "filters": [],
                    "sorts": [],
                }),
            )
            .await?;

        Ok(CreateOutput::Ok { query_id })
    }

    pub async fn execute(
        &self,
        input: ExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ExecuteOutput> {
        let query = storage.get("query_def", &input.query_id).await?;

        match query {
            None => Ok(ExecuteOutput::NotFound {
                message: format!("Query '{}' not found", input.query_id),
            }),
            Some(query_def) => {
                let scope = query_def["scope"].as_str().unwrap_or("default");
                let results = storage.find(scope, None).await?;

                Ok(ExecuteOutput::Ok {
                    query_id: input.query_id,
                    results: serde_json::to_string(&results)?,
                })
            }
        }
    }

    pub async fn add_filter(
        &self,
        input: AddFilterInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddFilterOutput> {
        let existing = storage.get("query_def", &input.query_id).await?;

        match existing {
            None => Ok(AddFilterOutput::NotFound {
                message: format!("Query '{}' not found", input.query_id),
            }),
            Some(mut query) => {
                let filter = json!({
                    "field": input.field,
                    "operator": input.operator,
                    "value": input.value,
                });

                match query["filters"].as_array_mut() {
                    Some(arr) => arr.push(filter),
                    None => query["filters"] = json!([filter]),
                }

                storage.put("query_def", &input.query_id, query).await?;

                Ok(AddFilterOutput::Ok {
                    query_id: input.query_id,
                })
            }
        }
    }

    pub async fn add_sort(
        &self,
        input: AddSortInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddSortOutput> {
        let existing = storage.get("query_def", &input.query_id).await?;

        match existing {
            None => Ok(AddSortOutput::NotFound {
                message: format!("Query '{}' not found", input.query_id),
            }),
            Some(mut query) => {
                let sort = json!({
                    "field": input.field,
                    "direction": input.direction,
                });

                match query["sorts"].as_array_mut() {
                    Some(arr) => arr.push(sort),
                    None => query["sorts"] = json!([sort]),
                }

                storage.put("query_def", &input.query_id, query).await?;

                Ok(AddSortOutput::Ok {
                    query_id: input.query_id,
                })
            }
        }
    }
}
