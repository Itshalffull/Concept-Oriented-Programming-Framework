// generated: retry_policy/conformance.rs
// Conformance tests for RetryPolicy concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::RetryPolicyHandler;
    use super::super::r#impl::RetryPolicyHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;

    fn create_test_handler() -> RetryPolicyHandlerImpl {
        RetryPolicyHandlerImpl
    }

    #[tokio::test]
    async fn retry_policy_invariant_backoff_increases() {
        // Invariant: successive retries produce increasing delays (up to max)
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let create = handler.create(
            RetryPolicyCreateInput {
                step_ref: "step-inv-001".to_string(),
                run_ref: "run-inv-001".to_string(),
                max_attempts: 5,
                initial_interval_ms: 1000,
                backoff_coefficient: 2.0,
                max_interval_ms: 10000,
            },
            &storage,
        ).await.unwrap();
        let policy_id = match create {
            RetryPolicyCreateOutput::Ok { policy_id, .. } => policy_id,
        };

        // First check: attempt 1 with 0 recorded attempts
        let r1 = handler.should_retry(
            RetryPolicyShouldRetryInput { policy_id: policy_id.clone(), error: "e1".to_string() },
            &storage,
        ).await.unwrap();
        let d1 = match r1 {
            RetryPolicyShouldRetryOutput::Retry { delay_ms, .. } => delay_ms,
            _ => panic!("Expected Retry"),
        };

        handler.record_attempt(
            RetryPolicyRecordAttemptInput { policy_id: policy_id.clone(), error: "e1".to_string() },
            &storage,
        ).await.unwrap();

        // Second check: attempt 2
        let r2 = handler.should_retry(
            RetryPolicyShouldRetryInput { policy_id: policy_id.clone(), error: "e2".to_string() },
            &storage,
        ).await.unwrap();
        let d2 = match r2 {
            RetryPolicyShouldRetryOutput::Retry { delay_ms, .. } => delay_ms,
            _ => panic!("Expected Retry"),
        };

        assert!(d2 >= d1, "Backoff should increase: d1={}, d2={}", d1, d2);
    }

    #[tokio::test]
    async fn retry_policy_invariant_exhaustion_terminal() {
        // Invariant: after max_attempts, should_retry returns Exhausted
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let create = handler.create(
            RetryPolicyCreateInput {
                step_ref: "step-inv-002".to_string(),
                run_ref: "run-inv-002".to_string(),
                max_attempts: 1,
                initial_interval_ms: 500,
                backoff_coefficient: 1.0,
                max_interval_ms: 500,
            },
            &storage,
        ).await.unwrap();
        let policy_id = match create {
            RetryPolicyCreateOutput::Ok { policy_id, .. } => policy_id,
        };

        handler.record_attempt(
            RetryPolicyRecordAttemptInput { policy_id: policy_id.clone(), error: "fail".to_string() },
            &storage,
        ).await.unwrap();

        let result = handler.should_retry(
            RetryPolicyShouldRetryInput { policy_id, error: "final fail".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RetryPolicyShouldRetryOutput::Exhausted { last_error, .. } => {
                assert_eq!(last_error, "final fail");
            }
            _ => panic!("Expected Exhausted"),
        }
    }
}
