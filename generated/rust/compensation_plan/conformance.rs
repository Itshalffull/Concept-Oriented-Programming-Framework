// generated: compensation_plan/conformance.rs
// Conformance tests for CompensationPlan concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::CompensationPlanHandler;
    use super::super::r#impl::CompensationPlanHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;

    fn create_test_handler() -> CompensationPlanHandlerImpl {
        CompensationPlanHandlerImpl
    }

    #[tokio::test]
    async fn compensation_plan_invariant_reverse_execution_order() {
        // Invariant: compensations execute in reverse registration order (LIFO)
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let reg1 = handler.register(
            CompensationPlanRegisterInput {
                run_ref: "run-inv-001".to_string(),
                step_key: "first".to_string(),
                action_descriptor: "undo-first".to_string(),
            },
            &storage,
        ).await.unwrap();
        let plan_id = match reg1 {
            CompensationPlanRegisterOutput::Ok { plan_id, .. } => plan_id,
        };

        handler.register(
            CompensationPlanRegisterInput {
                run_ref: "run-inv-001".to_string(),
                step_key: "second".to_string(),
                action_descriptor: "undo-second".to_string(),
            },
            &storage,
        ).await.unwrap();

        handler.register(
            CompensationPlanRegisterInput {
                run_ref: "run-inv-001".to_string(),
                step_key: "third".to_string(),
                action_descriptor: "undo-third".to_string(),
            },
            &storage,
        ).await.unwrap();

        handler.trigger(
            CompensationPlanTriggerInput { run_ref: "run-inv-001".to_string() },
            &storage,
        ).await.unwrap();

        // Should get third, second, first in that order
        let e1 = handler.execute_next(
            CompensationPlanExecuteNextInput { plan_id: plan_id.clone() },
            &storage,
        ).await.unwrap();
        match e1 {
            CompensationPlanExecuteNextOutput::Ok { step_key, .. } => assert_eq!(step_key, "third"),
            _ => panic!("Expected Ok with third"),
        }

        let e2 = handler.execute_next(
            CompensationPlanExecuteNextInput { plan_id: plan_id.clone() },
            &storage,
        ).await.unwrap();
        match e2 {
            CompensationPlanExecuteNextOutput::Ok { step_key, .. } => assert_eq!(step_key, "second"),
            _ => panic!("Expected Ok with second"),
        }

        let e3 = handler.execute_next(
            CompensationPlanExecuteNextInput { plan_id: plan_id.clone() },
            &storage,
        ).await.unwrap();
        match e3 {
            CompensationPlanExecuteNextOutput::Ok { step_key, .. } => assert_eq!(step_key, "first"),
            _ => panic!("Expected Ok with first"),
        }

        let done = handler.execute_next(
            CompensationPlanExecuteNextInput { plan_id },
            &storage,
        ).await.unwrap();
        match done {
            CompensationPlanExecuteNextOutput::AllDone { .. } => {}
            _ => panic!("Expected AllDone"),
        }
    }

    #[tokio::test]
    async fn compensation_plan_invariant_double_trigger_rejected() {
        // Invariant: triggering an already-triggered plan is rejected
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        handler.register(
            CompensationPlanRegisterInput {
                run_ref: "run-inv-002".to_string(),
                step_key: "step-a".to_string(),
                action_descriptor: "undo-a".to_string(),
            },
            &storage,
        ).await.unwrap();

        handler.trigger(
            CompensationPlanTriggerInput { run_ref: "run-inv-002".to_string() },
            &storage,
        ).await.unwrap();

        let second_trigger = handler.trigger(
            CompensationPlanTriggerInput { run_ref: "run-inv-002".to_string() },
            &storage,
        ).await.unwrap();
        match second_trigger {
            CompensationPlanTriggerOutput::AlreadyTriggered { .. } => {}
            _ => panic!("Expected AlreadyTriggered"),
        }
    }
}
