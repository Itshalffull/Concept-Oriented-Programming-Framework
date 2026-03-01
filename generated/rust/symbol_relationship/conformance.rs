// generated: symbol_relationship/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SymbolRelationshipHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn symbol_relationship_invariant_1() {
        // invariant 1: after add, findFrom behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // add(source: "ts/class/Handler", target: "ts/interface/IHandler", kind: "implements") -> ok(relationship: r)
        let step1 = handler.add(
            AddInput { source: "ts/class/Handler".to_string(), target: "ts/interface/IHandler".to_string(), kind: "implements".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AddOutput::Ok { relationship, .. } => {
                assert_eq!(relationship, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // findFrom(source: "ts/class/Handler", kind: "implements") -> ok(relationships: _)
        let step2 = handler.find_from(
            FindFromInput { source: "ts/class/Handler".to_string(), kind: "implements".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            FindFromOutput::Ok { relationships, .. } => {
                assert_eq!(relationships, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn symbol_relationship_invariant_2() {
        // invariant 2: after add, add behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // add(source: "ts/class/Handler", target: "ts/interface/IHandler", kind: "implements") -> ok(relationship: r)
        let step1 = handler.add(
            AddInput { source: "ts/class/Handler".to_string(), target: "ts/interface/IHandler".to_string(), kind: "implements".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AddOutput::Ok { relationship, .. } => {
                assert_eq!(relationship, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // add(source: "ts/class/Handler", target: "ts/interface/IHandler", kind: "implements") -> alreadyExists(existing: r)
        let step2 = handler.add(
            AddInput { source: "ts/class/Handler".to_string(), target: "ts/interface/IHandler".to_string(), kind: "implements".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            AddOutput::AlreadyExists { existing, .. } => {
                assert_eq!(existing, r.clone());
            },
            other => panic!("Expected AlreadyExists, got {:?}", other),
        }
    }

}
