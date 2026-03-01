// Milestone concept implementation
// Tracks achievement of significant process goals declaratively,
// without prescribing which specific steps cause achievement.
// Status lifecycle: pending -> achieved -> revoked (back to pending)

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::MilestoneHandler;
use serde_json::json;

pub struct MilestoneHandlerImpl;

fn generate_milestone_id() -> String {
    format!("ms-{}", uuid::Uuid::new_v4())
}

/// Evaluate a simple condition expression against context.
/// Supports basic field presence check: "field_name == value"
/// and truthiness check: "field_name" (checks if field exists and is truthy).
fn evaluate_condition(condition_expr: &str, context: &serde_json::Value) -> bool {
    let trimmed = condition_expr.trim();

    // Handle "field == value" comparisons
    if let Some(pos) = trimmed.find("==") {
        let field = trimmed[..pos].trim();
        let expected = trimmed[pos + 2..].trim().trim_matches('"');
        if let Some(actual) = context.get(field) {
            return match actual {
                serde_json::Value::String(s) => s == expected,
                serde_json::Value::Bool(b) => {
                    (expected == "true" && *b) || (expected == "false" && !*b)
                }
                serde_json::Value::Number(n) => n.to_string() == expected,
                _ => false,
            };
        }
        return false;
    }

    // Simple truthiness: check if the named field exists and is truthy
    if let Some(val) = context.get(trimmed) {
        return match val {
            serde_json::Value::Null => false,
            serde_json::Value::Bool(b) => *b,
            serde_json::Value::Number(n) => n.as_f64().unwrap_or(0.0) != 0.0,
            serde_json::Value::String(s) => !s.is_empty(),
            _ => true,
        };
    }

    false
}

#[async_trait]
impl MilestoneHandler for MilestoneHandlerImpl {
    async fn define(
        &self,
        input: MilestoneDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MilestoneDefineOutput, Box<dyn std::error::Error>> {
        let milestone_id = generate_milestone_id();
        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("milestones", &milestone_id, json!({
            "milestone_id": milestone_id,
            "run_ref": input.run_ref,
            "name": input.name,
            "condition_expr": input.condition_expr,
            "status": "pending",
            "achieved_at": null,
            "created_at": timestamp,
        })).await?;

        Ok(MilestoneDefineOutput::Ok {
            milestone_id,
            name: input.name,
            status: "pending".to_string(),
        })
    }

    async fn evaluate(
        &self,
        input: MilestoneEvaluateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MilestoneEvaluateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("milestones", &input.milestone_id).await?;

        match existing {
            None => Ok(MilestoneEvaluateOutput::NotFound {
                milestone_id: input.milestone_id,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown");
                if current_status == "achieved" {
                    return Ok(MilestoneEvaluateOutput::AlreadyAchieved {
                        milestone_id: input.milestone_id,
                    });
                }

                let condition_expr = record["condition_expr"].as_str().unwrap_or("");
                let name = record["name"].as_str().unwrap_or("").to_string();
                let run_ref = record["run_ref"].as_str().unwrap_or("").to_string();

                if evaluate_condition(condition_expr, &input.context) {
                    let mut updated = record.clone();
                    if let Some(obj) = updated.as_object_mut() {
                        obj.insert("status".to_string(), json!("achieved"));
                        obj.insert("achieved_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                    }
                    storage.put("milestones", &input.milestone_id, updated).await?;

                    Ok(MilestoneEvaluateOutput::Achieved {
                        milestone_id: input.milestone_id,
                        name,
                        run_ref,
                    })
                } else {
                    Ok(MilestoneEvaluateOutput::NotYet {
                        milestone_id: input.milestone_id,
                    })
                }
            }
        }
    }

    async fn revoke(
        &self,
        input: MilestoneRevokeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MilestoneRevokeOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("milestones", &input.milestone_id).await?;

        match existing {
            None => Ok(MilestoneRevokeOutput::NotFound {
                milestone_id: input.milestone_id,
            }),
            Some(record) => {
                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("pending"));
                    obj.insert("achieved_at".to_string(), json!(null));
                    obj.insert("revoked_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }
                storage.put("milestones", &input.milestone_id, updated).await?;

                Ok(MilestoneRevokeOutput::Ok {
                    milestone_id: input.milestone_id,
                    status: "pending".to_string(),
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
    async fn test_define_creates_pending() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;
        let result = handler.define(
            MilestoneDefineInput {
                run_ref: "run-001".to_string(),
                name: "kyc_complete".to_string(),
                condition_expr: "kyc_verified == true".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            MilestoneDefineOutput::Ok { milestone_id, name, status } => {
                assert!(milestone_id.starts_with("ms-"));
                assert_eq!(name, "kyc_complete");
                assert_eq!(status, "pending");
            }
        }
    }

    #[tokio::test]
    async fn test_evaluate_achieved() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        let def = handler.define(
            MilestoneDefineInput {
                run_ref: "run-002".to_string(),
                name: "payment_received".to_string(),
                condition_expr: "paid == true".to_string(),
            },
            &storage,
        ).await.unwrap();
        let ms_id = match def {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        let result = handler.evaluate(
            MilestoneEvaluateInput {
                milestone_id: ms_id.clone(),
                context: json!({ "paid": true }),
            },
            &storage,
        ).await.unwrap();
        match result {
            MilestoneEvaluateOutput::Achieved { name, run_ref, .. } => {
                assert_eq!(name, "payment_received");
                assert_eq!(run_ref, "run-002");
            }
            _ => panic!("Expected Achieved variant"),
        }
    }

    #[tokio::test]
    async fn test_evaluate_not_yet() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        let def = handler.define(
            MilestoneDefineInput {
                run_ref: "run-003".to_string(),
                name: "approval_done".to_string(),
                condition_expr: "approved == true".to_string(),
            },
            &storage,
        ).await.unwrap();
        let ms_id = match def {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        let result = handler.evaluate(
            MilestoneEvaluateInput {
                milestone_id: ms_id,
                context: json!({ "approved": false }),
            },
            &storage,
        ).await.unwrap();
        match result {
            MilestoneEvaluateOutput::NotYet { .. } => {}
            _ => panic!("Expected NotYet variant"),
        }
    }

    #[tokio::test]
    async fn test_revoke_resets_to_pending() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        let def = handler.define(
            MilestoneDefineInput {
                run_ref: "run-004".to_string(),
                name: "in_stock".to_string(),
                condition_expr: "quantity".to_string(),
            },
            &storage,
        ).await.unwrap();
        let ms_id = match def {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        handler.evaluate(
            MilestoneEvaluateInput {
                milestone_id: ms_id.clone(),
                context: json!({ "quantity": 10 }),
            },
            &storage,
        ).await.unwrap();

        let result = handler.revoke(
            MilestoneRevokeInput { milestone_id: ms_id },
            &storage,
        ).await.unwrap();
        match result {
            MilestoneRevokeOutput::Ok { status, .. } => {
                assert_eq!(status, "pending");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_evaluate_already_achieved() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        let def = handler.define(
            MilestoneDefineInput {
                run_ref: "run-005".to_string(),
                name: "done".to_string(),
                condition_expr: "complete == true".to_string(),
            },
            &storage,
        ).await.unwrap();
        let ms_id = match def {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        handler.evaluate(
            MilestoneEvaluateInput {
                milestone_id: ms_id.clone(),
                context: json!({ "complete": true }),
            },
            &storage,
        ).await.unwrap();

        let result = handler.evaluate(
            MilestoneEvaluateInput {
                milestone_id: ms_id,
                context: json!({ "complete": true }),
            },
            &storage,
        ).await.unwrap();
        match result {
            MilestoneEvaluateOutput::AlreadyAchieved { .. } => {}
            _ => panic!("Expected AlreadyAchieved variant"),
        }
    }
}
