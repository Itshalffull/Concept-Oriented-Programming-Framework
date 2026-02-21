// Classification Tag Concept Implementation (Rust)
//
// Manages node-to-tag classification with forward and reverse indexes.
// See Architecture doc Sections on classification kit.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── AddTag ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddTagInput {
    pub node_id: String,
    pub tag_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AddTagOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String, tag_name: String },
}

// ── RemoveTag ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveTagInput {
    pub node_id: String,
    pub tag_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RemoveTagOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String, tag_name: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── GetByTag ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetByTagInput {
    pub tag_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetByTagOutput {
    #[serde(rename = "ok")]
    Ok { tag_name: String, node_ids: String },
}

// ── Rename ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameInput {
    pub old_tag: String,
    pub new_tag: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RenameOutput {
    #[serde(rename = "ok")]
    Ok { old_tag: String, new_tag: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct ClassificationTagHandler;

impl ClassificationTagHandler {
    pub async fn add_tag(
        &self,
        input: AddTagInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddTagOutput> {
        let entry_key = format!("{}:{}", input.node_id, input.tag_name);
        storage
            .put(
                "tag_entry",
                &entry_key,
                json!({ "node_id": input.node_id, "tag_name": input.tag_name }),
            )
            .await?;

        // Update tag_index: tag_name -> list of node_ids
        let existing = storage.get("tag_index", &input.tag_name).await?;
        let mut node_ids: Vec<String> = match &existing {
            Some(record) => {
                if let Some(arr) = record["node_ids"].as_array() {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                } else {
                    vec![]
                }
            }
            None => vec![],
        };

        if !node_ids.contains(&input.node_id) {
            node_ids.push(input.node_id.clone());
        }

        storage
            .put(
                "tag_index",
                &input.tag_name,
                json!({ "tag_name": input.tag_name, "node_ids": node_ids }),
            )
            .await?;

        Ok(AddTagOutput::Ok {
            node_id: input.node_id,
            tag_name: input.tag_name,
        })
    }

    pub async fn remove_tag(
        &self,
        input: RemoveTagInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RemoveTagOutput> {
        let entry_key = format!("{}:{}", input.node_id, input.tag_name);
        let existing = storage.get("tag_entry", &entry_key).await?;

        if existing.is_none() {
            return Ok(RemoveTagOutput::NotFound {
                message: format!(
                    "Tag '{}' not found on node '{}'",
                    input.tag_name, input.node_id
                ),
            });
        }

        storage.del("tag_entry", &entry_key).await?;

        // Update tag_index
        let index = storage.get("tag_index", &input.tag_name).await?;
        if let Some(record) = index {
            let node_ids: Vec<String> = record["node_ids"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .filter(|id| id != &input.node_id)
                        .collect()
                })
                .unwrap_or_default();

            storage
                .put(
                    "tag_index",
                    &input.tag_name,
                    json!({ "tag_name": input.tag_name, "node_ids": node_ids }),
                )
                .await?;
        }

        Ok(RemoveTagOutput::Ok {
            node_id: input.node_id,
            tag_name: input.tag_name,
        })
    }

    pub async fn get_by_tag(
        &self,
        input: GetByTagInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetByTagOutput> {
        let index = storage.get("tag_index", &input.tag_name).await?;
        let node_ids: Vec<String> = match index {
            Some(record) => record["node_ids"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            None => vec![],
        };

        Ok(GetByTagOutput::Ok {
            tag_name: input.tag_name,
            node_ids: serde_json::to_string(&node_ids)?,
        })
    }

    pub async fn rename(
        &self,
        input: RenameInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RenameOutput> {
        let existing = storage.get("tag_index", &input.old_tag).await?;

        match existing {
            None => Ok(RenameOutput::NotFound {
                message: format!("Tag '{}' not found", input.old_tag),
            }),
            Some(record) => {
                let node_ids: Vec<String> = record["node_ids"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();

                // Remove old index, create new one
                storage.del("tag_index", &input.old_tag).await?;
                storage
                    .put(
                        "tag_index",
                        &input.new_tag,
                        json!({ "tag_name": input.new_tag, "node_ids": node_ids }),
                    )
                    .await?;

                // Update tag_entry records
                for node_id in &node_ids {
                    let old_key = format!("{}:{}", node_id, input.old_tag);
                    let new_key = format!("{}:{}", node_id, input.new_tag);
                    storage.del("tag_entry", &old_key).await?;
                    storage
                        .put(
                            "tag_entry",
                            &new_key,
                            json!({ "node_id": node_id, "tag_name": input.new_tag }),
                        )
                        .await?;
                }

                Ok(RenameOutput::Ok {
                    old_tag: input.old_tag,
                    new_tag: input.new_tag,
                })
            }
        }
    }
}
