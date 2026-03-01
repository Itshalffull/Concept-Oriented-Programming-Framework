// Business logic tests for Milestone concept.
// Validates condition evaluation logic, revoke-then-re-achieve cycles,
// idempotent achievement detection, and various condition expression formats.

#[cfg(test)]
mod tests {
    use super::super::handler::MilestoneHandler;
    use super::super::r#impl::MilestoneHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_equality_condition_with_string_value() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        let def = handler.define(MilestoneDefineInput {
            run_ref: "run-str".to_string(),
            name: "status_check".to_string(),
            condition_expr: "status == approved".to_string(),
        }, &storage).await.unwrap();
        let ms_id = match def {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        // Wrong value
        let result = handler.evaluate(MilestoneEvaluateInput {
            milestone_id: ms_id.clone(),
            context: json!({"status": "pending"}),
        }, &storage).await.unwrap();
        match result {
            MilestoneEvaluateOutput::NotYet { .. } => {}
            _ => panic!("Expected NotYet"),
        }

        // Correct value
        let result = handler.evaluate(MilestoneEvaluateInput {
            milestone_id: ms_id.clone(),
            context: json!({"status": "approved"}),
        }, &storage).await.unwrap();
        match result {
            MilestoneEvaluateOutput::Achieved { name, .. } => {
                assert_eq!(name, "status_check");
            }
            _ => panic!("Expected Achieved"),
        }
    }

    #[tokio::test]
    async fn test_numeric_equality_condition() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        let def = handler.define(MilestoneDefineInput {
            run_ref: "run-num".to_string(),
            name: "threshold_met".to_string(),
            condition_expr: "count == 10".to_string(),
        }, &storage).await.unwrap();
        let ms_id = match def {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        let not_yet = handler.evaluate(MilestoneEvaluateInput {
            milestone_id: ms_id.clone(),
            context: json!({"count": 5}),
        }, &storage).await.unwrap();
        match not_yet {
            MilestoneEvaluateOutput::NotYet { .. } => {}
            _ => panic!("Expected NotYet"),
        }

        let achieved = handler.evaluate(MilestoneEvaluateInput {
            milestone_id: ms_id.clone(),
            context: json!({"count": 10}),
        }, &storage).await.unwrap();
        match achieved {
            MilestoneEvaluateOutput::Achieved { .. } => {}
            _ => panic!("Expected Achieved"),
        }
    }

    #[tokio::test]
    async fn test_truthiness_condition_with_various_types() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        // Truthy: non-empty string
        let def1 = handler.define(MilestoneDefineInput {
            run_ref: "run-truth".to_string(),
            name: "has_name".to_string(),
            condition_expr: "name".to_string(),
        }, &storage).await.unwrap();
        let ms1 = match def1 {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        let r1 = handler.evaluate(MilestoneEvaluateInput {
            milestone_id: ms1.clone(),
            context: json!({"name": "Alice"}),
        }, &storage).await.unwrap();
        match r1 {
            MilestoneEvaluateOutput::Achieved { .. } => {}
            _ => panic!("Expected Achieved for non-empty string"),
        }

        // Falsy: empty string
        let def2 = handler.define(MilestoneDefineInput {
            run_ref: "run-truth2".to_string(),
            name: "has_value".to_string(),
            condition_expr: "value".to_string(),
        }, &storage).await.unwrap();
        let ms2 = match def2 {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        let r2 = handler.evaluate(MilestoneEvaluateInput {
            milestone_id: ms2.clone(),
            context: json!({"value": ""}),
        }, &storage).await.unwrap();
        match r2 {
            MilestoneEvaluateOutput::NotYet { .. } => {}
            _ => panic!("Expected NotYet for empty string"),
        }

        // Falsy: null
        let def3 = handler.define(MilestoneDefineInput {
            run_ref: "run-truth3".to_string(),
            name: "has_data".to_string(),
            condition_expr: "data".to_string(),
        }, &storage).await.unwrap();
        let ms3 = match def3 {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        let r3 = handler.evaluate(MilestoneEvaluateInput {
            milestone_id: ms3.clone(),
            context: json!({"data": null}),
        }, &storage).await.unwrap();
        match r3 {
            MilestoneEvaluateOutput::NotYet { .. } => {}
            _ => panic!("Expected NotYet for null"),
        }
    }

    #[tokio::test]
    async fn test_revoke_then_re_achieve() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        let def = handler.define(MilestoneDefineInput {
            run_ref: "run-revoke".to_string(),
            name: "in_stock".to_string(),
            condition_expr: "quantity".to_string(),
        }, &storage).await.unwrap();
        let ms_id = match def {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        // Achieve
        handler.evaluate(MilestoneEvaluateInput {
            milestone_id: ms_id.clone(),
            context: json!({"quantity": 50}),
        }, &storage).await.unwrap();

        // Revoke
        handler.revoke(MilestoneRevokeInput {
            milestone_id: ms_id.clone(),
        }, &storage).await.unwrap();

        // Re-achieve
        let result = handler.evaluate(MilestoneEvaluateInput {
            milestone_id: ms_id.clone(),
            context: json!({"quantity": 100}),
        }, &storage).await.unwrap();
        match result {
            MilestoneEvaluateOutput::Achieved { name, .. } => {
                assert_eq!(name, "in_stock");
            }
            _ => panic!("Expected Achieved after revoke"),
        }
    }

    #[tokio::test]
    async fn test_already_achieved_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        let def = handler.define(MilestoneDefineInput {
            run_ref: "run-idem".to_string(),
            name: "goal".to_string(),
            condition_expr: "done == true".to_string(),
        }, &storage).await.unwrap();
        let ms_id = match def {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        handler.evaluate(MilestoneEvaluateInput {
            milestone_id: ms_id.clone(),
            context: json!({"done": true}),
        }, &storage).await.unwrap();

        let result = handler.evaluate(MilestoneEvaluateInput {
            milestone_id: ms_id.clone(),
            context: json!({"done": true}),
        }, &storage).await.unwrap();
        match result {
            MilestoneEvaluateOutput::AlreadyAchieved { .. } => {}
            _ => panic!("Expected AlreadyAchieved"),
        }
    }

    #[tokio::test]
    async fn test_evaluate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        let result = handler.evaluate(MilestoneEvaluateInput {
            milestone_id: "ms-ghost".to_string(),
            context: json!({}),
        }, &storage).await.unwrap();
        match result {
            MilestoneEvaluateOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_revoke_not_found() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        let result = handler.revoke(MilestoneRevokeInput {
            milestone_id: "ms-ghost".to_string(),
        }, &storage).await.unwrap();
        match result {
            MilestoneRevokeOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_revoke_pending_milestone() {
        // Revoking a pending milestone should still work (sets status to pending)
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        let def = handler.define(MilestoneDefineInput {
            run_ref: "run-rp".to_string(),
            name: "never_achieved".to_string(),
            condition_expr: "impossible == true".to_string(),
        }, &storage).await.unwrap();
        let ms_id = match def {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        let result = handler.revoke(MilestoneRevokeInput {
            milestone_id: ms_id.clone(),
        }, &storage).await.unwrap();
        match result {
            MilestoneRevokeOutput::Ok { status, .. } => {
                assert_eq!(status, "pending");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_condition_missing_field_returns_not_yet() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        let def = handler.define(MilestoneDefineInput {
            run_ref: "run-missing".to_string(),
            name: "needs_field".to_string(),
            condition_expr: "missing_field == true".to_string(),
        }, &storage).await.unwrap();
        let ms_id = match def {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        let result = handler.evaluate(MilestoneEvaluateInput {
            milestone_id: ms_id.clone(),
            context: json!({"other_field": true}),
        }, &storage).await.unwrap();
        match result {
            MilestoneEvaluateOutput::NotYet { .. } => {}
            _ => panic!("Expected NotYet when condition field is missing"),
        }
    }

    #[tokio::test]
    async fn test_boolean_false_condition() {
        let storage = InMemoryStorage::new();
        let handler = MilestoneHandlerImpl;

        let def = handler.define(MilestoneDefineInput {
            run_ref: "run-false".to_string(),
            name: "check_false".to_string(),
            condition_expr: "flag == false".to_string(),
        }, &storage).await.unwrap();
        let ms_id = match def {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        let result = handler.evaluate(MilestoneEvaluateInput {
            milestone_id: ms_id.clone(),
            context: json!({"flag": false}),
        }, &storage).await.unwrap();
        match result {
            MilestoneEvaluateOutput::Achieved { .. } => {}
            _ => panic!("Expected Achieved for flag == false"),
        }
    }
}
