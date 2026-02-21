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

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── create tests ───────────────────────────────────────

    #[tokio::test]
    async fn create_returns_deterministic_view_id() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        let result = handler
            .create(
                CreateInput {
                    name: "Task Board".into(),
                    data_source: "tasks".into(),
                    layout: "board".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            CreateOutput::Ok { view_id } => {
                assert_eq!(view_id, "view_task_board");
            }
        }
    }

    #[tokio::test]
    async fn create_stores_view_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        handler
            .create(
                CreateInput {
                    name: "Users".into(),
                    data_source: "user_table".into(),
                    layout: "table".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("view", "view_users").await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["layout"].as_str().unwrap(), "table");
    }

    // ── set_filter tests ───────────────────────────────────

    #[tokio::test]
    async fn set_filter_updates_view_filter_rules() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        handler
            .create(
                CreateInput {
                    name: "Filtered".into(),
                    data_source: "items".into(),
                    layout: "list".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .set_filter(
                SetFilterInput {
                    view_id: "view_filtered".into(),
                    rules: r#"[{"field":"status","op":"eq","value":"active"}]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SetFilterOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn set_filter_returns_notfound_for_missing_view() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        let result = handler
            .set_filter(
                SetFilterInput {
                    view_id: "nonexistent".into(),
                    rules: "[]".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SetFilterOutput::NotFound { .. }));
    }

    // ── set_sort tests ─────────────────────────────────────

    #[tokio::test]
    async fn set_sort_updates_view_sort_rules() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        handler
            .create(
                CreateInput {
                    name: "Sorted".into(),
                    data_source: "items".into(),
                    layout: "list".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .set_sort(
                SetSortInput {
                    view_id: "view_sorted".into(),
                    rules: r#"[{"field":"name","direction":"asc"}]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SetSortOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn set_sort_returns_notfound_for_missing_view() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        let result = handler
            .set_sort(
                SetSortInput {
                    view_id: "nonexistent".into(),
                    rules: "[]".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SetSortOutput::NotFound { .. }));
    }

    // ── set_group tests ────────────────────────────────────

    #[tokio::test]
    async fn set_group_updates_group_field() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        handler
            .create(
                CreateInput {
                    name: "Grouped".into(),
                    data_source: "items".into(),
                    layout: "board".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .set_group(
                SetGroupInput {
                    view_id: "view_grouped".into(),
                    field: "category".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SetGroupOutput::Ok { .. }));

        let record = storage.get("view", "view_grouped").await.unwrap().unwrap();
        assert_eq!(record["group_field"].as_str().unwrap(), "category");
    }

    #[tokio::test]
    async fn set_group_returns_notfound_for_missing_view() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        let result = handler
            .set_group(
                SetGroupInput {
                    view_id: "nonexistent".into(),
                    field: "status".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SetGroupOutput::NotFound { .. }));
    }

    // ── set_visible_fields tests ───────────────────────────

    #[tokio::test]
    async fn set_visible_fields_updates_view() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        handler
            .create(
                CreateInput {
                    name: "Columned".into(),
                    data_source: "items".into(),
                    layout: "table".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .set_visible_fields(
                SetVisibleFieldsInput {
                    view_id: "view_columned".into(),
                    field_ids: r#"["name","status","date"]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SetVisibleFieldsOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn set_visible_fields_returns_notfound_for_missing_view() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        let result = handler
            .set_visible_fields(
                SetVisibleFieldsInput {
                    view_id: "nonexistent".into(),
                    field_ids: "[]".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            SetVisibleFieldsOutput::NotFound { .. }
        ));
    }

    // ── change_layout tests ────────────────────────────────

    #[tokio::test]
    async fn change_layout_updates_view_layout() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        handler
            .create(
                CreateInput {
                    name: "Switchable".into(),
                    data_source: "items".into(),
                    layout: "table".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .change_layout(
                ChangeLayoutInput {
                    view_id: "view_switchable".into(),
                    layout: "board".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ChangeLayoutOutput::Ok { .. }));

        let record = storage
            .get("view", "view_switchable")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(record["layout"].as_str().unwrap(), "board");
    }

    #[tokio::test]
    async fn change_layout_returns_notfound_for_missing_view() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        let result = handler
            .change_layout(
                ChangeLayoutInput {
                    view_id: "nonexistent".into(),
                    layout: "grid".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ChangeLayoutOutput::NotFound { .. }));
    }

    // ── duplicate tests ────────────────────────────────────

    #[tokio::test]
    async fn duplicate_creates_copy_of_view() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        handler
            .create(
                CreateInput {
                    name: "Original".into(),
                    data_source: "items".into(),
                    layout: "table".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .duplicate(
                DuplicateInput {
                    view_id: "view_original".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            DuplicateOutput::Ok { new_view_id } => {
                assert_eq!(new_view_id, "view_original_copy");
                let copy = storage.get("view", &new_view_id).await.unwrap().unwrap();
                assert_eq!(copy["name"].as_str().unwrap(), "Original (copy)");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn duplicate_returns_notfound_for_missing_view() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandler;

        let result = handler
            .duplicate(
                DuplicateInput {
                    view_id: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, DuplicateOutput::NotFound { .. }));
    }
}
