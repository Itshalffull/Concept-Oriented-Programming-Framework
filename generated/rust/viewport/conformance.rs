// generated: viewport/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ViewportHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn viewport_invariant_1() {
        // invariant 1: after observe, getBreakpoint behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let v = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // observe(viewport: v, width: 1024, height: 768) -> ok(viewport: v, breakpoint: "lg", orientation: "landscape")
        let step1 = handler.observe(
            ObserveInput { viewport: v.clone(), width: 1024, height: 768 },
            &storage,
        ).await.unwrap();
        match step1 {
            ObserveOutput::Ok { viewport, breakpoint, orientation, .. } => {
                assert_eq!(viewport, v.clone());
                assert_eq!(breakpoint, "lg".to_string());
                assert_eq!(orientation, "landscape".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // getBreakpoint(viewport: v) -> ok(viewport: v, breakpoint: "lg", width: 1024, height: 768)
        let step2 = handler.get_breakpoint(
            GetBreakpointInput { viewport: v.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetBreakpointOutput::Ok { viewport, breakpoint, width, height, .. } => {
                assert_eq!(viewport, v.clone());
                assert_eq!(breakpoint, "lg".to_string());
                assert_eq!(width, 1024);
                assert_eq!(height, 768);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
