// generated: grpc_target/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::GrpcTargetHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn grpc_target_invariant_1() {
        // invariant 1: after generate, listRpcs behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let r = "u-test-invariant-003".to_string();
        let m = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // generate(projection: "payment-projection", config: "{}") -> ok(services: s, files: f)
        let step1 = handler.generate(
            GenerateInput { projection: "payment-projection".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { services, files, .. } => {
                assert_eq!(services, s.clone());
                assert_eq!(files, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // listRpcs(concept: "Payment") -> ok(rpcs: r, streamingModes: m)
        let step2 = handler.list_rpcs(
            ListRpcsInput { concept: "Payment".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ListRpcsOutput::Ok { rpcs, streaming_modes, .. } => {
                assert_eq!(rpcs, r.clone());
                assert_eq!(streaming_modes, m.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
