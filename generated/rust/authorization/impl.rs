// Authorization concept implementation
// Manage roles, permissions, and permission-checking for users.
// Roles group permissions into reusable bundles; users inherit permissions through role assignment.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AuthorizationHandler;
use serde_json::json;

pub struct AuthorizationHandlerImpl;

#[async_trait]
impl AuthorizationHandler for AuthorizationHandlerImpl {
    async fn grant_permission(
        &self,
        input: AuthorizationGrantPermissionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthorizationGrantPermissionOutput, Box<dyn std::error::Error>> {
        // Ensure the role exists; create it if this is the first grant
        let role_record = storage.get("role", &input.role).await?;
        let mut permissions: Vec<String> = match &role_record {
            Some(r) => serde_json::from_str(r["permissions"].as_str().unwrap_or("[]"))?,
            None => Vec::new(),
        };

        // Idempotent: if permission is already granted, still return ok
        if !permissions.contains(&input.permission) {
            permissions.push(input.permission.clone());
        }

        storage.put("role", &input.role, json!({
            "role": input.role,
            "permissions": serde_json::to_string(&permissions)?,
        })).await?;

        Ok(AuthorizationGrantPermissionOutput::Ok {
            role: input.role,
            permission: input.permission,
        })
    }

    async fn revoke_permission(
        &self,
        input: AuthorizationRevokePermissionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthorizationRevokePermissionOutput, Box<dyn std::error::Error>> {
        let role_record = storage.get("role", &input.role).await?;
        let role_record = match role_record {
            Some(r) => r,
            None => return Ok(AuthorizationRevokePermissionOutput::Notfound {
                message: "The specified role does not exist".to_string(),
            }),
        };

        let mut permissions: Vec<String> = serde_json::from_str(
            role_record["permissions"].as_str().unwrap_or("[]")
        )?;

        if let Some(idx) = permissions.iter().position(|p| p == &input.permission) {
            permissions.remove(idx);
        } else {
            return Ok(AuthorizationRevokePermissionOutput::Notfound {
                message: "The specified permission does not exist on this role".to_string(),
            });
        }

        storage.put("role", &input.role, json!({
            "role": input.role,
            "permissions": serde_json::to_string(&permissions)?,
        })).await?;

        Ok(AuthorizationRevokePermissionOutput::Ok {
            role: input.role,
            permission: input.permission,
        })
    }

    async fn assign_role(
        &self,
        input: AuthorizationAssignRoleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthorizationAssignRoleOutput, Box<dyn std::error::Error>> {
        // Verify the role exists
        let role_record = storage.get("role", &input.role).await?;
        if role_record.is_none() {
            return Ok(AuthorizationAssignRoleOutput::Notfound {
                message: "The specified role does not exist".to_string(),
            });
        }

        // Get or create the user's role set
        let user_record = storage.get("userRole", &input.user).await?;
        let mut roles: Vec<String> = match &user_record {
            Some(r) => serde_json::from_str(r["roles"].as_str().unwrap_or("[]"))?,
            None => Vec::new(),
        };

        if !roles.contains(&input.role) {
            roles.push(input.role.clone());
        }

        storage.put("userRole", &input.user, json!({
            "user": input.user,
            "roles": serde_json::to_string(&roles)?,
        })).await?;

        Ok(AuthorizationAssignRoleOutput::Ok {
            user: input.user,
            role: input.role,
        })
    }

    async fn check_permission(
        &self,
        input: AuthorizationCheckPermissionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthorizationCheckPermissionOutput, Box<dyn std::error::Error>> {
        // Get the user's assigned roles
        let user_record = storage.get("userRole", &input.user).await?;
        let user_record = match user_record {
            Some(r) => r,
            None => return Ok(AuthorizationCheckPermissionOutput::Ok { granted: false }),
        };

        let roles: Vec<String> = serde_json::from_str(
            user_record["roles"].as_str().unwrap_or("[]")
        )?;

        // Check each role for the requested permission
        for role_name in &roles {
            let role_record = storage.get("role", role_name).await?;
            if let Some(r) = role_record {
                let permissions: Vec<String> = serde_json::from_str(
                    r["permissions"].as_str().unwrap_or("[]")
                )?;
                if permissions.contains(&input.permission) {
                    return Ok(AuthorizationCheckPermissionOutput::Ok { granted: true });
                }
            }
        }

        Ok(AuthorizationCheckPermissionOutput::Ok { granted: false })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_grant_permission_creates_role() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandlerImpl;
        let result = handler.grant_permission(
            AuthorizationGrantPermissionInput {
                role: "admin".to_string(),
                permission: "article:write".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AuthorizationGrantPermissionOutput::Ok { role, permission } => {
                assert_eq!(role, "admin");
                assert_eq!(permission, "article:write");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_revoke_permission_success() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandlerImpl;
        handler.grant_permission(
            AuthorizationGrantPermissionInput {
                role: "editor".to_string(),
                permission: "article:edit".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.revoke_permission(
            AuthorizationRevokePermissionInput {
                role: "editor".to_string(),
                permission: "article:edit".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AuthorizationRevokePermissionOutput::Ok { role, permission } => {
                assert_eq!(role, "editor");
                assert_eq!(permission, "article:edit");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_revoke_permission_nonexistent_role_returns_notfound() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandlerImpl;
        let result = handler.revoke_permission(
            AuthorizationRevokePermissionInput {
                role: "nonexistent".to_string(),
                permission: "any".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AuthorizationRevokePermissionOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_assign_role_success() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandlerImpl;
        handler.grant_permission(
            AuthorizationGrantPermissionInput {
                role: "viewer".to_string(),
                permission: "article:read".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.assign_role(
            AuthorizationAssignRoleInput {
                user: "user-1".to_string(),
                role: "viewer".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AuthorizationAssignRoleOutput::Ok { user, role } => {
                assert_eq!(user, "user-1");
                assert_eq!(role, "viewer");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_assign_role_nonexistent_returns_notfound() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandlerImpl;
        let result = handler.assign_role(
            AuthorizationAssignRoleInput {
                user: "user-1".to_string(),
                role: "ghost".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AuthorizationAssignRoleOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_check_permission_granted() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandlerImpl;
        handler.grant_permission(
            AuthorizationGrantPermissionInput {
                role: "writer".to_string(),
                permission: "article:create".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.assign_role(
            AuthorizationAssignRoleInput {
                user: "user-2".to_string(),
                role: "writer".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.check_permission(
            AuthorizationCheckPermissionInput {
                user: "user-2".to_string(),
                permission: "article:create".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AuthorizationCheckPermissionOutput::Ok { granted } => {
                assert!(granted);
            }
        }
    }

    #[tokio::test]
    async fn test_check_permission_denied() {
        let storage = InMemoryStorage::new();
        let handler = AuthorizationHandlerImpl;
        let result = handler.check_permission(
            AuthorizationCheckPermissionInput {
                user: "nobody".to_string(),
                permission: "admin:nuke".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AuthorizationCheckPermissionOutput::Ok { granted } => {
                assert!(!granted);
            }
        }
    }
}
