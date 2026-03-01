// generated: surface/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SurfaceHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn surface_invariant_1() {
        // invariant 1: after create, destroy behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(surface: f, kind: "browser-dom", mountPoint: "#app") -> ok(surface: f)
        let step1 = handler.create(
            CreateInput { surface: f.clone(), kind: "browser-dom".to_string(), mount_point: "#app".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { surface, .. } => {
                assert_eq!(surface, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // destroy(surface: f) -> ok(surface: f)
        let step2 = handler.destroy(
            DestroyInput { surface: f.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            DestroyOutput::Ok { surface, .. } => {
                assert_eq!(surface, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
