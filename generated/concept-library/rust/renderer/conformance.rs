// generated: renderer/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::RendererHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn renderer_invariant_1() {
        // invariant 1: after render, render behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // render(renderer: r, tree: "<page><header/><body/></page>") -> ok(output: _)
        let step1 = handler.render(
            RenderInput { renderer: r.clone(), tree: "<page><header/><body/></page>".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RenderOutput::Ok { output, .. } => {
                assert_eq!(output, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // render(renderer: r, tree: "<page><header/><body/></page>") -> ok(output: _)
        let step2 = handler.render(
            RenderInput { renderer: r.clone(), tree: "<page><header/><body/></page>".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RenderOutput::Ok { output, .. } => {
                assert_eq!(output, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn renderer_invariant_2() {
        // invariant 2: after autoPlaceholder, render behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();
        let p = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // autoPlaceholder(renderer: r, name: "sidebar") -> ok(placeholder: p)
        let step1 = handler.auto_placeholder(
            AutoPlaceholderInput { renderer: r.clone(), name: "sidebar".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            AutoPlaceholderOutput::Ok { placeholder, .. } => {
                assert_eq!(placeholder, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // render(renderer: r, tree: p) -> ok(output: _)
        let step2 = handler.render(
            RenderInput { renderer: r.clone(), tree: p.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            RenderOutput::Ok { output, .. } => {
                assert_eq!(output, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
