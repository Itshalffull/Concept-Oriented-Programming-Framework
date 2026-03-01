// Business logic tests for EvaluationRun concept.
// Validates evaluation lifecycle, metric logging,
// pass/fail transitions, and result retrieval edge cases.

#[cfg(test)]
mod tests {
    use super::super::handler::EvaluationRunHandler;
    use super::super::r#impl::EvaluationRunHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_full_pass_lifecycle_with_metrics() {
        let storage = InMemoryStorage::new();
        let handler = EvaluationRunHandlerImpl;

        let run = handler.run_eval(EvaluationRunRunEvalInput {
            step_ref: "generate-email".to_string(),
            evaluator_type: "llm_judge".to_string(),
            input: json!({"text": "Dear customer, your order is ready."}),
            threshold: 0.8,
        }, &storage).await.unwrap();
        let eval_id = match run {
            EvaluationRunRunEvalOutput::Ok { eval_id, status, .. } => {
                assert_eq!(status, "running");
                eval_id
            }
        };

        // Log multiple metrics
        handler.log_metric(EvaluationRunLogMetricInput {
            eval_id: eval_id.clone(),
            metric_name: "tone_score".to_string(),
            metric_value: 0.92,
        }, &storage).await.unwrap();

        handler.log_metric(EvaluationRunLogMetricInput {
            eval_id: eval_id.clone(),
            metric_name: "grammar_score".to_string(),
            metric_value: 0.98,
        }, &storage).await.unwrap();

        handler.log_metric(EvaluationRunLogMetricInput {
            eval_id: eval_id.clone(),
            metric_name: "relevance".to_string(),
            metric_value: 0.85,
        }, &storage).await.unwrap();

        let pass = handler.pass(EvaluationRunPassInput {
            eval_id: eval_id.clone(),
            score: 0.917,
            feedback: "All quality criteria met".to_string(),
        }, &storage).await.unwrap();
        match pass {
            EvaluationRunPassOutput::Ok { status, step_ref, .. } => {
                assert_eq!(status, "passed");
                assert_eq!(step_ref, "generate-email");
            }
            _ => panic!("Expected Ok"),
        }

        let result = handler.get_result(EvaluationRunGetResultInput {
            eval_id: eval_id.clone(),
        }, &storage).await.unwrap();
        match result {
            EvaluationRunGetResultOutput::Ok { status, score, feedback, .. } => {
                assert_eq!(status, "passed");
                assert!((score - 0.917).abs() < 0.001);
                assert_eq!(feedback, "All quality criteria met");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_fail_lifecycle_with_low_score() {
        let storage = InMemoryStorage::new();
        let handler = EvaluationRunHandlerImpl;

        let run = handler.run_eval(EvaluationRunRunEvalInput {
            step_ref: "classify-intent".to_string(),
            evaluator_type: "schema_check".to_string(),
            input: json!({"label": "billing", "confidence": 0.3}),
            threshold: 0.7,
        }, &storage).await.unwrap();
        let eval_id = match run {
            EvaluationRunRunEvalOutput::Ok { eval_id, .. } => eval_id,
        };

        let fail = handler.fail(EvaluationRunFailInput {
            eval_id: eval_id.clone(),
            score: 0.3,
            feedback: "Confidence below threshold".to_string(),
        }, &storage).await.unwrap();
        match fail {
            EvaluationRunFailOutput::Failed { step_ref, feedback, .. } => {
                assert_eq!(step_ref, "classify-intent");
                assert_eq!(feedback, "Confidence below threshold");
            }
            _ => panic!("Expected Failed"),
        }
    }

    #[tokio::test]
    async fn test_get_result_while_running() {
        let storage = InMemoryStorage::new();
        let handler = EvaluationRunHandlerImpl;

        let run = handler.run_eval(EvaluationRunRunEvalInput {
            step_ref: "gen".to_string(),
            evaluator_type: "test".to_string(),
            input: json!("data"),
            threshold: 0.5,
        }, &storage).await.unwrap();
        let eval_id = match run {
            EvaluationRunRunEvalOutput::Ok { eval_id, .. } => eval_id,
        };

        let result = handler.get_result(EvaluationRunGetResultInput {
            eval_id: eval_id.clone(),
        }, &storage).await.unwrap();
        match result {
            EvaluationRunGetResultOutput::Ok { status, score, .. } => {
                assert_eq!(status, "running");
                assert_eq!(score, 0.0);
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_get_result_not_found() {
        let storage = InMemoryStorage::new();
        let handler = EvaluationRunHandlerImpl;

        let result = handler.get_result(EvaluationRunGetResultInput {
            eval_id: "eval-missing".to_string(),
        }, &storage).await.unwrap();
        match result {
            EvaluationRunGetResultOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_pass_not_found() {
        let storage = InMemoryStorage::new();
        let handler = EvaluationRunHandlerImpl;

        let result = handler.pass(EvaluationRunPassInput {
            eval_id: "eval-ghost".to_string(),
            score: 1.0,
            feedback: "perfect".to_string(),
        }, &storage).await.unwrap();
        match result {
            EvaluationRunPassOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_fail_not_found() {
        let storage = InMemoryStorage::new();
        let handler = EvaluationRunHandlerImpl;

        let result = handler.fail(EvaluationRunFailInput {
            eval_id: "eval-ghost".to_string(),
            score: 0.0,
            feedback: "bad".to_string(),
        }, &storage).await.unwrap();
        match result {
            EvaluationRunFailOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_log_metric_not_found() {
        let storage = InMemoryStorage::new();
        let handler = EvaluationRunHandlerImpl;

        let result = handler.log_metric(EvaluationRunLogMetricInput {
            eval_id: "eval-ghost".to_string(),
            metric_name: "accuracy".to_string(),
            metric_value: 0.5,
        }, &storage).await.unwrap();
        match result {
            EvaluationRunLogMetricOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_multiple_evaluations_independent() {
        let storage = InMemoryStorage::new();
        let handler = EvaluationRunHandlerImpl;

        let run1 = handler.run_eval(EvaluationRunRunEvalInput {
            step_ref: "step-a".to_string(),
            evaluator_type: "rubric".to_string(),
            input: json!("output a"),
            threshold: 0.5,
        }, &storage).await.unwrap();
        let id1 = match run1 {
            EvaluationRunRunEvalOutput::Ok { eval_id, .. } => eval_id,
        };

        let run2 = handler.run_eval(EvaluationRunRunEvalInput {
            step_ref: "step-b".to_string(),
            evaluator_type: "regex".to_string(),
            input: json!("output b"),
            threshold: 0.9,
        }, &storage).await.unwrap();
        let id2 = match run2 {
            EvaluationRunRunEvalOutput::Ok { eval_id, .. } => eval_id,
        };

        // Pass first, fail second
        handler.pass(EvaluationRunPassInput {
            eval_id: id1.clone(),
            score: 0.8,
            feedback: "Good".to_string(),
        }, &storage).await.unwrap();

        handler.fail(EvaluationRunFailInput {
            eval_id: id2.clone(),
            score: 0.4,
            feedback: "Regex mismatch".to_string(),
        }, &storage).await.unwrap();

        let r1 = handler.get_result(EvaluationRunGetResultInput { eval_id: id1 }, &storage).await.unwrap();
        match r1 {
            EvaluationRunGetResultOutput::Ok { status, .. } => assert_eq!(status, "passed"),
            _ => panic!("Expected Ok"),
        }

        let r2 = handler.get_result(EvaluationRunGetResultInput { eval_id: id2 }, &storage).await.unwrap();
        match r2 {
            EvaluationRunGetResultOutput::Ok { status, .. } => assert_eq!(status, "failed"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_edge_score_values() {
        let storage = InMemoryStorage::new();
        let handler = EvaluationRunHandlerImpl;

        // Score of exactly 0.0
        let run = handler.run_eval(EvaluationRunRunEvalInput {
            step_ref: "zero-score".to_string(),
            evaluator_type: "test".to_string(),
            input: json!("empty"),
            threshold: 0.0,
        }, &storage).await.unwrap();
        let eval_id = match run {
            EvaluationRunRunEvalOutput::Ok { eval_id, .. } => eval_id,
        };

        handler.pass(EvaluationRunPassInput {
            eval_id: eval_id.clone(),
            score: 0.0,
            feedback: "Zero score pass".to_string(),
        }, &storage).await.unwrap();

        let result = handler.get_result(EvaluationRunGetResultInput {
            eval_id: eval_id.clone(),
        }, &storage).await.unwrap();
        match result {
            EvaluationRunGetResultOutput::Ok { score, status, .. } => {
                assert_eq!(score, 0.0);
                assert_eq!(status, "passed");
            }
            _ => panic!("Expected Ok"),
        }
    }
}
