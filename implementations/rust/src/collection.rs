// Collection Concept Implementation (Rust)
//
// Manages concrete and virtual collections of content nodes.
// See Architecture doc Sections on collection management.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Create ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInput {
    pub name: String,
    pub collection_type: String,
    pub schema_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CreateOutput {
    #[serde(rename = "ok")]
    Ok { collection_id: String },
}

// ── AddMember ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddMemberInput {
    pub collection_id: String,
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AddMemberOutput {
    #[serde(rename = "ok")]
    Ok { collection_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── RemoveMember ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveMemberInput {
    pub collection_id: String,
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RemoveMemberOutput {
    #[serde(rename = "ok")]
    Ok { collection_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── GetMembers ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetMembersInput {
    pub collection_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetMembersOutput {
    #[serde(rename = "ok")]
    Ok {
        collection_id: String,
        members: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct CollectionHandler;

impl CollectionHandler {
    pub async fn create(
        &self,
        input: CreateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CreateOutput> {
        let collection_id = format!(
            "col_{}",
            input.name.to_lowercase().replace(' ', "_")
        );

        storage
            .put(
                "collection",
                &collection_id,
                json!({
                    "collection_id": collection_id,
                    "name": input.name,
                    "collection_type": input.collection_type,
                    "schema_id": input.schema_id,
                }),
            )
            .await?;

        Ok(CreateOutput::Ok { collection_id })
    }

    pub async fn add_member(
        &self,
        input: AddMemberInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddMemberOutput> {
        let existing = storage.get("collection", &input.collection_id).await?;

        if existing.is_none() {
            return Ok(AddMemberOutput::NotFound {
                message: format!("Collection '{}' not found", input.collection_id),
            });
        }

        let member_key = format!("{}:{}", input.collection_id, input.node_id);
        storage
            .put(
                "collection_member",
                &member_key,
                json!({
                    "collection_id": input.collection_id,
                    "node_id": input.node_id,
                }),
            )
            .await?;

        Ok(AddMemberOutput::Ok {
            collection_id: input.collection_id,
        })
    }

    pub async fn remove_member(
        &self,
        input: RemoveMemberInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RemoveMemberOutput> {
        let member_key = format!("{}:{}", input.collection_id, input.node_id);
        let existing = storage.get("collection_member", &member_key).await?;

        if existing.is_none() {
            return Ok(RemoveMemberOutput::NotFound {
                message: format!(
                    "Node '{}' not found in collection '{}'",
                    input.node_id, input.collection_id
                ),
            });
        }

        storage.del("collection_member", &member_key).await?;

        Ok(RemoveMemberOutput::Ok {
            collection_id: input.collection_id,
        })
    }

    pub async fn get_members(
        &self,
        input: GetMembersInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetMembersOutput> {
        let existing = storage.get("collection", &input.collection_id).await?;

        if existing.is_none() {
            return Ok(GetMembersOutput::NotFound {
                message: format!("Collection '{}' not found", input.collection_id),
            });
        }

        let all_members = storage
            .find(
                "collection_member",
                Some(&json!({ "collection_id": input.collection_id })),
            )
            .await?;

        let member_ids: Vec<String> = all_members
            .iter()
            .filter_map(|m| m["node_id"].as_str().map(String::from))
            .collect();

        Ok(GetMembersOutput::Ok {
            collection_id: input.collection_id,
            members: serde_json::to_string(&member_ids)?,
        })
    }
}
