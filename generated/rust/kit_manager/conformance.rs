// generated: kit_manager/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::KitManagerHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn kit_manager_invariant_1() {
        // invariant 1: after init, validate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let k = "u-test-invariant-001".to_string();
        let k2 = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // init(name: "my-kit") -> ok(kit: k, path: "./kits/my-kit/")
        let step1 = handler.init(
            InitInput { name: "my-kit".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            InitOutput::Ok { kit, path, .. } => {
                assert_eq!(kit, k.clone());
                assert_eq!(path, "./kits/my-kit/".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // validate(path: "./kits/my-kit/") -> ok(kit: k2, concepts: 0, syncs: 0)
        let step2 = handler.validate(
            ValidateInput { path: "./kits/my-kit/".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ValidateOutput::Ok { kit, concepts, syncs, .. } => {
                assert_eq!(kit, k2.clone());
                assert_eq!(concepts, 0);
                assert_eq!(syncs, 0);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
