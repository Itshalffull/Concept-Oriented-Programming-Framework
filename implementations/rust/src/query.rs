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

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── create tests ───────────────────────────────────────

    #[tokio::test]
    async fn create_returns_deterministic_query_id() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandler;

        let result = handler
            .create(
                CreateInput {
                    query_string: "SELECT items".into(),
                    scope: "items".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            CreateOutput::Ok { query_id } => {
                assert!(query_id.starts_with("query_"));
                assert!(query_id.contains("select"));
            }
        }
    }

    #[tokio::test]
    async fn create_stores_query_definition() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandler;

        let result = handler
            .create(
                CreateInput {
                    query_string: "Find users".into(),
                    scope: "users".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        if let CreateOutput::Ok { query_id } = result {
            let record = storage.get("query_def", &query_id).await.unwrap();
            assert!(record.is_some());
            let record = record.unwrap();
            assert_eq!(record["scope"].as_str().unwrap(), "users");
        }
    }

    // ── execute tests ──────────────────────────────────────

    #[tokio::test]
    async fn execute_returns_results_for_existing_query() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandler;

        let create_result = handler
            .create(
                CreateInput {
                    query_string: "all tasks".into(),
                    scope: "tasks".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let query_id = match create_result {
            CreateOutput::Ok { query_id } => query_id,
        };

        let result = handler
            .execute(
                ExecuteInput {
                    query_id: query_id.clone(),
                    storage_ref: "default".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            ExecuteOutput::Ok { query_id: qid, .. } if qid == query_id
        ));
    }

    #[tokio::test]
    async fn execute_returns_notfound_for_missing_query() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandler;

        let result = handler
            .execute(
                ExecuteInput {
                    query_id: "nonexistent".into(),
                    storage_ref: "default".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ExecuteOutput::NotFound { .. }));
    }

    // ── add_filter tests ───────────────────────────────────

    #[tokio::test]
    async fn add_filter_succeeds_for_existing_query() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandler;

        let create_result = handler
            .create(
                CreateInput {
                    query_string: "filtered".into(),
                    scope: "items".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let query_id = match create_result {
            CreateOutput::Ok { query_id } => query_id,
        };

        let result = handler
            .add_filter(
                AddFilterInput {
                    query_id: query_id.clone(),
                    field: "status".into(),
                    operator: "eq".into(),
                    value: "active".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, AddFilterOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn add_filter_returns_notfound_for_missing_query() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandler;

        let result = handler
            .add_filter(
                AddFilterInput {
                    query_id: "missing".into(),
                    field: "status".into(),
                    operator: "eq".into(),
                    value: "active".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, AddFilterOutput::NotFound { .. }));
    }

    // ── add_sort tests ─────────────────────────────────────

    #[tokio::test]
    async fn add_sort_succeeds_for_existing_query() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandler;

        let create_result = handler
            .create(
                CreateInput {
                    query_string: "sorted".into(),
                    scope: "items".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let query_id = match create_result {
            CreateOutput::Ok { query_id } => query_id,
        };

        let result = handler
            .add_sort(
                AddSortInput {
                    query_id: query_id.clone(),
                    field: "name".into(),
                    direction: "asc".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, AddSortOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn add_sort_returns_notfound_for_missing_query() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandler;

        let result = handler
            .add_sort(
                AddSortInput {
                    query_id: "missing".into(),
                    field: "name".into(),
                    direction: "desc".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, AddSortOutput::NotFound { .. }));
    }
}
