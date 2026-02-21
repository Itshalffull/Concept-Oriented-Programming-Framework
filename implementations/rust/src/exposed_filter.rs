// ExposedFilter Concept Implementation (Rust)
//
// Manages user-facing filters that can be applied to queries.
// See Architecture doc Sections on query and filtering.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Expose ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExposeInput {
    pub filter_id: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ExposeOutput {
    #[serde(rename = "ok")]
    Ok { filter_id: String },
}

// ── CollectInput ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectInputData {
    pub filter_id: String,
    pub user_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CollectInputOutput {
    #[serde(rename = "ok")]
    Ok { filter_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── ApplyToQuery ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplyToQueryInput {
    pub query_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ApplyToQueryOutput {
    #[serde(rename = "ok")]
    Ok {
        query_id: String,
        applied_filters: String,
    },
}

// ── ResetToDefaults ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResetToDefaultsInput {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ResetToDefaultsOutput {
    #[serde(rename = "ok")]
    Ok { count: u64 },
}

// ── Handler ───────────────────────────────────────────────

pub struct ExposedFilterHandler;

impl ExposedFilterHandler {
    pub async fn expose(
        &self,
        input: ExposeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ExposeOutput> {
        let config: serde_json::Value =
            serde_json::from_str(&input.config).unwrap_or(json!({}));

        storage
            .put(
                "exposed_filter",
                &input.filter_id,
                json!({
                    "filter_id": input.filter_id,
                    "config": config,
                    "user_value": null,
                }),
            )
            .await?;

        Ok(ExposeOutput::Ok {
            filter_id: input.filter_id,
        })
    }

    pub async fn collect_input(
        &self,
        input: CollectInputData,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CollectInputOutput> {
        let existing = storage.get("exposed_filter", &input.filter_id).await?;

        match existing {
            None => Ok(CollectInputOutput::NotFound {
                message: format!("Filter '{}' not found", input.filter_id),
            }),
            Some(mut filter) => {
                filter["user_value"] = json!(input.user_value);
                storage
                    .put("exposed_filter", &input.filter_id, filter)
                    .await?;

                Ok(CollectInputOutput::Ok {
                    filter_id: input.filter_id,
                })
            }
        }
    }

    pub async fn apply_to_query(
        &self,
        input: ApplyToQueryInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ApplyToQueryOutput> {
        let all_filters = storage.find("exposed_filter", None).await?;

        let applied: Vec<serde_json::Value> = all_filters
            .into_iter()
            .filter(|f| !f["user_value"].is_null())
            .map(|f| {
                json!({
                    "filter_id": f["filter_id"],
                    "user_value": f["user_value"],
                    "config": f["config"],
                })
            })
            .collect();

        Ok(ApplyToQueryOutput::Ok {
            query_id: input.query_id,
            applied_filters: serde_json::to_string(&applied)?,
        })
    }

    pub async fn reset_to_defaults(
        &self,
        _input: ResetToDefaultsInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ResetToDefaultsOutput> {
        let all_filters = storage.find("exposed_filter", None).await?;
        let count = all_filters.len() as u64;

        for filter in all_filters {
            let filter_id = filter["filter_id"].as_str().unwrap_or("").to_string();
            let mut updated = filter.clone();
            updated["user_value"] = json!(null);
            storage.put("exposed_filter", &filter_id, updated).await?;
        }

        Ok(ResetToDefaultsOutput::Ok { count })
    }
}
