// generated: relation/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::RelationHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn relation_invariant_1() {
        // invariant 1: after defineRelation, link, getRelated behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // defineRelation(relation: r, schema: "parent-child") -> ok(relation: r)
        let step1 = handler.define_relation(
            DefineRelationInput { relation: r.clone(), schema: "parent-child".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            DefineRelationOutput::Ok { relation, .. } => {
                assert_eq!(relation, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // link(relation: r, source: "alice", target: "bob") -> ok(relation: r, source: "alice", target: "bob")
        let step2 = handler.link(
            LinkInput { relation: r.clone(), source: "alice".to_string(), target: "bob".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            LinkOutput::Ok { relation, source, target, .. } => {
                assert_eq!(relation, r.clone());
                assert_eq!(source, "alice".to_string());
                assert_eq!(target, "bob".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // getRelated(relation: r, entity: "alice") -> ok(related: "bob")
        let step3 = handler.get_related(
            GetRelatedInput { relation: r.clone(), entity: "alice".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            GetRelatedOutput::Ok { related, .. } => {
                assert_eq!(related, "bob".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
