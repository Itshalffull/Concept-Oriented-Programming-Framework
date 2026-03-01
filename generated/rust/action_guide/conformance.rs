// generated: action_guide/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ActionGuideHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn action_guide_invariant_1() {
        // invariant 1: after define, render behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let w = "u-test-invariant-001".to_string();
        let c = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // define(concept: "SpecParser", steps: ["parse"], content: "{\"design-principles\":[{\"title\":\"Independence\",\"rule\":\"Parse without external state\"}]}") -> ok(workflow: w, stepCount: 1)
        let step1 = handler.define(
            DefineInput { concept: "SpecParser".to_string(), steps: todo!(/* list: ["parse".to_string()] */), content: "{"design-principles":[{"title":"Independence","rule":"Parse without external state"}]}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            DefineOutput::Ok { workflow, step_count, .. } => {
                assert_eq!(workflow, w.clone());
                assert_eq!(step_count, 1);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // render(workflow: w, format: "skill-md") -> ok(content: c)
        let step2 = handler.render(
            RenderInput { workflow: w.clone(), format: "skill-md".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RenderOutput::Ok { content, .. } => {
                assert_eq!(content, c.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
