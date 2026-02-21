// Relation Concept Implementation (Rust)
//
// Typed, named relations between nodes — define relation schemas,
// create/remove links, and query related entities.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- DefineRelation ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefineRelationInput {
    pub name: String,
    pub source_type: String,
    pub target_type: String,
    pub cardinality: String,
    pub is_bidirectional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DefineRelationOutput {
    #[serde(rename = "ok")]
    Ok { relation_id: String },
}

// --- Link ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkInput {
    pub relation_id: String,
    pub source_id: String,
    pub target_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum LinkOutput {
    #[serde(rename = "ok")]
    Ok { relation_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Unlink ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnlinkInput {
    pub relation_id: String,
    pub source_id: String,
    pub target_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum UnlinkOutput {
    #[serde(rename = "ok")]
    Ok { relation_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- GetRelated ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetRelatedInput {
    pub node_id: String,
    pub relation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetRelatedOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String, related: String },
}

pub struct RelationHandler;

impl RelationHandler {
    pub async fn define_relation(
        &self,
        input: DefineRelationInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DefineRelationOutput> {
        let relation_id = format!("rel_{}", rand::random::<u32>());
        storage
            .put(
                "relation_def",
                &relation_id,
                json!({
                    "relation_id": relation_id,
                    "name": input.name,
                    "source_type": input.source_type,
                    "target_type": input.target_type,
                    "cardinality": input.cardinality,
                    "is_bidirectional": input.is_bidirectional,
                    "created_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(DefineRelationOutput::Ok { relation_id })
    }

    pub async fn link(
        &self,
        input: LinkInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<LinkOutput> {
        // Verify the relation definition exists
        let rel_def = storage.get("relation_def", &input.relation_id).await?;
        if rel_def.is_none() {
            return Ok(LinkOutput::NotFound {
                message: format!("relation definition '{}' not found", input.relation_id),
            });
        }

        let link_key = format!("{}:{}:{}", input.relation_id, input.source_id, input.target_id);
        storage
            .put(
                "relation_link",
                &link_key,
                json!({
                    "relation_id": input.relation_id,
                    "source_id": input.source_id,
                    "target_id": input.target_id,
                    "created_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(LinkOutput::Ok {
            relation_id: input.relation_id,
        })
    }

    pub async fn unlink(
        &self,
        input: UnlinkInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<UnlinkOutput> {
        let link_key = format!("{}:{}:{}", input.relation_id, input.source_id, input.target_id);
        let existing = storage.get("relation_link", &link_key).await?;
        match existing {
            None => Ok(UnlinkOutput::NotFound {
                message: format!(
                    "link not found for relation '{}' from '{}' to '{}'",
                    input.relation_id, input.source_id, input.target_id
                ),
            }),
            Some(_) => {
                storage.del("relation_link", &link_key).await?;
                Ok(UnlinkOutput::Ok {
                    relation_id: input.relation_id,
                })
            }
        }
    }

    pub async fn get_related(
        &self,
        input: GetRelatedInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetRelatedOutput> {
        // Find all links where this node is the source for the given relation
        let as_source = storage
            .find(
                "relation_link",
                Some(&json!({
                    "relation_id": input.relation_id,
                    "source_id": input.node_id,
                })),
            )
            .await?;

        // Also check if the relation is bidirectional and find reverse links
        let rel_def = storage.get("relation_def", &input.relation_id).await?;
        let is_bidirectional = rel_def
            .as_ref()
            .and_then(|d| d.get("is_bidirectional"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let mut related: Vec<serde_json::Value> = as_source;

        if is_bidirectional {
            let as_target = storage
                .find(
                    "relation_link",
                    Some(&json!({
                        "relation_id": input.relation_id,
                        "target_id": input.node_id,
                    })),
                )
                .await?;
            related.extend(as_target);
        }

        let related_json = serde_json::to_string(&related)?;
        Ok(GetRelatedOutput::Ok {
            node_id: input.node_id,
            related: related_json,
        })
    }
}
