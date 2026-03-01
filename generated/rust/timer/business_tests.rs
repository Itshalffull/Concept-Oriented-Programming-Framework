// Business logic tests for Timer concept.
// Validates timer lifecycle, recurring vs. duration semantics,
// fire counting, reset behavior, and cancel enforcement.

#[cfg(test)]
mod tests {
    use super::super::handler::TimerHandler;
    use super::super::r#impl::TimerHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_recurring_timer_fires_multiple_times() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let set = handler.set_timer(TimerSetTimerInput {
            run_ref: "run-recur".to_string(),
            timer_type: "recurring".to_string(),
            specification: "PT10S".to_string(),
            purpose_tag: "heartbeat".to_string(),
            context_ref: None,
        }, &storage).await.unwrap();
        let timer_id = match set {
            TimerSetTimerOutput::Ok { timer_id, .. } => timer_id,
            _ => panic!("Expected Ok"),
        };

        for expected_count in 1..=5 {
            let fire = handler.fire(TimerFireInput {
                timer_id: timer_id.clone(),
            }, &storage).await.unwrap();
            match fire {
                TimerFireOutput::Ok { fire_count, purpose_tag, .. } => {
                    assert_eq!(fire_count, expected_count);
                    assert_eq!(purpose_tag, "heartbeat");
                }
                _ => panic!("Expected Ok for recurring fire #{}", expected_count),
            }
        }
    }

    #[tokio::test]
    async fn test_duration_timer_fires_only_once() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let set = handler.set_timer(TimerSetTimerInput {
            run_ref: "run-once".to_string(),
            timer_type: "duration".to_string(),
            specification: "PT1H".to_string(),
            purpose_tag: "timeout".to_string(),
            context_ref: Some("step-wait".to_string()),
        }, &storage).await.unwrap();
        let timer_id = match set {
            TimerSetTimerOutput::Ok { timer_id, .. } => timer_id,
            _ => panic!("Expected Ok"),
        };

        let fire = handler.fire(TimerFireInput {
            timer_id: timer_id.clone(),
        }, &storage).await.unwrap();
        match fire {
            TimerFireOutput::Ok { fire_count, .. } => assert_eq!(fire_count, 1),
            _ => panic!("Expected Ok"),
        }

        let second = handler.fire(TimerFireInput {
            timer_id: timer_id.clone(),
        }, &storage).await.unwrap();
        match second {
            TimerFireOutput::NotActive { current_status, .. } => {
                assert_eq!(current_status, "fired");
            }
            _ => panic!("Expected NotActive after duration timer fires"),
        }
    }

    #[tokio::test]
    async fn test_cancel_active_timer() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let set = handler.set_timer(TimerSetTimerInput {
            run_ref: "run-cancel".to_string(),
            timer_type: "duration".to_string(),
            specification: "PT5M".to_string(),
            purpose_tag: "sla".to_string(),
            context_ref: None,
        }, &storage).await.unwrap();
        let timer_id = match set {
            TimerSetTimerOutput::Ok { timer_id, .. } => timer_id,
            _ => panic!("Expected Ok"),
        };

        let cancel = handler.cancel(TimerCancelInput {
            timer_id: timer_id.clone(),
        }, &storage).await.unwrap();
        match cancel {
            TimerCancelOutput::Ok { .. } => {}
            _ => panic!("Expected Ok"),
        }

        let fire = handler.fire(TimerFireInput {
            timer_id: timer_id.clone(),
        }, &storage).await.unwrap();
        match fire {
            TimerFireOutput::NotActive { current_status, .. } => {
                assert_eq!(current_status, "cancelled");
            }
            _ => panic!("Expected NotActive after cancel"),
        }
    }

    #[tokio::test]
    async fn test_cancel_fired_timer() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let set = handler.set_timer(TimerSetTimerInput {
            run_ref: "run-cf".to_string(),
            timer_type: "duration".to_string(),
            specification: "PT1S".to_string(),
            purpose_tag: "quick".to_string(),
            context_ref: None,
        }, &storage).await.unwrap();
        let timer_id = match set {
            TimerSetTimerOutput::Ok { timer_id, .. } => timer_id,
            _ => panic!("Expected Ok"),
        };

        handler.fire(TimerFireInput {
            timer_id: timer_id.clone(),
        }, &storage).await.unwrap();

        let cancel = handler.cancel(TimerCancelInput {
            timer_id: timer_id.clone(),
        }, &storage).await.unwrap();
        match cancel {
            TimerCancelOutput::NotActive { current_status, .. } => {
                assert_eq!(current_status, "fired");
            }
            _ => panic!("Expected NotActive for fired timer"),
        }
    }

    #[tokio::test]
    async fn test_reset_cancelled_timer_reactivates() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let set = handler.set_timer(TimerSetTimerInput {
            run_ref: "run-rc".to_string(),
            timer_type: "duration".to_string(),
            specification: "PT30S".to_string(),
            purpose_tag: "retry".to_string(),
            context_ref: None,
        }, &storage).await.unwrap();
        let timer_id = match set {
            TimerSetTimerOutput::Ok { timer_id, .. } => timer_id,
            _ => panic!("Expected Ok"),
        };

        handler.cancel(TimerCancelInput {
            timer_id: timer_id.clone(),
        }, &storage).await.unwrap();

        let reset = handler.reset(TimerResetInput {
            timer_id: timer_id.clone(),
            specification: "PT1M".to_string(),
        }, &storage).await.unwrap();
        match reset {
            TimerResetOutput::Ok { .. } => {}
            _ => panic!("Expected Ok on reset"),
        }

        let fire = handler.fire(TimerFireInput {
            timer_id: timer_id.clone(),
        }, &storage).await.unwrap();
        match fire {
            TimerFireOutput::Ok { fire_count, .. } => {
                assert_eq!(fire_count, 1);
            }
            _ => panic!("Expected Ok fire after reset"),
        }
    }

    #[tokio::test]
    async fn test_reset_preserves_fire_count() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let set = handler.set_timer(TimerSetTimerInput {
            run_ref: "run-count".to_string(),
            timer_type: "duration".to_string(),
            specification: "PT5S".to_string(),
            purpose_tag: "retry".to_string(),
            context_ref: None,
        }, &storage).await.unwrap();
        let timer_id = match set {
            TimerSetTimerOutput::Ok { timer_id, .. } => timer_id,
            _ => panic!("Expected Ok"),
        };

        // Fire once
        handler.fire(TimerFireInput { timer_id: timer_id.clone() }, &storage).await.unwrap();

        // Reset and fire again
        handler.reset(TimerResetInput {
            timer_id: timer_id.clone(),
            specification: "PT10S".to_string(),
        }, &storage).await.unwrap();

        let fire = handler.fire(TimerFireInput { timer_id: timer_id.clone() }, &storage).await.unwrap();
        match fire {
            TimerFireOutput::Ok { fire_count, .. } => {
                assert_eq!(fire_count, 2, "Fire count should include previous fires");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_fire_nonexistent_timer() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let result = handler.fire(TimerFireInput {
            timer_id: "timer-ghost".to_string(),
        }, &storage).await.unwrap();
        match result {
            TimerFireOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_cancel_nonexistent_timer() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let result = handler.cancel(TimerCancelInput {
            timer_id: "timer-ghost".to_string(),
        }, &storage).await.unwrap();
        match result {
            TimerCancelOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_reset_nonexistent_timer() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let result = handler.reset(TimerResetInput {
            timer_id: "timer-ghost".to_string(),
            specification: "PT1M".to_string(),
        }, &storage).await.unwrap();
        match result {
            TimerResetOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_multiple_timers_independent() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let t1 = handler.set_timer(TimerSetTimerInput {
            run_ref: "run-multi".to_string(),
            timer_type: "duration".to_string(),
            specification: "PT1M".to_string(),
            purpose_tag: "sla".to_string(),
            context_ref: None,
        }, &storage).await.unwrap();
        let id1 = match t1 { TimerSetTimerOutput::Ok { timer_id, .. } => timer_id, _ => panic!("Expected Ok") };

        let t2 = handler.set_timer(TimerSetTimerInput {
            run_ref: "run-multi".to_string(),
            timer_type: "recurring".to_string(),
            specification: "PT10S".to_string(),
            purpose_tag: "poll".to_string(),
            context_ref: None,
        }, &storage).await.unwrap();
        let id2 = match t2 { TimerSetTimerOutput::Ok { timer_id, .. } => timer_id, _ => panic!("Expected Ok") };

        // Cancel timer 1
        handler.cancel(TimerCancelInput { timer_id: id1.clone() }, &storage).await.unwrap();

        // Timer 2 should still be active
        let fire = handler.fire(TimerFireInput { timer_id: id2.clone() }, &storage).await.unwrap();
        match fire {
            TimerFireOutput::Ok { fire_count, purpose_tag, .. } => {
                assert_eq!(fire_count, 1);
                assert_eq!(purpose_tag, "poll");
            }
            _ => panic!("Expected Ok for independent timer"),
        }
    }
}
