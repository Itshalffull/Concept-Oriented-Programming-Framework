// generated: project_scaffold/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ProjectScaffoldHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn project_scaffold_invariant_1() {
        // invariant 1: after scaffold, scaffold behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // scaffold(name: "my-app") -> ok(project: p, path: "./my-app/")
        let step1 = handler.scaffold(
            ScaffoldInput { name: "my-app".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ScaffoldOutput::Ok { project, path, .. } => {
                assert_eq!(project, p.clone());
                assert_eq!(path, "./my-app/".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // scaffold(name: "my-app") -> alreadyExists(name: "my-app")
        let step2 = handler.scaffold(
            ScaffoldInput { name: "my-app".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ScaffoldOutput::AlreadyExists { name, .. } => {
                assert_eq!(name, "my-app".to_string());
            },
            other => panic!("Expected AlreadyExists, got {:?}", other),
        }
    }

}
