// Authorization Concept Implementation (Rust)
//
// Role-based permission management — grant/revoke permissions on roles,
// assign roles to users, and check user permissions.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- GrantPermission ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrantPermissionInput {
    pub role_id: String,
    pub permission_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GrantPermissionOutput {
    #[serde(rename = "ok")]
    Ok {
        role_id: String,
        permission_id: String,
    },
}

// --- RevokePermission ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevokePermissionInput {
    pub role_id: String,
    pub permission_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RevokePermissionOutput {
    #[serde(rename = "ok")]
    Ok {
        role_id: String,
        permission_id: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- AssignRole ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignRoleInput {
    pub user_id: String,
    pub role_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AssignRoleOutput {
    #[serde(rename = "ok")]
    Ok {
        user_id: String,
        role_id: String,
    },
}

// --- CheckPermission ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckPermissionInput {
    pub user_id: String,
    pub permission_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CheckPermissionOutput {
    #[serde(rename = "ok")]
    Ok { allowed: bool },
}

pub struct AuthorizationHandler;

impl AuthorizationHandler {
    pub async fn grant_permission(
        &self,
        input: GrantPermissionInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GrantPermissionOutput> {
        let compound_key = format!("{}:{}", input.role_id, input.permission_id);
        storage
            .put(
                "permission",
                &compound_key,
                json!({
                    "role_id": input.role_id,
                    "permission_id": input.permission_id,
                    "granted_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        // Ensure the role record exists
        let role = storage.get("role", &input.role_id).await?;
        if role.is_none() {
            storage
                .put(
                    "role",
                    &input.role_id,
                    json!({
                        "role_id": input.role_id,
                        "created_at": chrono::Utc::now().to_rfc3339(),
                    }),
                )
                .await?;
        }

        Ok(GrantPermissionOutput::Ok {
            role_id: input.role_id,
            permission_id: input.permission_id,
        })
    }

    pub async fn revoke_permission(
        &self,
        input: RevokePermissionInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RevokePermissionOutput> {
        let compound_key = format!("{}:{}", input.role_id, input.permission_id);
        let existing = storage.get("permission", &compound_key).await?;
        match existing {
            None => Ok(RevokePermissionOutput::NotFound {
                message: format!(
                    "permission '{}' not found on role '{}'",
                    input.permission_id, input.role_id
                ),
            }),
            Some(_) => {
                storage.del("permission", &compound_key).await?;
                Ok(RevokePermissionOutput::Ok {
                    role_id: input.role_id,
                    permission_id: input.permission_id,
                })
            }
        }
    }

    pub async fn assign_role(
        &self,
        input: AssignRoleInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AssignRoleOutput> {
        let compound_key = format!("{}:{}", input.user_id, input.role_id);
        storage
            .put(
                "user_role",
                &compound_key,
                json!({
                    "user_id": input.user_id,
                    "role_id": input.role_id,
                    "assigned_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(AssignRoleOutput::Ok {
            user_id: input.user_id,
            role_id: input.role_id,
        })
    }

    pub async fn check_permission(
        &self,
        input: CheckPermissionInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CheckPermissionOutput> {
        // Find all roles assigned to the user
        let user_roles = storage
            .find("user_role", Some(&json!({ "user_id": input.user_id })))
            .await?;

        // Check if any of the user's roles have the requested permission
        for user_role in &user_roles {
            if let Some(role_id) = user_role.get("role_id").and_then(|v| v.as_str()) {
                let compound_key = format!("{}:{}", role_id, input.permission_id);
                let perm = storage.get("permission", &compound_key).await?;
                if perm.is_some() {
                    return Ok(CheckPermissionOutput::Ok { allowed: true });
                }
            }
        }

        Ok(CheckPermissionOutput::Ok { allowed: false })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // --- grant_permission ---

    #[tokio::test]
    async fn grant_permission_stores_permission() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandler;

        let result = handler
            .grant_permission(
                GrantPermissionInput {
                    role_id: "admin".into(),
                    permission_id: "read".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GrantPermissionOutput::Ok { role_id, permission_id } => {
                assert_eq!(role_id, "admin");
                assert_eq!(permission_id, "read");
            }
        }
    }

    #[tokio::test]
    async fn grant_permission_creates_role_record() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandler;

        handler
            .grant_permission(
                GrantPermissionInput {
                    role_id: "editor".into(),
                    permission_id: "write".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let role = storage.get("role", "editor").await.unwrap();
        assert!(role.is_some());
    }

    // --- revoke_permission ---

    #[tokio::test]
    async fn revoke_permission_removes_existing() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandler;

        handler
            .grant_permission(
                GrantPermissionInput {
                    role_id: "admin".into(),
                    permission_id: "delete".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .revoke_permission(
                RevokePermissionInput {
                    role_id: "admin".into(),
                    permission_id: "delete".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RevokePermissionOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn revoke_permission_not_found() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandler;

        let result = handler
            .revoke_permission(
                RevokePermissionInput {
                    role_id: "admin".into(),
                    permission_id: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RevokePermissionOutput::NotFound { .. }));
    }

    // --- assign_role ---

    #[tokio::test]
    async fn assign_role_stores_assignment() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandler;

        let result = handler
            .assign_role(
                AssignRoleInput {
                    user_id: "user1".into(),
                    role_id: "admin".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            AssignRoleOutput::Ok { user_id, role_id } => {
                assert_eq!(user_id, "user1");
                assert_eq!(role_id, "admin");
            }
        }
    }

    #[tokio::test]
    async fn assign_role_persists_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandler;

        handler
            .assign_role(
                AssignRoleInput {
                    user_id: "user1".into(),
                    role_id: "editor".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("user_role", "user1:editor").await.unwrap();
        assert!(record.is_some());
    }

    // --- check_permission ---

    #[tokio::test]
    async fn check_permission_allowed_when_granted() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandler;

        handler
            .grant_permission(
                GrantPermissionInput {
                    role_id: "admin".into(),
                    permission_id: "delete".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .assign_role(
                AssignRoleInput {
                    user_id: "user1".into(),
                    role_id: "admin".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .check_permission(
                CheckPermissionInput {
                    user_id: "user1".into(),
                    permission_id: "delete".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            CheckPermissionOutput::Ok { allowed } => assert!(allowed),
        }
    }

    #[tokio::test]
    async fn check_permission_denied_when_not_granted() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandler;

        let result = handler
            .check_permission(
                CheckPermissionInput {
                    user_id: "user1".into(),
                    permission_id: "delete".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            CheckPermissionOutput::Ok { allowed } => assert!(!allowed),
        }
    }
}
