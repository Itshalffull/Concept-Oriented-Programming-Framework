// Business logic tests for CompensationPlan concept.
// Validates saga-style rollback ordering, trigger constraints,
// failure marking, and edge cases in multi-step compensation.

#[cfg(test)]
mod tests {
    use super::super::handler::CompensationPlanHandler;
    use super::super::r#impl::CompensationPlanHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_three_step_reverse_order_compensation() {
        let storage = InMemoryStorage::new();
        let handler = CompensationPlanHandlerImpl;

        let reg1 = handler.register(CompensationPlanRegisterInput {
            run_ref: "run-3step".to_string(),
            step_key: "create-order".to_string(),
            action_descriptor: "cancel-order".to_string(),
        }, &storage).await.unwrap();
        let plan_id = match reg1 {
            CompensationPlanRegisterOutput::Ok { plan_id, compensation_count, .. } => {
                assert_eq!(compensation_count, 1);
                plan_id
            }
        };

        handler.register(CompensationPlanRegisterInput {
            run_ref: "run-3step".to_string(),
            step_key: "charge-payment".to_string(),
            action_descriptor: "refund-payment".to_string(),
        }, &storage).await.unwrap();

        handler.register(CompensationPlanRegisterInput {
            run_ref: "run-3step".to_string(),
            step_key: "ship-item".to_string(),
            action_descriptor: "recall-shipment".to_string(),
        }, &storage).await.unwrap();

        handler.trigger(CompensationPlanTriggerInput {
            run_ref: "run-3step".to_string(),
        }, &storage).await.unwrap();

        // Execute in reverse: ship-item -> charge-payment -> create-order
        let exec1 = handler.execute_next(CompensationPlanExecuteNextInput {
            plan_id: plan_id.clone(),
        }, &storage).await.unwrap();
        match exec1 {
            CompensationPlanExecuteNextOutput::Ok { step_key, action_descriptor, .. } => {
                assert_eq!(step_key, "ship-item");
                assert_eq!(action_descriptor, "recall-shipment");
            }
            _ => panic!("Expected Ok"),
        }

        let exec2 = handler.execute_next(CompensationPlanExecuteNextInput {
            plan_id: plan_id.clone(),
        }, &storage).await.unwrap();
        match exec2 {
            CompensationPlanExecuteNextOutput::Ok { step_key, .. } => {
                assert_eq!(step_key, "charge-payment");
            }
            _ => panic!("Expected Ok"),
        }

        let exec3 = handler.execute_next(CompensationPlanExecuteNextInput {
            plan_id: plan_id.clone(),
        }, &storage).await.unwrap();
        match exec3 {
            CompensationPlanExecuteNextOutput::Ok { step_key, .. } => {
                assert_eq!(step_key, "create-order");
            }
            _ => panic!("Expected Ok"),
        }

        let done = handler.execute_next(CompensationPlanExecuteNextInput {
            plan_id: plan_id.clone(),
        }, &storage).await.unwrap();
        match done {
            CompensationPlanExecuteNextOutput::AllDone { .. } => {}
            _ => panic!("Expected AllDone"),
        }
    }

    #[tokio::test]
    async fn test_trigger_already_triggered_returns_error() {
        let storage = InMemoryStorage::new();
        let handler = CompensationPlanHandlerImpl;

        handler.register(CompensationPlanRegisterInput {
            run_ref: "run-double-trig".to_string(),
            step_key: "step-a".to_string(),
            action_descriptor: "undo-a".to_string(),
        }, &storage).await.unwrap();

        handler.trigger(CompensationPlanTriggerInput {
            run_ref: "run-double-trig".to_string(),
        }, &storage).await.unwrap();

        let result = handler.trigger(CompensationPlanTriggerInput {
            run_ref: "run-double-trig".to_string(),
        }, &storage).await.unwrap();
        match result {
            CompensationPlanTriggerOutput::AlreadyTriggered { current_status, .. } => {
                assert_eq!(current_status, "triggered");
            }
            _ => panic!("Expected AlreadyTriggered"),
        }
    }

    #[tokio::test]
    async fn test_mark_compensation_failed_sets_failed_status() {
        let storage = InMemoryStorage::new();
        let handler = CompensationPlanHandlerImpl;

        let reg = handler.register(CompensationPlanRegisterInput {
            run_ref: "run-fail".to_string(),
            step_key: "step-x".to_string(),
            action_descriptor: "undo-x".to_string(),
        }, &storage).await.unwrap();
        let plan_id = match reg {
            CompensationPlanRegisterOutput::Ok { plan_id, .. } => plan_id,
        };

        handler.trigger(CompensationPlanTriggerInput {
            run_ref: "run-fail".to_string(),
        }, &storage).await.unwrap();

        let result = handler.mark_compensation_failed(CompensationPlanMarkFailedInput {
            plan_id: plan_id.clone(),
            step_key: "step-x".to_string(),
            error: "Compensation action failed: connection refused".to_string(),
        }, &storage).await.unwrap();
        match result {
            CompensationPlanMarkFailedOutput::Ok { status, .. } => {
                assert_eq!(status, "failed");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_execute_next_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CompensationPlanHandlerImpl;

        let result = handler.execute_next(CompensationPlanExecuteNextInput {
            plan_id: "cp-missing".to_string(),
        }, &storage).await.unwrap();
        match result {
            CompensationPlanExecuteNextOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_mark_failed_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CompensationPlanHandlerImpl;

        let result = handler.mark_compensation_failed(CompensationPlanMarkFailedInput {
            plan_id: "cp-ghost".to_string(),
            step_key: "step".to_string(),
            error: "err".to_string(),
        }, &storage).await.unwrap();
        match result {
            CompensationPlanMarkFailedOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_single_step_compensation() {
        let storage = InMemoryStorage::new();
        let handler = CompensationPlanHandlerImpl;

        let reg = handler.register(CompensationPlanRegisterInput {
            run_ref: "run-single".to_string(),
            step_key: "only-step".to_string(),
            action_descriptor: "undo-only".to_string(),
        }, &storage).await.unwrap();
        let plan_id = match reg {
            CompensationPlanRegisterOutput::Ok { plan_id, .. } => plan_id,
        };

        handler.trigger(CompensationPlanTriggerInput {
            run_ref: "run-single".to_string(),
        }, &storage).await.unwrap();

        let exec = handler.execute_next(CompensationPlanExecuteNextInput {
            plan_id: plan_id.clone(),
        }, &storage).await.unwrap();
        match exec {
            CompensationPlanExecuteNextOutput::Ok { step_key, action_descriptor, .. } => {
                assert_eq!(step_key, "only-step");
                assert_eq!(action_descriptor, "undo-only");
            }
            _ => panic!("Expected Ok"),
        }

        let done = handler.execute_next(CompensationPlanExecuteNextInput {
            plan_id: plan_id.clone(),
        }, &storage).await.unwrap();
        match done {
            CompensationPlanExecuteNextOutput::AllDone { .. } => {}
            _ => panic!("Expected AllDone"),
        }
    }

    #[tokio::test]
    async fn test_register_increments_count_correctly() {
        let storage = InMemoryStorage::new();
        let handler = CompensationPlanHandlerImpl;

        for i in 1..=5 {
            let reg = handler.register(CompensationPlanRegisterInput {
                run_ref: "run-count".to_string(),
                step_key: format!("step-{}", i),
                action_descriptor: format!("undo-{}", i),
            }, &storage).await.unwrap();
            match reg {
                CompensationPlanRegisterOutput::Ok { compensation_count, .. } => {
                    assert_eq!(compensation_count, i as i64);
                }
            }
        }
    }

    #[tokio::test]
    async fn test_trigger_nonexistent_run_returns_empty() {
        let storage = InMemoryStorage::new();
        let handler = CompensationPlanHandlerImpl;

        let result = handler.trigger(CompensationPlanTriggerInput {
            run_ref: "run-nonexistent".to_string(),
        }, &storage).await.unwrap();
        match result {
            CompensationPlanTriggerOutput::Empty { .. } => {}
            _ => panic!("Expected Empty"),
        }
    }
}
