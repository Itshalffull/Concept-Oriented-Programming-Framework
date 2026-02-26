// generated: alias/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::AliasHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn alias_invariant_1() {
        // invariant 1: after addAlias, resolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // addAlias(entity: x, name: "homepage") -> ok(entity: x, name: "homepage")
        let step1 = handler.add_alias(
            AddAliasInput { entity: x.clone(), name: "homepage".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AddAliasOutput::Ok { entity, name, .. } => {
                assert_eq!(entity, x.clone());
                assert_eq!(name, "homepage".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // resolve(name: "homepage") -> ok(entity: x)
        let step2 = handler.resolve(
            ResolveInput { name: "homepage".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ResolveOutput::Ok { entity, .. } => {
                assert_eq!(entity, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
