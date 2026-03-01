// generated: timer/conformance.rs
// Conformance tests for Timer concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::TimerHandler;
    use super::super::r#impl::TimerHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;

    fn create_test_handler() -> TimerHandlerImpl {
        TimerHandlerImpl
    }

    #[tokio::test]
    async fn timer_invariant_set_fire_lifecycle() {
        // Invariant: set_timer -> fire produces correct fire_count and transitions to fired
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let set = handler.set_timer(
            TimerSetTimerInput {
                run_ref: "run-inv-001".to_string(),
                timer_type: "duration".to_string(),
                specification: "PT30S".to_string(),
                purpose_tag: "retry".to_string(),
                context_ref: Some("step-x".to_string()),
            },
            &storage,
        ).await.unwrap();
        let timer_id = match set {
            TimerSetTimerOutput::Ok { timer_id, .. } => timer_id,
            _ => panic!("Expected Ok"),
        };

        let fire = handler.fire(
            TimerFireInput { timer_id: timer_id.clone() },
            &storage,
        ).await.unwrap();
        match fire {
            TimerFireOutput::Ok { fire_count, purpose_tag, .. } => {
                assert_eq!(fire_count, 1);
                assert_eq!(purpose_tag, "retry");
            }
            _ => panic!("Expected Ok"),
        }

        // Second fire should fail (duration timer is now "fired")
        let second = handler.fire(
            TimerFireInput { timer_id },
            &storage,
        ).await.unwrap();
        match second {
            TimerFireOutput::NotActive { current_status, .. } => {
                assert_eq!(current_status, "fired");
            }
            _ => panic!("Expected NotActive"),
        }
    }

    #[tokio::test]
    async fn timer_invariant_cancel_prevents_fire() {
        // Invariant: cancelled timer cannot fire
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let set = handler.set_timer(
            TimerSetTimerInput {
                run_ref: "run-inv-002".to_string(),
                timer_type: "duration".to_string(),
                specification: "PT1H".to_string(),
                purpose_tag: "sla".to_string(),
                context_ref: None,
            },
            &storage,
        ).await.unwrap();
        let timer_id = match set {
            TimerSetTimerOutput::Ok { timer_id, .. } => timer_id,
            _ => panic!("Expected Ok"),
        };

        handler.cancel(
            TimerCancelInput { timer_id: timer_id.clone() },
            &storage,
        ).await.unwrap();

        let fire = handler.fire(
            TimerFireInput { timer_id },
            &storage,
        ).await.unwrap();
        match fire {
            TimerFireOutput::NotActive { current_status, .. } => {
                assert_eq!(current_status, "cancelled");
            }
            _ => panic!("Expected NotActive after cancel"),
        }
    }

    #[tokio::test]
    async fn timer_invariant_reset_reactivates() {
        // Invariant: reset on a fired timer reactivates it
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let set = handler.set_timer(
            TimerSetTimerInput {
                run_ref: "run-inv-003".to_string(),
                timer_type: "duration".to_string(),
                specification: "PT5S".to_string(),
                purpose_tag: "retry".to_string(),
                context_ref: None,
            },
            &storage,
        ).await.unwrap();
        let timer_id = match set {
            TimerSetTimerOutput::Ok { timer_id, .. } => timer_id,
            _ => panic!("Expected Ok"),
        };

        handler.fire(TimerFireInput { timer_id: timer_id.clone() }, &storage).await.unwrap();

        let reset = handler.reset(
            TimerResetInput { timer_id: timer_id.clone(), specification: "PT10M".to_string() },
            &storage,
        ).await.unwrap();
        match reset {
            TimerResetOutput::Ok { .. } => {}
            _ => panic!("Expected Ok on reset"),
        }

        // Should be able to fire again after reset
        let fire_again = handler.fire(TimerFireInput { timer_id }, &storage).await.unwrap();
        match fire_again {
            TimerFireOutput::Ok { fire_count, .. } => {
                assert_eq!(fire_count, 2);
            }
            _ => panic!("Expected Ok on fire after reset"),
        }
    }
}
