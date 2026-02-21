// generated: display_mode/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DisplayModeHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn display_mode_invariant_1() {
        // invariant 1: after defineMode, configureFieldDisplay behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let d = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // defineMode(mode: d, name: "teaser") -> ok(mode: d)
        let step1 = handler.define_mode(
            DefineModeInput { mode: d.clone(), name: "teaser".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            DefineModeOutput::Ok { mode, .. } => {
                assert_eq!(mode, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // configureFieldDisplay(mode: d, field: "title", config: "truncated") -> ok(mode: d)
        let step2 = handler.configure_field_display(
            ConfigureFieldDisplayInput { mode: d.clone(), field: "title".to_string(), config: "truncated".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ConfigureFieldDisplayOutput::Ok { mode, .. } => {
                assert_eq!(mode, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn display_mode_invariant_2() {
        // invariant 2: after configureFieldDisplay, renderInMode behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let d = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // configureFieldDisplay(mode: d, field: "title", config: "truncated") -> ok(mode: d)
        let step1 = handler.configure_field_display(
            ConfigureFieldDisplayInput { mode: d.clone(), field: "title".to_string(), config: "truncated".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ConfigureFieldDisplayOutput::Ok { mode, .. } => {
                assert_eq!(mode, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // renderInMode(mode: d, entity: "article-1") -> ok(output: _)
        let step2 = handler.render_in_mode(
            RenderInModeInput { mode: d.clone(), entity: "article-1".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RenderInModeOutput::Ok { output, .. } => {
                assert_eq!(output, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
