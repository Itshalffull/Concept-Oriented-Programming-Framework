// generated: group/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::GroupHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn group_invariant_1() {
        // invariant 1: after createGroup, addMember, checkGroupAccess behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let g = "u-test-invariant-001".to_string();
        let n = "u-test-invariant-002".to_string();
        let u = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // createGroup(group: g, name: n) -> ok()
        let step1 = handler.create_group(
            CreateGroupInput { group: g.clone(), name: n.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, CreateGroupOutput::Ok));

        // --- THEN clause ---
        // addMember(group: g, user: u, role: "member") -> ok()
        let step2 = handler.add_member(
            AddMemberInput { group: g.clone(), user: u.clone(), role: "member".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, AddMemberOutput::Ok));
        // checkGroupAccess(group: g, user: u, permission: "read") -> ok(granted: true)
        let step3 = handler.check_group_access(
            CheckGroupAccessInput { group: g.clone(), user: u.clone(), permission: "read".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            CheckGroupAccessOutput::Ok { granted, .. } => {
                assert_eq!(granted, true);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
