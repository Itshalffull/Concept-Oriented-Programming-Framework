// generated: evaluation_run/conformance.rs
// Conformance tests for EvaluationRun concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::EvaluationRunHandler;
    use super::super::r#impl::EvaluationRunHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    fn create_test_handler() -> EvaluationRunHandlerImpl {
        EvaluationRunHandlerImpl
    }

    #[tokio::test]
    async fn evaluation_run_invariant_pass_records_score() {
        // Invariant: passed evaluation preserves score and feedback
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let run = handler.run_eval(
            EvaluationRunRunEvalInput {
                step_ref: "gen-report".to_string(),
                evaluator_type: "llm_judge".to_string(),
                input: json!({ "report": "Q1 results..." }),
                threshold: 0.7,
            },
            &storage,
        ).await.unwrap();
        let eval_id = match run {
            EvaluationRunRunEvalOutput::Ok { eval_id, .. } => eval_id,
        };

        handler.pass(
            EvaluationRunPassInput {
                eval_id: eval_id.clone(),
                score: 0.85,
                feedback: "Good quality report".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.get_result(
            EvaluationRunGetResultInput { eval_id },
            &storage,
        ).await.unwrap();
        match result {
            EvaluationRunGetResultOutput::Ok { status, score, feedback, .. } => {
                assert_eq!(status, "passed");
                assert!((score - 0.85).abs() < 0.001);
                assert_eq!(feedback, "Good quality report");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn evaluation_run_invariant_fail_records_feedback() {
        // Invariant: failed evaluation preserves score and feedback
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let run = handler.run_eval(
            EvaluationRunRunEvalInput {
                step_ref: "classify".to_string(),
                evaluator_type: "schema".to_string(),
                input: json!({ "label": null }),
                threshold: 0.9,
            },
            &storage,
        ).await.unwrap();
        let eval_id = match run {
            EvaluationRunRunEvalOutput::Ok { eval_id, .. } => eval_id,
        };

        handler.fail(
            EvaluationRunFailInput {
                eval_id: eval_id.clone(),
                score: 0.2,
                feedback: "Missing required label".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.get_result(
            EvaluationRunGetResultInput { eval_id },
            &storage,
        ).await.unwrap();
        match result {
            EvaluationRunGetResultOutput::Ok { status, score, .. } => {
                assert_eq!(status, "failed");
                assert!((score - 0.2).abs() < 0.001);
            }
            _ => panic!("Expected Ok"),
        }
    }
}
