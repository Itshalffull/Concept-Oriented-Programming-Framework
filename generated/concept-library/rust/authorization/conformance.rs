// generated: authorization/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::AuthorizationHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn authorization_invariant_1() {
        // invariant 1: after grantPermission, assignRole, checkPermission behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // grantPermission(role: "admin", permission: "write") -> ok(role: "admin", permission: "write")
        let step1 = handler.grant_permission(
            GrantPermissionInput { role: "admin".to_string(), permission: "write".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GrantPermissionOutput::Ok { role, permission, .. } => {
                assert_eq!(role, "admin".to_string());
                assert_eq!(permission, "write".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // assignRole(user: x, role: "admin") -> ok(user: x, role: "admin")
        let step2 = handler.assign_role(
            AssignRoleInput { user: x.clone(), role: "admin".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            AssignRoleOutput::Ok { user, role, .. } => {
                assert_eq!(user, x.clone());
                assert_eq!(role, "admin".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // checkPermission(user: x, permission: "write") -> ok(granted: true)
        let step3 = handler.check_permission(
            CheckPermissionInput { user: x.clone(), permission: "write".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            CheckPermissionOutput::Ok { granted, .. } => {
                assert_eq!(granted, true);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn authorization_invariant_2() {
        // invariant 2: after grantPermission, assignRole, revokePermission, checkPermission behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // grantPermission(role: "editor", permission: "publish") -> ok(role: "editor", permission: "publish")
        let step1 = handler.grant_permission(
            GrantPermissionInput { role: "editor".to_string(), permission: "publish".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GrantPermissionOutput::Ok { role, permission, .. } => {
                assert_eq!(role, "editor".to_string());
                assert_eq!(permission, "publish".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // assignRole(user: x, role: "editor") -> ok(user: x, role: "editor")
        let step2 = handler.assign_role(
            AssignRoleInput { user: x.clone(), role: "editor".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            AssignRoleOutput::Ok { user, role, .. } => {
                assert_eq!(user, x.clone());
                assert_eq!(role, "editor".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // revokePermission(role: "editor", permission: "publish") -> ok(role: "editor", permission: "publish")
        let step3 = handler.revoke_permission(
            RevokePermissionInput { role: "editor".to_string(), permission: "publish".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            RevokePermissionOutput::Ok { role, permission, .. } => {
                assert_eq!(role, "editor".to_string());
                assert_eq!(permission, "publish".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // checkPermission(user: x, permission: "publish") -> ok(granted: false)
        let step4 = handler.check_permission(
            CheckPermissionInput { user: x.clone(), permission: "publish".to_string() },
            &storage,
        ).await.unwrap();
        match step4 {
            CheckPermissionOutput::Ok { granted, .. } => {
                assert_eq!(granted, false);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
