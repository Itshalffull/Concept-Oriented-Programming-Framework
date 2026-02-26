// generated: collection/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::CollectionHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn collection_invariant_1() {
        // invariant 1: after create, addMember, getMembers behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(collection: c, type: "list", schema: "default") -> ok()
        let step1 = handler.create(
            CreateInput { collection: c.clone(), type: "list".to_string(), schema: "default".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, CreateOutput::Ok));

        // --- THEN clause ---
        // addMember(collection: c, member: "item1") -> ok()
        let step2 = handler.add_member(
            AddMemberInput { collection: c.clone(), member: "item1".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, AddMemberOutput::Ok));
        // getMembers(collection: c) -> ok(members: "item1")
        let step3 = handler.get_members(
            GetMembersInput { collection: c.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            GetMembersOutput::Ok { members, .. } => {
                assert_eq!(members, "item1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
