// generated: palette/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::PaletteHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn palette_invariant_1() {
        // invariant 1: after generate, assignRole behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // generate(palette: c, name: "blue", seed: "#3b82f6") -> ok(palette: c, scale: _)
        let step1 = handler.generate(
            GenerateInput { palette: c.clone(), name: "blue".to_string(), seed: "#3b82f6".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { palette, scale, .. } => {
                assert_eq!(palette, c.clone());
                assert_eq!(scale, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // assignRole(palette: c, role: "primary") -> ok(palette: c)
        let step2 = handler.assign_role(
            AssignRoleInput { palette: c.clone(), role: "primary".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            AssignRoleOutput::Ok { palette, .. } => {
                assert_eq!(palette, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
