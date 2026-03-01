use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RolloutHandler;
use serde_json::json;

pub struct RolloutHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("rollout-{}-{}", t.as_secs(), t.subsec_nanos())
}

fn now_millis() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

const VALID_STRATEGIES: &[&str] = &["canary", "blue-green", "rolling", "linear", "exponential"];

#[async_trait]
impl RolloutHandler for RolloutHandlerImpl {
    async fn begin(
        &self,
        input: RolloutBeginInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RolloutBeginOutput, Box<dyn std::error::Error>> {
        if !VALID_STRATEGIES.contains(&input.strategy.as_str()) {
            return Ok(RolloutBeginOutput::InvalidStrategy {
                message: format!("Strategy '{}' is not supported. Valid: {:?}", input.strategy, VALID_STRATEGIES),
            });
        }

        let id = next_id();
        let now = now_millis();

        storage.put("rollout", &id, json!({
            "id": id,
            "plan": input.plan,
            "strategy": input.strategy,
            "steps": input.steps,
            "currentStep": 0,
            "currentWeight": 0,
            "status": "active",
            "startedAt": now,
            "pauseReason": null
        })).await?;

        Ok(RolloutBeginOutput::Ok { rollout: id })
    }

    async fn advance(
        &self,
        input: RolloutAdvanceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RolloutAdvanceOutput, Box<dyn std::error::Error>> {
        let record = storage.get("rollout", &input.rollout).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(RolloutAdvanceOutput::Complete { rollout: input.rollout }),
        };

        let status = record.get("status").and_then(|v| v.as_str()).unwrap_or("");
        if status == "paused" {
            let reason = record.get("pauseReason").and_then(|v| v.as_str()).unwrap_or("").to_string();
            return Ok(RolloutAdvanceOutput::Paused {
                rollout: input.rollout,
                reason,
            });
        }

        let steps = record.get("steps").and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0);
        let current_step = record.get("currentStep").and_then(|v| v.as_i64()).unwrap_or(0);

        if current_step as usize >= steps {
            let mut updated = record.clone();
            updated["status"] = json!("complete");
            updated["currentWeight"] = json!(100);
            storage.put("rollout", &input.rollout, updated).await?;
            return Ok(RolloutAdvanceOutput::Complete { rollout: input.rollout });
        }

        let new_step = current_step + 1;
        // Calculate weight based on strategy -- linear increment
        let new_weight = if steps > 0 {
            ((new_step as f64 / steps as f64) * 100.0) as i64
        } else {
            100
        };

        let new_status = if new_step as usize >= steps { "complete" } else { "active" };

        let mut updated = record.clone();
        updated["currentStep"] = json!(new_step);
        updated["currentWeight"] = json!(new_weight);
        updated["status"] = json!(new_status);
        storage.put("rollout", &input.rollout, updated).await?;

        if new_step as usize >= steps {
            Ok(RolloutAdvanceOutput::Complete { rollout: input.rollout })
        } else {
            Ok(RolloutAdvanceOutput::Ok {
                rollout: input.rollout,
                new_weight,
                step: new_step,
            })
        }
    }

    async fn pause(
        &self,
        input: RolloutPauseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RolloutPauseOutput, Box<dyn std::error::Error>> {
        if let Some(mut record) = storage.get("rollout", &input.rollout).await? {
            record["status"] = json!("paused");
            record["pauseReason"] = json!(input.reason);
            storage.put("rollout", &input.rollout, record).await?;
        }
        Ok(RolloutPauseOutput::Ok { rollout: input.rollout })
    }

    async fn resume(
        &self,
        input: RolloutResumeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RolloutResumeOutput, Box<dyn std::error::Error>> {
        let record = storage.get("rollout", &input.rollout).await?;
        let current_weight = record.as_ref()
            .and_then(|r| r.get("currentWeight").and_then(|v| v.as_i64()))
            .unwrap_or(0);

        if let Some(mut r) = record {
            r["status"] = json!("active");
            r["pauseReason"] = json!(null);
            storage.put("rollout", &input.rollout, r).await?;
        }

        Ok(RolloutResumeOutput::Ok {
            rollout: input.rollout,
            current_weight,
        })
    }

    async fn abort(
        &self,
        input: RolloutAbortInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RolloutAbortOutput, Box<dyn std::error::Error>> {
        let record = storage.get("rollout", &input.rollout).await?;
        if let Some(r) = &record {
            let status = r.get("status").and_then(|v| v.as_str()).unwrap_or("");
            if status == "complete" {
                return Ok(RolloutAbortOutput::AlreadyComplete { rollout: input.rollout });
            }
        }

        if let Some(mut r) = record {
            r["status"] = json!("aborted");
            r["currentWeight"] = json!(0);
            storage.put("rollout", &input.rollout, r).await?;
        }

        Ok(RolloutAbortOutput::Ok { rollout: input.rollout })
    }

    async fn status(
        &self,
        input: RolloutStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RolloutStatusOutput, Box<dyn std::error::Error>> {
        let record = storage.get("rollout", &input.rollout).await?;
        let r = record.unwrap_or(json!({}));

        let step = r.get("currentStep").and_then(|v| v.as_i64()).unwrap_or(0);
        let weight = r.get("currentWeight").and_then(|v| v.as_i64()).unwrap_or(0);
        let status = r.get("status").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
        let started_at = r.get("startedAt").and_then(|v| v.as_i64()).unwrap_or(0);
        let elapsed = now_millis() - started_at;

        Ok(RolloutStatusOutput::Ok {
            rollout: input.rollout,
            step,
            weight,
            status,
            elapsed,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_begin_success() {
        let storage = InMemoryStorage::new();
        let handler = RolloutHandlerImpl;
        let result = handler.begin(
            RolloutBeginInput {
                plan: "deploy-v2".to_string(),
                strategy: "canary".to_string(),
                steps: vec!["10%".to_string(), "50%".to_string(), "100%".to_string()],
            },
            &storage,
        ).await.unwrap();
        match result {
            RolloutBeginOutput::Ok { rollout } => {
                assert!(rollout.starts_with("rollout-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_begin_invalid_strategy() {
        let storage = InMemoryStorage::new();
        let handler = RolloutHandlerImpl;
        let result = handler.begin(
            RolloutBeginInput {
                plan: "p".to_string(),
                strategy: "invalid".to_string(),
                steps: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            RolloutBeginOutput::InvalidStrategy { .. } => {},
            _ => panic!("Expected InvalidStrategy variant"),
        }
    }

    #[tokio::test]
    async fn test_pause_and_resume() {
        let storage = InMemoryStorage::new();
        let handler = RolloutHandlerImpl;
        let begin = handler.begin(
            RolloutBeginInput {
                plan: "p".to_string(), strategy: "rolling".to_string(),
                steps: vec!["a".to_string(), "b".to_string()],
            },
            &storage,
        ).await.unwrap();
        let rollout_id = match begin { RolloutBeginOutput::Ok { rollout } => rollout, _ => panic!("") };

        handler.pause(
            RolloutPauseInput { rollout: rollout_id.clone(), reason: "issue".to_string() },
            &storage,
        ).await.unwrap();

        let result = handler.advance(
            RolloutAdvanceInput { rollout: rollout_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            RolloutAdvanceOutput::Paused { .. } => {},
            _ => panic!("Expected Paused variant"),
        }

        handler.resume(
            RolloutResumeInput { rollout: rollout_id },
            &storage,
        ).await.unwrap();
    }

    #[tokio::test]
    async fn test_abort() {
        let storage = InMemoryStorage::new();
        let handler = RolloutHandlerImpl;
        let begin = handler.begin(
            RolloutBeginInput {
                plan: "p".to_string(), strategy: "canary".to_string(),
                steps: vec!["a".to_string()],
            },
            &storage,
        ).await.unwrap();
        let rollout_id = match begin { RolloutBeginOutput::Ok { rollout } => rollout, _ => panic!("") };
        let result = handler.abort(
            RolloutAbortInput { rollout: rollout_id },
            &storage,
        ).await.unwrap();
        match result {
            RolloutAbortOutput::Ok { .. } => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_status() {
        let storage = InMemoryStorage::new();
        let handler = RolloutHandlerImpl;
        let result = handler.status(
            RolloutStatusInput { rollout: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RolloutStatusOutput::Ok { status, .. } => {
                assert_eq!(status, "unknown");
            },
        }
    }
}
