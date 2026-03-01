// EvaluationRun concept implementation
// Executes quality evaluations against step outputs and tracks metrics.
// Actual evaluation logic is delegated to evaluator providers.
// Status lifecycle: running -> passed|failed

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::EvaluationRunHandler;
use serde_json::json;

pub struct EvaluationRunHandlerImpl;

fn generate_eval_id() -> String {
    format!("eval-{}", uuid::Uuid::new_v4())
}

#[async_trait]
impl EvaluationRunHandler for EvaluationRunHandlerImpl {
    async fn run_eval(
        &self,
        input: EvaluationRunRunEvalInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvaluationRunRunEvalOutput, Box<dyn std::error::Error>> {
        let eval_id = generate_eval_id();
        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("evaluation_runs", &eval_id, json!({
            "eval_id": eval_id,
            "step_ref": input.step_ref,
            "evaluator_type": input.evaluator_type,
            "input": input.input,
            "threshold": input.threshold,
            "status": "running",
            "score": null,
            "feedback": null,
            "metrics": [],
            "created_at": timestamp,
        })).await?;

        Ok(EvaluationRunRunEvalOutput::Ok {
            eval_id,
            step_ref: input.step_ref,
            evaluator_type: input.evaluator_type,
            status: "running".to_string(),
        })
    }

    async fn log_metric(
        &self,
        input: EvaluationRunLogMetricInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvaluationRunLogMetricOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("evaluation_runs", &input.eval_id).await?;

        match existing {
            None => Ok(EvaluationRunLogMetricOutput::NotFound {
                eval_id: input.eval_id,
            }),
            Some(record) => {
                let mut metrics = record["metrics"].as_array().cloned().unwrap_or_default();
                metrics.push(json!({
                    "name": input.metric_name,
                    "value": input.metric_value,
                    "logged_at": chrono::Utc::now().to_rfc3339(),
                }));

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("metrics".to_string(), json!(metrics));
                }
                storage.put("evaluation_runs", &input.eval_id, updated).await?;

                Ok(EvaluationRunLogMetricOutput::Ok {
                    eval_id: input.eval_id,
                })
            }
        }
    }

    async fn pass(
        &self,
        input: EvaluationRunPassInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvaluationRunPassOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("evaluation_runs", &input.eval_id).await?;

        match existing {
            None => Ok(EvaluationRunPassOutput::NotFound {
                eval_id: input.eval_id,
            }),
            Some(record) => {
                let step_ref = record["step_ref"].as_str().unwrap_or("").to_string();

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("passed"));
                    obj.insert("score".to_string(), json!(input.score));
                    obj.insert("feedback".to_string(), json!(input.feedback));
                    obj.insert("evaluated_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }
                storage.put("evaluation_runs", &input.eval_id, updated).await?;

                Ok(EvaluationRunPassOutput::Ok {
                    eval_id: input.eval_id,
                    step_ref,
                    status: "passed".to_string(),
                })
            }
        }
    }

    async fn fail(
        &self,
        input: EvaluationRunFailInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvaluationRunFailOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("evaluation_runs", &input.eval_id).await?;

        match existing {
            None => Ok(EvaluationRunFailOutput::NotFound {
                eval_id: input.eval_id,
            }),
            Some(record) => {
                let step_ref = record["step_ref"].as_str().unwrap_or("").to_string();

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("failed"));
                    obj.insert("score".to_string(), json!(input.score));
                    obj.insert("feedback".to_string(), json!(input.feedback));
                    obj.insert("evaluated_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }
                storage.put("evaluation_runs", &input.eval_id, updated).await?;

                Ok(EvaluationRunFailOutput::Failed {
                    eval_id: input.eval_id,
                    step_ref,
                    feedback: input.feedback,
                })
            }
        }
    }

    async fn get_result(
        &self,
        input: EvaluationRunGetResultInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvaluationRunGetResultOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("evaluation_runs", &input.eval_id).await?;

        match existing {
            None => Ok(EvaluationRunGetResultOutput::NotFound {
                eval_id: input.eval_id,
            }),
            Some(record) => Ok(EvaluationRunGetResultOutput::Ok {
                eval_id: input.eval_id,
                status: record["status"].as_str().unwrap_or("unknown").to_string(),
                score: record["score"].as_f64().unwrap_or(0.0),
                feedback: record["feedback"].as_str().unwrap_or("").to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_run_eval_creates_running() {
        let storage = InMemoryStorage::new();
        let handler = EvaluationRunHandlerImpl;
        let result = handler.run_eval(
            EvaluationRunRunEvalInput {
                step_ref: "gen-email".to_string(),
                evaluator_type: "llm_judge".to_string(),
                input: json!({ "text": "Dear customer..." }),
                threshold: 0.8,
            },
            &storage,
        ).await.unwrap();
        match result {
            EvaluationRunRunEvalOutput::Ok { eval_id, status, .. } => {
                assert!(eval_id.starts_with("eval-"));
                assert_eq!(status, "running");
            }
        }
    }

    #[tokio::test]
    async fn test_log_metric_and_pass() {
        let storage = InMemoryStorage::new();
        let handler = EvaluationRunHandlerImpl;

        let run = handler.run_eval(
            EvaluationRunRunEvalInput {
                step_ref: "classify".to_string(),
                evaluator_type: "schema".to_string(),
                input: json!({ "label": "spam" }),
                threshold: 0.9,
            },
            &storage,
        ).await.unwrap();
        let eval_id = match run {
            EvaluationRunRunEvalOutput::Ok { eval_id, .. } => eval_id,
        };

        handler.log_metric(
            EvaluationRunLogMetricInput {
                eval_id: eval_id.clone(),
                metric_name: "accuracy".to_string(),
                metric_value: 0.95,
            },
            &storage,
        ).await.unwrap();

        let result = handler.pass(
            EvaluationRunPassInput {
                eval_id: eval_id.clone(),
                score: 0.95,
                feedback: "Excellent classification".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EvaluationRunPassOutput::Ok { status, .. } => assert_eq!(status, "passed"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_fail_eval() {
        let storage = InMemoryStorage::new();
        let handler = EvaluationRunHandlerImpl;

        let run = handler.run_eval(
            EvaluationRunRunEvalInput {
                step_ref: "gen".to_string(),
                evaluator_type: "rubric".to_string(),
                input: json!("bad output"),
                threshold: 0.7,
            },
            &storage,
        ).await.unwrap();
        let eval_id = match run {
            EvaluationRunRunEvalOutput::Ok { eval_id, .. } => eval_id,
        };

        let result = handler.fail(
            EvaluationRunFailInput {
                eval_id: eval_id.clone(),
                score: 0.3,
                feedback: "Below threshold".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EvaluationRunFailOutput::Failed { feedback, .. } => {
                assert_eq!(feedback, "Below threshold");
            }
            _ => panic!("Expected Failed variant"),
        }
    }

    #[tokio::test]
    async fn test_get_result_after_pass() {
        let storage = InMemoryStorage::new();
        let handler = EvaluationRunHandlerImpl;

        let run = handler.run_eval(
            EvaluationRunRunEvalInput {
                step_ref: "s".to_string(),
                evaluator_type: "regex".to_string(),
                input: json!("test"),
                threshold: 0.5,
            },
            &storage,
        ).await.unwrap();
        let eval_id = match run {
            EvaluationRunRunEvalOutput::Ok { eval_id, .. } => eval_id,
        };

        handler.pass(
            EvaluationRunPassInput {
                eval_id: eval_id.clone(),
                score: 1.0,
                feedback: "Perfect match".to_string(),
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
                assert_eq!(score, 1.0);
                assert_eq!(feedback, "Perfect match");
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
