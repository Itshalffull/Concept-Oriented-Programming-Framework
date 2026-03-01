// RetryPolicy concept implementation
// Defines retry/backoff rules for failed steps and tracks attempt state.
// Status lifecycle: active -> exhausted|succeeded

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RetryPolicyHandler;
use serde_json::json;

pub struct RetryPolicyHandlerImpl;

fn generate_policy_id() -> String {
    format!("rp-{}", uuid::Uuid::new_v4())
}

/// Calculate backoff delay for a given attempt
fn calculate_delay(initial_ms: i64, coefficient: f64, attempt: i64, max_ms: i64) -> i64 {
    let delay = (initial_ms as f64) * coefficient.powi((attempt - 1) as i32);
    let delay_ms = delay.round() as i64;
    delay_ms.min(max_ms)
}

#[async_trait]
impl RetryPolicyHandler for RetryPolicyHandlerImpl {
    async fn create(
        &self,
        input: RetryPolicyCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetryPolicyCreateOutput, Box<dyn std::error::Error>> {
        let policy_id = generate_policy_id();
        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("retry_policies", &policy_id, json!({
            "policy_id": policy_id,
            "step_ref": input.step_ref,
            "run_ref": input.run_ref,
            "max_attempts": input.max_attempts,
            "initial_interval_ms": input.initial_interval_ms,
            "backoff_coefficient": input.backoff_coefficient,
            "max_interval_ms": input.max_interval_ms,
            "attempt_count": 0,
            "last_error": null,
            "status": "active",
            "created_at": timestamp,
        })).await?;

        Ok(RetryPolicyCreateOutput::Ok {
            policy_id,
            step_ref: input.step_ref,
            run_ref: input.run_ref,
        })
    }

    async fn should_retry(
        &self,
        input: RetryPolicyShouldRetryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetryPolicyShouldRetryOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("retry_policies", &input.policy_id).await?;

        match existing {
            None => Ok(RetryPolicyShouldRetryOutput::NotFound {
                policy_id: input.policy_id,
            }),
            Some(record) => {
                let attempt_count = record["attempt_count"].as_i64().unwrap_or(0);
                let max_attempts = record["max_attempts"].as_i64().unwrap_or(1);
                let step_ref = record["step_ref"].as_str().unwrap_or("").to_string();
                let run_ref = record["run_ref"].as_str().unwrap_or("").to_string();

                if attempt_count >= max_attempts {
                    // Mark as exhausted
                    let mut updated = record.clone();
                    if let Some(obj) = updated.as_object_mut() {
                        obj.insert("status".to_string(), json!("exhausted"));
                        obj.insert("last_error".to_string(), json!(input.error));
                    }
                    storage.put("retry_policies", &input.policy_id, updated).await?;

                    return Ok(RetryPolicyShouldRetryOutput::Exhausted {
                        policy_id: input.policy_id,
                        step_ref,
                        run_ref,
                        last_error: input.error,
                    });
                }

                let initial_ms = record["initial_interval_ms"].as_i64().unwrap_or(1000);
                let coefficient = record["backoff_coefficient"].as_f64().unwrap_or(2.0);
                let max_ms = record["max_interval_ms"].as_i64().unwrap_or(60000);
                let next_attempt = attempt_count + 1;

                let delay_ms = calculate_delay(initial_ms, coefficient, next_attempt, max_ms);

                Ok(RetryPolicyShouldRetryOutput::Retry {
                    policy_id: input.policy_id,
                    delay_ms,
                    attempt: next_attempt,
                })
            }
        }
    }

    async fn record_attempt(
        &self,
        input: RetryPolicyRecordAttemptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetryPolicyRecordAttemptOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("retry_policies", &input.policy_id).await?;

        match existing {
            None => Ok(RetryPolicyRecordAttemptOutput::NotFound {
                policy_id: input.policy_id,
            }),
            Some(record) => {
                let attempt_count = record["attempt_count"].as_i64().unwrap_or(0) + 1;

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("attempt_count".to_string(), json!(attempt_count));
                    obj.insert("last_error".to_string(), json!(input.error));
                    obj.insert("last_attempt_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("retry_policies", &input.policy_id, updated).await?;

                Ok(RetryPolicyRecordAttemptOutput::Ok {
                    policy_id: input.policy_id,
                    attempt_count,
                })
            }
        }
    }

    async fn mark_succeeded(
        &self,
        input: RetryPolicyMarkSucceededInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetryPolicyMarkSucceededOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("retry_policies", &input.policy_id).await?;

        match existing {
            None => Ok(RetryPolicyMarkSucceededOutput::NotFound {
                policy_id: input.policy_id,
            }),
            Some(record) => {
                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("succeeded"));
                    obj.insert("succeeded_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("retry_policies", &input.policy_id, updated).await?;

                Ok(RetryPolicyMarkSucceededOutput::Ok {
                    policy_id: input.policy_id,
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_policy() {
        let storage = InMemoryStorage::new();
        let handler = RetryPolicyHandlerImpl;
        let result = handler.create(
            RetryPolicyCreateInput {
                step_ref: "fetch-data".to_string(),
                run_ref: "run-001".to_string(),
                max_attempts: 3,
                initial_interval_ms: 1000,
                backoff_coefficient: 2.0,
                max_interval_ms: 30000,
            },
            &storage,
        ).await.unwrap();
        match result {
            RetryPolicyCreateOutput::Ok { policy_id, step_ref, run_ref } => {
                assert!(policy_id.starts_with("rp-"));
                assert_eq!(step_ref, "fetch-data");
                assert_eq!(run_ref, "run-001");
            }
        }
    }

    #[tokio::test]
    async fn test_should_retry_with_attempts_remaining() {
        let storage = InMemoryStorage::new();
        let handler = RetryPolicyHandlerImpl;

        let create = handler.create(
            RetryPolicyCreateInput {
                step_ref: "api-call".to_string(),
                run_ref: "run-002".to_string(),
                max_attempts: 3,
                initial_interval_ms: 1000,
                backoff_coefficient: 2.0,
                max_interval_ms: 10000,
            },
            &storage,
        ).await.unwrap();
        let policy_id = match create {
            RetryPolicyCreateOutput::Ok { policy_id, .. } => policy_id,
        };

        let result = handler.should_retry(
            RetryPolicyShouldRetryInput { policy_id: policy_id.clone(), error: "timeout".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RetryPolicyShouldRetryOutput::Retry { delay_ms, attempt, .. } => {
                assert_eq!(attempt, 1);
                assert_eq!(delay_ms, 1000);
            }
            _ => panic!("Expected Retry variant"),
        }
    }

    #[tokio::test]
    async fn test_should_retry_exhausted() {
        let storage = InMemoryStorage::new();
        let handler = RetryPolicyHandlerImpl;

        let create = handler.create(
            RetryPolicyCreateInput {
                step_ref: "step-x".to_string(),
                run_ref: "run-003".to_string(),
                max_attempts: 2,
                initial_interval_ms: 500,
                backoff_coefficient: 1.5,
                max_interval_ms: 5000,
            },
            &storage,
        ).await.unwrap();
        let policy_id = match create {
            RetryPolicyCreateOutput::Ok { policy_id, .. } => policy_id,
        };

        // Record 2 attempts to reach max
        handler.record_attempt(
            RetryPolicyRecordAttemptInput { policy_id: policy_id.clone(), error: "err1".to_string() },
            &storage,
        ).await.unwrap();
        handler.record_attempt(
            RetryPolicyRecordAttemptInput { policy_id: policy_id.clone(), error: "err2".to_string() },
            &storage,
        ).await.unwrap();

        let result = handler.should_retry(
            RetryPolicyShouldRetryInput { policy_id: policy_id.clone(), error: "err3".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RetryPolicyShouldRetryOutput::Exhausted { last_error, .. } => {
                assert_eq!(last_error, "err3");
            }
            _ => panic!("Expected Exhausted variant"),
        }
    }

    #[tokio::test]
    async fn test_mark_succeeded() {
        let storage = InMemoryStorage::new();
        let handler = RetryPolicyHandlerImpl;

        let create = handler.create(
            RetryPolicyCreateInput {
                step_ref: "step-y".to_string(),
                run_ref: "run-004".to_string(),
                max_attempts: 5,
                initial_interval_ms: 1000,
                backoff_coefficient: 2.0,
                max_interval_ms: 30000,
            },
            &storage,
        ).await.unwrap();
        let policy_id = match create {
            RetryPolicyCreateOutput::Ok { policy_id, .. } => policy_id,
        };

        let result = handler.mark_succeeded(
            RetryPolicyMarkSucceededInput { policy_id: policy_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            RetryPolicyMarkSucceededOutput::Ok { .. } => {}
            _ => panic!("Expected Ok variant"),
        }
    }
}
