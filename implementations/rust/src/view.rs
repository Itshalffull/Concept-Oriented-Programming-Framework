// View Concept Implementation (Rust)
//
// Manages data views with filtering, sorting, grouping, and layout.
// See Architecture doc Sections on view and display.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Create ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInput {
    pub name: String,
    pub data_source: String,
    pub layout: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CreateOutput {
    #[serde(rename = "ok")]
    Ok { view_id: String },
}

// ── SetFilter ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetFilterInput {
    pub view_id: String,
    pub rules: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SetFilterOutput {
    #[serde(rename = "ok")]
    Ok { view_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── SetSort ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetSortInput {
    pub view_id: String,
    pub rules: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SetSortOutput {
    #[serde(rename = "ok")]
    Ok { view_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── SetGroup ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetGroupInput {
    pub view_id: String,
    pub field: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SetGroupOutput {
    #[serde(rename = "ok")]
    Ok { view_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── SetVisibleFields ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetVisibleFieldsInput {
    pub view_id: String,
    pub field_ids: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SetVisibleFieldsOutput {
    #[serde(rename = "ok")]
    Ok { view_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── ChangeLayout ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeLayoutInput {
    pub view_id: String,
    pub layout: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ChangeLayoutOutput {
    #[serde(rename = "ok")]
    Ok { view_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Duplicate ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateInput {
    pub view_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DuplicateOutput {
    #[serde(rename = "ok")]
    Ok { new_view_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct ViewHandler;

impl ViewHandler {
    pub async fn create(
        &self,
        input: CreateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CreateOutput> {
        let view_id = format!("view_{}", input.name.to_lowercase().replace(' ', "_"));

        storage
            .put(
                "view",
                &view_id,
                json!({
                    "view_id": view_id,
                    "name": input.name,
                    "data_source": input.data_source,
                    "layout": input.layout,
                    "filter_rules": null,
                    "sort_rules": null,
                    "group_field": null,
                    "visible_fields": null,
                }),
            )
            .await?;

        Ok(CreateOutput::Ok { view_id })
    }

    pub async fn set_filter(
        &self,
        input: SetFilterInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SetFilterOutput> {
        let existing = storage.get("view", &input.view_id).await?;

        match existing {
            None => Ok(SetFilterOutput::NotFound {
                message: format!("View '{}' not found", input.view_id),
            }),
            Some(mut view) => {
                let rules: serde_json::Value =
                    serde_json::from_str(&input.rules).unwrap_or(json!([]));
                view["filter_rules"] = rules;
                storage.put("view", &input.view_id, view).await?;

                Ok(SetFilterOutput::Ok {
                    view_id: input.view_id,
                })
            }
        }
    }

    pub async fn set_sort(
        &self,
        input: SetSortInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SetSortOutput> {
        let existing = storage.get("view", &input.view_id).await?;

        match existing {
            None => Ok(SetSortOutput::NotFound {
                message: format!("View '{}' not found", input.view_id),
            }),
            Some(mut view) => {
                let rules: serde_json::Value =
                    serde_json::from_str(&input.rules).unwrap_or(json!([]));
                view["sort_rules"] = rules;
                storage.put("view", &input.view_id, view).await?;

                Ok(SetSortOutput::Ok {
                    view_id: input.view_id,
                })
            }
        }
    }

    pub async fn set_group(
        &self,
        input: SetGroupInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SetGroupOutput> {
        let existing = storage.get("view", &input.view_id).await?;

        match existing {
            None => Ok(SetGroupOutput::NotFound {
                message: format!("View '{}' not found", input.view_id),
            }),
            Some(mut view) => {
                view["group_field"] = json!(input.field);
                storage.put("view", &input.view_id, view).await?;

                Ok(SetGroupOutput::Ok {
                    view_id: input.view_id,
                })
            }
        }
    }

    pub async fn set_visible_fields(
        &self,
        input: SetVisibleFieldsInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SetVisibleFieldsOutput> {
        let existing = storage.get("view", &input.view_id).await?;

        match existing {
            None => Ok(SetVisibleFieldsOutput::NotFound {
                message: format!("View '{}' not found", input.view_id),
            }),
            Some(mut view) => {
                let field_ids: serde_json::Value =
                    serde_json::from_str(&input.field_ids).unwrap_or(json!([]));
                view["visible_fields"] = field_ids;
                storage.put("view", &input.view_id, view).await?;

                Ok(SetVisibleFieldsOutput::Ok {
                    view_id: input.view_id,
                })
            }
        }
    }

    pub async fn change_layout(
        &self,
        input: ChangeLayoutInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ChangeLayoutOutput> {
        let existing = storage.get("view", &input.view_id).await?;

        match existing {
            None => Ok(ChangeLayoutOutput::NotFound {
                message: format!("View '{}' not found", input.view_id),
            }),
            Some(mut view) => {
                view["layout"] = json!(input.layout);
                storage.put("view", &input.view_id, view).await?;

                Ok(ChangeLayoutOutput::Ok {
                    view_id: input.view_id,
                })
            }
        }
    }

    pub async fn duplicate(
        &self,
        input: DuplicateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DuplicateOutput> {
        let existing = storage.get("view", &input.view_id).await?;

        match existing {
            None => Ok(DuplicateOutput::NotFound {
                message: format!("View '{}' not found", input.view_id),
            }),
            Some(view) => {
                let new_view_id = format!("{}_copy", input.view_id);
                let mut new_view = view.clone();
                new_view["view_id"] = json!(new_view_id);
                let old_name = view["name"].as_str().unwrap_or("view");
                new_view["name"] = json!(format!("{} (copy)", old_name));

                storage.put("view", &new_view_id, new_view).await?;

                Ok(DuplicateOutput::Ok { new_view_id })
            }
        }
    }
}
