// generated: workflow/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::WorkflowHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn workflow_invariant_1() {
        // invariant 1: after defineState, defineState, defineTransition, transition, getCurrentState behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let w = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // defineState(workflow: w, name: "draft", flags: "initial") -> ok()
        let step1 = handler.define_state(
            DefineStateInput { workflow: w.clone(), name: "draft".to_string(), flags: "initial".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, DefineStateOutput::Ok));

        // --- THEN clause ---
        // defineState(workflow: w, name: "published", flags: "") -> ok()
        let step2 = handler.define_state(
            DefineStateInput { workflow: w.clone(), name: "published".to_string(), flags: "".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, DefineStateOutput::Ok));
        // defineTransition(workflow: w, from: "draft", to: "published", label: "publish", guard: "approved") -> ok()
        let step3 = handler.define_transition(
            DefineTransitionInput { workflow: w.clone(), from: "draft".to_string(), to: "published".to_string(), label: "publish".to_string(), guard: "approved".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step3, DefineTransitionOutput::Ok));
        // transition(workflow: w, entity: "doc1", transition: "publish") -> ok(newState: "published")
        let step4 = handler.transition(
            TransitionInput { workflow: w.clone(), entity: "doc1".to_string(), transition: "publish".to_string() },
            &storage,
        ).await.unwrap();
        match step4 {
            TransitionOutput::Ok { new_state, .. } => {
                assert_eq!(new_state, "published".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // getCurrentState(workflow: w, entity: "doc1") -> ok(state: "published")
        let step5 = handler.get_current_state(
            GetCurrentStateInput { workflow: w.clone(), entity: "doc1".to_string() },
            &storage,
        ).await.unwrap();
        match step5 {
            GetCurrentStateOutput::Ok { state, .. } => {
                assert_eq!(state, "published".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
