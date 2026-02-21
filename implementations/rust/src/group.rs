// Group Concept Implementation (Rust)
//
// Collaboration kit — creates groups, manages membership with roles,
// associates content with groups, and checks group-level access.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── CreateGroup ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupCreateGroupInput {
    pub name: String,
    pub group_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GroupCreateGroupOutput {
    #[serde(rename = "ok")]
    Ok { group_id: String },
}

// ── AddMember ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupAddMemberInput {
    pub group_id: String,
    pub user_id: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GroupAddMemberOutput {
    #[serde(rename = "ok")]
    Ok { group_id: String, user_id: String },
    #[serde(rename = "group_notfound")]
    GroupNotFound { message: String },
}

// ── AddContent ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupAddContentInput {
    pub group_id: String,
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GroupAddContentOutput {
    #[serde(rename = "ok")]
    Ok { group_id: String, node_id: String },
    #[serde(rename = "group_notfound")]
    GroupNotFound { message: String },
}

// ── CheckGroupAccess ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupCheckGroupAccessInput {
    pub group_id: String,
    pub entity_id: String,
    pub operation: String,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GroupCheckGroupAccessOutput {
    #[serde(rename = "ok")]
    Ok { allowed: bool },
    #[serde(rename = "group_notfound")]
    GroupNotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct GroupHandler;

impl GroupHandler {
    pub async fn create_group(
        &self,
        input: GroupCreateGroupInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GroupCreateGroupOutput> {
        let group_id = format!("grp_{}", rand::random::<u32>());
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "group",
                &group_id,
                json!({
                    "group_id": group_id,
                    "name": input.name,
                    "group_type": input.group_type,
                    "created_at": now,
                }),
            )
            .await?;
        Ok(GroupCreateGroupOutput::Ok { group_id })
    }

    pub async fn add_member(
        &self,
        input: GroupAddMemberInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GroupAddMemberOutput> {
        let group = storage.get("group", &input.group_id).await?;
        if group.is_none() {
            return Ok(GroupAddMemberOutput::GroupNotFound {
                message: format!("group '{}' not found", input.group_id),
            });
        }

        let key = format!("{}:{}", input.group_id, input.user_id);
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "group_membership",
                &key,
                json!({
                    "group_id": input.group_id,
                    "user_id": input.user_id,
                    "role": input.role,
                    "joined_at": now,
                }),
            )
            .await?;
        Ok(GroupAddMemberOutput::Ok {
            group_id: input.group_id,
            user_id: input.user_id,
        })
    }

    pub async fn add_content(
        &self,
        input: GroupAddContentInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GroupAddContentOutput> {
        let group = storage.get("group", &input.group_id).await?;
        if group.is_none() {
            return Ok(GroupAddContentOutput::GroupNotFound {
                message: format!("group '{}' not found", input.group_id),
            });
        }

        let key = format!("{}:{}", input.group_id, input.node_id);
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "group_content",
                &key,
                json!({
                    "group_id": input.group_id,
                    "node_id": input.node_id,
                    "added_at": now,
                }),
            )
            .await?;
        Ok(GroupAddContentOutput::Ok {
            group_id: input.group_id,
            node_id: input.node_id,
        })
    }

    pub async fn check_group_access(
        &self,
        input: GroupCheckGroupAccessInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GroupCheckGroupAccessOutput> {
        let group = storage.get("group", &input.group_id).await?;
        if group.is_none() {
            return Ok(GroupCheckGroupAccessOutput::GroupNotFound {
                message: format!("group '{}' not found", input.group_id),
            });
        }

        // Check if the user is a member of the group
        let membership_key = format!("{}:{}", input.group_id, input.user_id);
        let membership = storage
            .get("group_membership", &membership_key)
            .await?;

        let allowed = membership.is_some();
        Ok(GroupCheckGroupAccessOutput::Ok { allowed })
    }
}
