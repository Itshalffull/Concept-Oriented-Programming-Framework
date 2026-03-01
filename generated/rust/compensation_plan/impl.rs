// CompensationPlan concept implementation
// Tracks compensating actions for saga-style rollback. As forward steps complete,
// their undo actions are registered. On failure, compensations execute in reverse order.
// Status lifecycle: dormant -> triggered -> executing -> completed|failed

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CompensationPlanHandler;
use serde_json::json;

pub struct CompensationPlanHandlerImpl;

fn generate_plan_id() -> String {
    format!("cp-{}", uuid::Uuid::new_v4())
}

fn plan_key(run_ref: &str) -> String {
    format!("plan::{}", run_ref)
}

#[async_trait]
impl CompensationPlanHandler for CompensationPlanHandlerImpl {
    async fn register(
        &self,
        input: CompensationPlanRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CompensationPlanRegisterOutput, Box<dyn std::error::Error>> {
        let key = plan_key(&input.run_ref);
        let existing = storage.get("compensation_plans", &key).await?;

        let (plan_id, mut compensations) = match existing {
            Some(record) => {
                let id = record["plan_id"].as_str().unwrap_or("").to_string();
                let comps = record["compensations"].as_array()
                    .cloned()
                    .unwrap_or_default();
                (id, comps)
            }
            None => (generate_plan_id(), Vec::new()),
        };

        compensations.push(json!({
            "step_key": input.step_key,
            "action_descriptor": input.action_descriptor,
            "registered_at": chrono::Utc::now().to_rfc3339(),
        }));

        let count = compensations.len() as i64;

        storage.put("compensation_plans", &key, json!({
            "plan_id": plan_id,
            "run_ref": input.run_ref,
            "status": "dormant",
            "compensations": compensations,
            "current_index": -1,
        })).await?;

        Ok(CompensationPlanRegisterOutput::Ok {
            plan_id,
            run_ref: input.run_ref,
            compensation_count: count,
        })
    }

    async fn trigger(
        &self,
        input: CompensationPlanTriggerInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CompensationPlanTriggerOutput, Box<dyn std::error::Error>> {
        let key = plan_key(&input.run_ref);
        let existing = storage.get("compensation_plans", &key).await?;

        match existing {
            None => Ok(CompensationPlanTriggerOutput::Empty {
                run_ref: input.run_ref,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "dormant" {
                    return Ok(CompensationPlanTriggerOutput::AlreadyTriggered {
                        run_ref: input.run_ref,
                        current_status,
                    });
                }

                let compensations = record["compensations"].as_array();
                if compensations.map_or(true, |c| c.is_empty()) {
                    return Ok(CompensationPlanTriggerOutput::Empty {
                        run_ref: input.run_ref,
                    });
                }

                let last_index = compensations.unwrap().len() as i64 - 1;
                let plan_id = record["plan_id"].as_str().unwrap_or("").to_string();

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("triggered"));
                    obj.insert("current_index".to_string(), json!(last_index));
                    obj.insert("triggered_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("compensation_plans", &key, updated).await?;

                Ok(CompensationPlanTriggerOutput::Ok {
                    plan_id,
                    status: "triggered".to_string(),
                })
            }
        }
    }

    async fn execute_next(
        &self,
        input: CompensationPlanExecuteNextInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CompensationPlanExecuteNextOutput, Box<dyn std::error::Error>> {
        // Find plan by plan_id across all stored plans
        let all_plans = storage.find("compensation_plans", Some(&json!({
            "plan_id": input.plan_id,
        }))).await?;

        let record = match all_plans.into_iter().next() {
            None => return Ok(CompensationPlanExecuteNextOutput::NotFound {
                plan_id: input.plan_id,
            }),
            Some(r) => r,
        };

        let current_index = record["current_index"].as_i64().unwrap_or(-1);
        let run_ref = record["run_ref"].as_str().unwrap_or("").to_string();

        if current_index < 0 {
            // All compensations executed
            let key = plan_key(&run_ref);
            let mut updated = record.clone();
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("status".to_string(), json!("completed"));
                obj.insert("completed_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
            }
            storage.put("compensation_plans", &key, updated).await?;

            return Ok(CompensationPlanExecuteNextOutput::AllDone {
                plan_id: input.plan_id,
            });
        }

        let compensations = record["compensations"].as_array();
        let comp = compensations
            .and_then(|c| c.get(current_index as usize))
            .cloned()
            .unwrap_or(json!({}));

        let step_key = comp["step_key"].as_str().unwrap_or("").to_string();
        let action_descriptor = comp["action_descriptor"].as_str().unwrap_or("").to_string();

        // Decrement index
        let key = plan_key(&run_ref);
        let mut updated = record.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("status".to_string(), json!("executing"));
            obj.insert("current_index".to_string(), json!(current_index - 1));
        }
        storage.put("compensation_plans", &key, updated).await?;

        Ok(CompensationPlanExecuteNextOutput::Ok {
            plan_id: input.plan_id,
            step_key,
            action_descriptor,
        })
    }

    async fn mark_compensation_failed(
        &self,
        input: CompensationPlanMarkFailedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CompensationPlanMarkFailedOutput, Box<dyn std::error::Error>> {
        let all_plans = storage.find("compensation_plans", Some(&json!({
            "plan_id": input.plan_id,
        }))).await?;

        let record = match all_plans.into_iter().next() {
            None => return Ok(CompensationPlanMarkFailedOutput::NotFound {
                plan_id: input.plan_id,
            }),
            Some(r) => r,
        };

        let run_ref = record["run_ref"].as_str().unwrap_or("").to_string();
        let key = plan_key(&run_ref);

        let mut updated = record.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("status".to_string(), json!("failed"));
            obj.insert("failed_step_key".to_string(), json!(input.step_key));
            obj.insert("failure_error".to_string(), json!(input.error));
            obj.insert("failed_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
        }
        storage.put("compensation_plans", &key, updated).await?;

        Ok(CompensationPlanMarkFailedOutput::Ok {
            plan_id: input.plan_id,
            status: "failed".to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_and_trigger() {
        let storage = InMemoryStorage::new();
        let handler = CompensationPlanHandlerImpl;

        handler.register(
            CompensationPlanRegisterInput {
                run_ref: "run-001".to_string(),
                step_key: "create-user".to_string(),
                action_descriptor: "delete-user".to_string(),
            },
            &storage,
        ).await.unwrap();

        let reg2 = handler.register(
            CompensationPlanRegisterInput {
                run_ref: "run-001".to_string(),
                step_key: "charge-card".to_string(),
                action_descriptor: "refund-card".to_string(),
            },
            &storage,
        ).await.unwrap();
        match reg2 {
            CompensationPlanRegisterOutput::Ok { compensation_count, .. } => {
                assert_eq!(compensation_count, 2);
            }
        }

        let trigger = handler.trigger(
            CompensationPlanTriggerInput { run_ref: "run-001".to_string() },
            &storage,
        ).await.unwrap();
        match trigger {
            CompensationPlanTriggerOutput::Ok { status, .. } => {
                assert_eq!(status, "triggered");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_next_reverse_order() {
        let storage = InMemoryStorage::new();
        let handler = CompensationPlanHandlerImpl;

        let reg1 = handler.register(
            CompensationPlanRegisterInput {
                run_ref: "run-002".to_string(),
                step_key: "step-a".to_string(),
                action_descriptor: "undo-a".to_string(),
            },
            &storage,
        ).await.unwrap();
        let plan_id = match reg1 {
            CompensationPlanRegisterOutput::Ok { plan_id, .. } => plan_id,
        };

        handler.register(
            CompensationPlanRegisterInput {
                run_ref: "run-002".to_string(),
                step_key: "step-b".to_string(),
                action_descriptor: "undo-b".to_string(),
            },
            &storage,
        ).await.unwrap();

        handler.trigger(
            CompensationPlanTriggerInput { run_ref: "run-002".to_string() },
            &storage,
        ).await.unwrap();

        // First execute_next should return step-b (last registered = first compensated)
        let exec1 = handler.execute_next(
            CompensationPlanExecuteNextInput { plan_id: plan_id.clone() },
            &storage,
        ).await.unwrap();
        match exec1 {
            CompensationPlanExecuteNextOutput::Ok { step_key, action_descriptor, .. } => {
                assert_eq!(step_key, "step-b");
                assert_eq!(action_descriptor, "undo-b");
            }
            _ => panic!("Expected Ok variant"),
        }

        // Second should return step-a
        let exec2 = handler.execute_next(
            CompensationPlanExecuteNextInput { plan_id: plan_id.clone() },
            &storage,
        ).await.unwrap();
        match exec2 {
            CompensationPlanExecuteNextOutput::Ok { step_key, .. } => {
                assert_eq!(step_key, "step-a");
            }
            _ => panic!("Expected Ok variant"),
        }

        // Third should return AllDone
        let exec3 = handler.execute_next(
            CompensationPlanExecuteNextInput { plan_id: plan_id.clone() },
            &storage,
        ).await.unwrap();
        match exec3 {
            CompensationPlanExecuteNextOutput::AllDone { .. } => {}
            _ => panic!("Expected AllDone variant"),
        }
    }

    #[tokio::test]
    async fn test_trigger_empty_returns_empty() {
        let storage = InMemoryStorage::new();
        let handler = CompensationPlanHandlerImpl;

        let result = handler.trigger(
            CompensationPlanTriggerInput { run_ref: "run-empty".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            CompensationPlanTriggerOutput::Empty { .. } => {}
            _ => panic!("Expected Empty variant"),
        }
    }
}
