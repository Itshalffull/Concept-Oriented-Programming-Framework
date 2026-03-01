// generated: file_artifact/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FileArtifactHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn file_artifact_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(node: "src/handler.ts", role: "source", language: "typescript") -> ok(artifact: a)
        let step1 = handler.register(
            RegisterInput { node: "src/handler.ts".to_string(), role: "source".to_string(), language: "typescript".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { artifact, .. } => {
                assert_eq!(artifact, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(artifact: a) -> ok(artifact: a, node: "src/handler.ts", role: "source", language: "typescript", encoding: "utf-8")
        let step2 = handler.get(
            GetInput { artifact: a.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { artifact, node, role, language, encoding, .. } => {
                assert_eq!(artifact, a.clone());
                assert_eq!(node, "src/handler.ts".to_string());
                assert_eq!(role, "source".to_string());
                assert_eq!(language, "typescript".to_string());
                assert_eq!(encoding, "utf-8".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn file_artifact_invariant_2() {
        // invariant 2: after register, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(node: "specs/app/user.concept", role: "spec", language: "concept-spec") -> ok(artifact: a)
        let step1 = handler.register(
            RegisterInput { node: "specs/app/user.concept".to_string(), role: "spec".to_string(), language: "concept-spec".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { artifact, .. } => {
                assert_eq!(artifact, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // register(node: "specs/app/user.concept", role: "spec", language: "concept-spec") -> alreadyRegistered(existing: a)
        let step2 = handler.register(
            RegisterInput { node: "specs/app/user.concept".to_string(), role: "spec".to_string(), language: "concept-spec".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::AlreadyRegistered { existing, .. } => {
                assert_eq!(existing, a.clone());
            },
            other => panic!("Expected AlreadyRegistered, got {:?}", other),
        }
    }

}
