// Business logic tests for RetryPolicy concept.
// Validates backoff calculation, exhaustion detection,
// attempt counting, and success marking edge cases.

#[cfg(test)]
mod tests {
    use super::super::handler::RetryPolicyHandler;
    use super::super::r#impl::RetryPolicyHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_exponential_backoff_calculation() {
        let storage = InMemoryStorage::new();
        let handler = RetryPolicyHandlerImpl;

        let create = handler.create(RetryPolicyCreateInput {
            step_ref: "fetch".to_string(),
            run_ref: "run-exp".to_string(),
            max_attempts: 5,
            initial_interval_ms: 1000,
            backoff_coefficient: 2.0,
            max_interval_ms: 60000,
        }, &storage).await.unwrap();
        let policy_id = match create {
            RetryPolicyCreateOutput::Ok { policy_id, .. } => policy_id,
        };

        // Attempt 1: delay = 1000 * 2^0 = 1000
        let r1 = handler.should_retry(RetryPolicyShouldRetryInput {
            policy_id: policy_id.clone(),
            error: "err".to_string(),
        }, &storage).await.unwrap();
        match r1 {
            RetryPolicyShouldRetryOutput::Retry { delay_ms, attempt, .. } => {
                assert_eq!(attempt, 1);
                assert_eq!(delay_ms, 1000);
            }
            _ => panic!("Expected Retry"),
        }

        // Record attempt 1
        handler.record_attempt(RetryPolicyRecordAttemptInput {
            policy_id: policy_id.clone(),
            error: "err1".to_string(),
        }, &storage).await.unwrap();

        // Attempt 2: delay = 1000 * 2^1 = 2000
        let r2 = handler.should_retry(RetryPolicyShouldRetryInput {
            policy_id: policy_id.clone(),
            error: "err".to_string(),
        }, &storage).await.unwrap();
        match r2 {
            RetryPolicyShouldRetryOutput::Retry { delay_ms, attempt, .. } => {
                assert_eq!(attempt, 2);
                assert_eq!(delay_ms, 2000);
            }
            _ => panic!("Expected Retry"),
        }

        // Record attempt 2
        handler.record_attempt(RetryPolicyRecordAttemptInput {
            policy_id: policy_id.clone(),
            error: "err2".to_string(),
        }, &storage).await.unwrap();

        // Attempt 3: delay = 1000 * 2^2 = 4000
        let r3 = handler.should_retry(RetryPolicyShouldRetryInput {
            policy_id: policy_id.clone(),
            error: "err".to_string(),
        }, &storage).await.unwrap();
        match r3 {
            RetryPolicyShouldRetryOutput::Retry { delay_ms, attempt, .. } => {
                assert_eq!(attempt, 3);
                assert_eq!(delay_ms, 4000);
            }
            _ => panic!("Expected Retry"),
        }
    }

    #[tokio::test]
    async fn test_backoff_capped_at_max_interval() {
        let storage = InMemoryStorage::new();
        let handler = RetryPolicyHandlerImpl;

        let create = handler.create(RetryPolicyCreateInput {
            step_ref: "capped".to_string(),
            run_ref: "run-cap".to_string(),
            max_attempts: 10,
            initial_interval_ms: 1000,
            backoff_coefficient: 10.0,
            max_interval_ms: 5000,
        }, &storage).await.unwrap();
        let policy_id = match create {
            RetryPolicyCreateOutput::Ok { policy_id, .. } => policy_id,
        };

        // First attempt: 1000 * 10^0 = 1000
        let r1 = handler.should_retry(RetryPolicyShouldRetryInput {
            policy_id: policy_id.clone(),
            error: "err".to_string(),
        }, &storage).await.unwrap();
        match r1 {
            RetryPolicyShouldRetryOutput::Retry { delay_ms, .. } => {
                assert_eq!(delay_ms, 1000);
            }
            _ => panic!("Expected Retry"),
        }

        handler.record_attempt(RetryPolicyRecordAttemptInput {
            policy_id: policy_id.clone(),
            error: "err".to_string(),
        }, &storage).await.unwrap();

        // Second attempt: 1000 * 10^1 = 10000, capped to 5000
        let r2 = handler.should_retry(RetryPolicyShouldRetryInput {
            policy_id: policy_id.clone(),
            error: "err".to_string(),
        }, &storage).await.unwrap();
        match r2 {
            RetryPolicyShouldRetryOutput::Retry { delay_ms, .. } => {
                assert_eq!(delay_ms, 5000);
            }
            _ => panic!("Expected Retry"),
        }
    }

    #[tokio::test]
    async fn test_exhaustion_after_max_attempts() {
        let storage = InMemoryStorage::new();
        let handler = RetryPolicyHandlerImpl;

        let create = handler.create(RetryPolicyCreateInput {
            step_ref: "exhaust".to_string(),
            run_ref: "run-exh".to_string(),
            max_attempts: 2,
            initial_interval_ms: 500,
            backoff_coefficient: 1.0,
            max_interval_ms: 500,
        }, &storage).await.unwrap();
        let policy_id = match create {
            RetryPolicyCreateOutput::Ok { policy_id, .. } => policy_id,
        };

        // Record 2 attempts to reach max
        handler.record_attempt(RetryPolicyRecordAttemptInput {
            policy_id: policy_id.clone(),
            error: "e1".to_string(),
        }, &storage).await.unwrap();
        handler.record_attempt(RetryPolicyRecordAttemptInput {
            policy_id: policy_id.clone(),
            error: "e2".to_string(),
        }, &storage).await.unwrap();

        let result = handler.should_retry(RetryPolicyShouldRetryInput {
            policy_id: policy_id.clone(),
            error: "final error".to_string(),
        }, &storage).await.unwrap();
        match result {
            RetryPolicyShouldRetryOutput::Exhausted { last_error, step_ref, run_ref, .. } => {
                assert_eq!(last_error, "final error");
                assert_eq!(step_ref, "exhaust");
                assert_eq!(run_ref, "run-exh");
            }
            _ => panic!("Expected Exhausted"),
        }
    }

    #[tokio::test]
    async fn test_mark_succeeded_after_retries() {
        let storage = InMemoryStorage::new();
        let handler = RetryPolicyHandlerImpl;

        let create = handler.create(RetryPolicyCreateInput {
            step_ref: "success-after-retry".to_string(),
            run_ref: "run-success".to_string(),
            max_attempts: 5,
            initial_interval_ms: 1000,
            backoff_coefficient: 2.0,
            max_interval_ms: 30000,
        }, &storage).await.unwrap();
        let policy_id = match create {
            RetryPolicyCreateOutput::Ok { policy_id, .. } => policy_id,
        };

        // Simulate 2 failed attempts then success
        handler.record_attempt(RetryPolicyRecordAttemptInput {
            policy_id: policy_id.clone(),
            error: "timeout".to_string(),
        }, &storage).await.unwrap();
        handler.record_attempt(RetryPolicyRecordAttemptInput {
            policy_id: policy_id.clone(),
            error: "timeout again".to_string(),
        }, &storage).await.unwrap();

        let result = handler.mark_succeeded(RetryPolicyMarkSucceededInput {
            policy_id: policy_id.clone(),
        }, &storage).await.unwrap();
        match result {
            RetryPolicyMarkSucceededOutput::Ok { .. } => {}
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_should_retry_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RetryPolicyHandlerImpl;

        let result = handler.should_retry(RetryPolicyShouldRetryInput {
            policy_id: "rp-missing".to_string(),
            error: "err".to_string(),
        }, &storage).await.unwrap();
        match result {
            RetryPolicyShouldRetryOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_record_attempt_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RetryPolicyHandlerImpl;

        let result = handler.record_attempt(RetryPolicyRecordAttemptInput {
            policy_id: "rp-ghost".to_string(),
            error: "err".to_string(),
        }, &storage).await.unwrap();
        match result {
            RetryPolicyRecordAttemptOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_mark_succeeded_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RetryPolicyHandlerImpl;

        let result = handler.mark_succeeded(RetryPolicyMarkSucceededInput {
            policy_id: "rp-ghost".to_string(),
        }, &storage).await.unwrap();
        match result {
            RetryPolicyMarkSucceededOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_single_attempt_policy_exhausts_immediately() {
        let storage = InMemoryStorage::new();
        let handler = RetryPolicyHandlerImpl;

        let create = handler.create(RetryPolicyCreateInput {
            step_ref: "no-retry".to_string(),
            run_ref: "run-nr".to_string(),
            max_attempts: 1,
            initial_interval_ms: 1000,
            backoff_coefficient: 2.0,
            max_interval_ms: 30000,
        }, &storage).await.unwrap();
        let policy_id = match create {
            RetryPolicyCreateOutput::Ok { policy_id, .. } => policy_id,
        };

        // Record 1 attempt
        handler.record_attempt(RetryPolicyRecordAttemptInput {
            policy_id: policy_id.clone(),
            error: "failed".to_string(),
        }, &storage).await.unwrap();

        let result = handler.should_retry(RetryPolicyShouldRetryInput {
            policy_id: policy_id.clone(),
            error: "no more retries".to_string(),
        }, &storage).await.unwrap();
        match result {
            RetryPolicyShouldRetryOutput::Exhausted { .. } => {}
            _ => panic!("Expected Exhausted for single-attempt policy"),
        }
    }

    #[tokio::test]
    async fn test_record_attempt_increments_count() {
        let storage = InMemoryStorage::new();
        let handler = RetryPolicyHandlerImpl;

        let create = handler.create(RetryPolicyCreateInput {
            step_ref: "counting".to_string(),
            run_ref: "run-count".to_string(),
            max_attempts: 10,
            initial_interval_ms: 100,
            backoff_coefficient: 1.0,
            max_interval_ms: 100,
        }, &storage).await.unwrap();
        let policy_id = match create {
            RetryPolicyCreateOutput::Ok { policy_id, .. } => policy_id,
        };

        for expected in 1..=4 {
            let result = handler.record_attempt(RetryPolicyRecordAttemptInput {
                policy_id: policy_id.clone(),
                error: format!("err-{}", expected),
            }, &storage).await.unwrap();
            match result {
                RetryPolicyRecordAttemptOutput::Ok { attempt_count, .. } => {
                    assert_eq!(attempt_count, expected);
                }
                _ => panic!("Expected Ok"),
            }
        }
    }
}
