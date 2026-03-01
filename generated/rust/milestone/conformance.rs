// generated: milestone/conformance.rs
// Conformance tests for Milestone concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::MilestoneHandler;
    use super::super::r#impl::MilestoneHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    fn create_test_handler() -> MilestoneHandlerImpl {
        MilestoneHandlerImpl
    }

    #[tokio::test]
    async fn milestone_invariant_define_evaluate_achieve() {
        // Invariant: define -> evaluate with true condition -> achieved
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let def = handler.define(
            MilestoneDefineInput {
                run_ref: "run-inv-001".to_string(),
                name: "payment_complete".to_string(),
                condition_expr: "paid == true".to_string(),
            },
            &storage,
        ).await.unwrap();
        let ms_id = match def {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        let eval = handler.evaluate(
            MilestoneEvaluateInput {
                milestone_id: ms_id,
                context: json!({ "paid": true }),
            },
            &storage,
        ).await.unwrap();
        match eval {
            MilestoneEvaluateOutput::Achieved { name, .. } => {
                assert_eq!(name, "payment_complete");
            }
            _ => panic!("Expected Achieved"),
        }
    }

    #[tokio::test]
    async fn milestone_invariant_revoke_allows_re_evaluate() {
        // Invariant: after revoke, milestone can be re-evaluated
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let def = handler.define(
            MilestoneDefineInput {
                run_ref: "run-inv-002".to_string(),
                name: "inventory_ok".to_string(),
                condition_expr: "stock".to_string(),
            },
            &storage,
        ).await.unwrap();
        let ms_id = match def {
            MilestoneDefineOutput::Ok { milestone_id, .. } => milestone_id,
        };

        // Achieve it
        handler.evaluate(
            MilestoneEvaluateInput {
                milestone_id: ms_id.clone(),
                context: json!({ "stock": 50 }),
            },
            &storage,
        ).await.unwrap();

        // Revoke it
        handler.revoke(
            MilestoneRevokeInput { milestone_id: ms_id.clone() },
            &storage,
        ).await.unwrap();

        // Re-evaluate with false condition
        let eval = handler.evaluate(
            MilestoneEvaluateInput {
                milestone_id: ms_id,
                context: json!({ "stock": 0 }),
            },
            &storage,
        ).await.unwrap();
        match eval {
            MilestoneEvaluateOutput::NotYet { .. } => {}
            _ => panic!("Expected NotYet after revoke + false condition"),
        }
    }
}
