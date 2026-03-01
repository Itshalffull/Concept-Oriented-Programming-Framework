// Group concept implementation
// Group RBAC: create groups, manage membership with roles, content association, permission checks.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::GroupHandler;
use serde_json::json;
use std::collections::HashMap;
use chrono::Utc;

pub struct GroupHandlerImpl;

/// Map roles to their permitted operations
fn role_permissions() -> HashMap<&'static str, Vec<&'static str>> {
    let mut m = HashMap::new();
    m.insert("owner", vec!["read", "write", "delete", "admin", "invite", "manage_roles", "manage_content"]);
    m.insert("admin", vec!["read", "write", "delete", "invite", "manage_roles", "manage_content"]);
    m.insert("moderator", vec!["read", "write", "delete", "manage_content"]);
    m.insert("editor", vec!["read", "write", "manage_content"]);
    m.insert("contributor", vec!["read", "write"]);
    m.insert("member", vec!["read", "write"]);
    m.insert("viewer", vec!["read"]);
    m.insert("guest", vec!["read"]);
    m
}

#[async_trait]
impl GroupHandler for GroupHandlerImpl {
    async fn create_group(
        &self,
        input: GroupCreateGroupInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GroupCreateGroupOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("group", &input.group).await?;
        if existing.is_some() {
            return Ok(GroupCreateGroupOutput::Exists {
                message: format!("Group {} already exists", input.group),
            });
        }

        storage.put("group", &input.group, json!({
            "group": input.group,
            "name": input.name,
            "members": "[]",
            "content": "[]",
            "createdAt": Utc::now().to_rfc3339(),
        })).await?;

        Ok(GroupCreateGroupOutput::Ok)
    }

    async fn add_member(
        &self,
        input: GroupAddMemberInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GroupAddMemberOutput, Box<dyn std::error::Error>> {
        let record = storage.get("group", &input.group).await?;
        let Some(mut group) = record else {
            return Ok(GroupAddMemberOutput::Notfound {
                message: format!("Group {} not found", input.group),
            });
        };

        let mut members: Vec<serde_json::Value> = group.get("members")
            .and_then(|v| v.as_str())
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        // Check if user is already a member
        let already_member = members.iter().any(|m| {
            m.get("user").and_then(|u| u.as_str()) == Some(&input.user)
        });

        if !already_member {
            members.push(json!({
                "user": input.user,
                "role": input.role,
                "joinedAt": Utc::now().to_rfc3339(),
            }));

            group["members"] = json!(serde_json::to_string(&members)?);
            storage.put("group", &input.group, group).await?;
        }

        Ok(GroupAddMemberOutput::Ok)
    }

    async fn assign_group_role(
        &self,
        input: GroupAssignGroupRoleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GroupAssignGroupRoleOutput, Box<dyn std::error::Error>> {
        let record = storage.get("group", &input.group).await?;
        let Some(mut group) = record else {
            return Ok(GroupAssignGroupRoleOutput::Notfound {
                message: format!("Group {} not found", input.group),
            });
        };

        let mut members: Vec<serde_json::Value> = group.get("members")
            .and_then(|v| v.as_str())
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        let mut found = false;
        for member in &mut members {
            if member.get("user").and_then(|u| u.as_str()) == Some(&input.user) {
                member["role"] = json!(input.role);
                found = true;
                break;
            }
        }

        if !found {
            return Ok(GroupAssignGroupRoleOutput::Notfound {
                message: format!("User {} not found in group {}", input.user, input.group),
            });
        }

        group["members"] = json!(serde_json::to_string(&members)?);
        storage.put("group", &input.group, group).await?;

        Ok(GroupAssignGroupRoleOutput::Ok)
    }

    async fn add_content(
        &self,
        input: GroupAddContentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GroupAddContentOutput, Box<dyn std::error::Error>> {
        let record = storage.get("group", &input.group).await?;
        let Some(mut group) = record else {
            return Ok(GroupAddContentOutput::Notfound {
                message: format!("Group {} not found", input.group),
            });
        };

        let mut content: Vec<String> = group.get("content")
            .and_then(|v| v.as_str())
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        if !content.contains(&input.content) {
            content.push(input.content);
        }

        group["content"] = json!(serde_json::to_string(&content)?);
        storage.put("group", &input.group, group).await?;

        Ok(GroupAddContentOutput::Ok)
    }

    async fn check_group_access(
        &self,
        input: GroupCheckGroupAccessInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GroupCheckGroupAccessOutput, Box<dyn std::error::Error>> {
        let record = storage.get("group", &input.group).await?;
        let Some(group) = record else {
            return Ok(GroupCheckGroupAccessOutput::Notfound {
                message: format!("Group {} not found", input.group),
            });
        };

        let members: Vec<serde_json::Value> = group.get("members")
            .and_then(|v| v.as_str())
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        // Find the user's role in the group
        let user_role = members.iter()
            .find(|m| m.get("user").and_then(|u| u.as_str()) == Some(&input.user))
            .and_then(|m| m.get("role").and_then(|r| r.as_str()));

        let Some(role) = user_role else {
            return Ok(GroupCheckGroupAccessOutput::Ok { granted: false });
        };

        // Check if the role has the requested permission
        let permissions_map = role_permissions();
        let granted = permissions_map.get(role)
            .map(|perms| perms.contains(&input.permission.as_str()))
            .unwrap_or(false);

        Ok(GroupCheckGroupAccessOutput::Ok { granted })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_group_success() {
        let storage = InMemoryStorage::new();
        let handler = GroupHandlerImpl;
        let result = handler.create_group(
            GroupCreateGroupInput { group: "devs".to_string(), name: "Developers".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GroupCreateGroupOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_group_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = GroupHandlerImpl;
        handler.create_group(
            GroupCreateGroupInput { group: "devs".to_string(), name: "Developers".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.create_group(
            GroupCreateGroupInput { group: "devs".to_string(), name: "Devs 2".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GroupCreateGroupOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_add_member_notfound() {
        let storage = InMemoryStorage::new();
        let handler = GroupHandlerImpl;
        let result = handler.add_member(
            GroupAddMemberInput {
                group: "missing".to_string(),
                user: "alice".to_string(),
                role: "member".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GroupAddMemberOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_add_member_and_check_access() {
        let storage = InMemoryStorage::new();
        let handler = GroupHandlerImpl;
        handler.create_group(
            GroupCreateGroupInput { group: "team".to_string(), name: "Team".to_string() },
            &storage,
        ).await.unwrap();
        handler.add_member(
            GroupAddMemberInput { group: "team".to_string(), user: "alice".to_string(), role: "admin".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.check_group_access(
            GroupCheckGroupAccessInput {
                group: "team".to_string(),
                user: "alice".to_string(),
                permission: "write".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GroupCheckGroupAccessOutput::Ok { granted } => {
                assert!(granted);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_check_group_access_notfound() {
        let storage = InMemoryStorage::new();
        let handler = GroupHandlerImpl;
        let result = handler.check_group_access(
            GroupCheckGroupAccessInput {
                group: "missing".to_string(),
                user: "alice".to_string(),
                permission: "read".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GroupCheckGroupAccessOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_assign_group_role_notfound() {
        let storage = InMemoryStorage::new();
        let handler = GroupHandlerImpl;
        let result = handler.assign_group_role(
            GroupAssignGroupRoleInput {
                group: "missing".to_string(),
                user: "alice".to_string(),
                role: "admin".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GroupAssignGroupRoleOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_add_content_notfound() {
        let storage = InMemoryStorage::new();
        let handler = GroupHandlerImpl;
        let result = handler.add_content(
            GroupAddContentInput { group: "missing".to_string(), content: "doc-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GroupAddContentOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
