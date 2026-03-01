// GenerationPlan concept implementation
// Tracks generation run lifecycle: begin, recordStep, complete, status, summary, history.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::GenerationPlanHandler;
use serde_json::json;
use chrono::Utc;

pub struct GenerationPlanHandlerImpl;

#[async_trait]
impl GenerationPlanHandler for GenerationPlanHandlerImpl {
    async fn begin(
        &self,
        _input: GenerationPlanBeginInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GenerationPlanBeginOutput, Box<dyn std::error::Error>> {
        let run_id = format!("gen-run-{}", Utc::now().timestamp_millis());

        storage.put("run", &run_id, json!({
            "run": run_id,
            "status": "running",
            "startedAt": Utc::now().to_rfc3339(),
            "steps": "[]",
        })).await?;

        Ok(GenerationPlanBeginOutput::Ok { run: run_id })
    }

    async fn record_step(
        &self,
        input: GenerationPlanRecordStepInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GenerationPlanRecordStepOutput, Box<dyn std::error::Error>> {
        // Find the current active run
        let runs = storage.find("run", Some(&json!({"status": "running"}))).await?;
        if let Some(mut run_record) = runs.into_iter().last() {
            let run_id = run_record.get("run")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let mut steps: Vec<serde_json::Value> = run_record.get("steps")
                .and_then(|v| v.as_str())
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or_default();

            steps.push(json!({
                "stepKey": input.step_key,
                "status": input.status,
                "filesProduced": input.files_produced.unwrap_or(0),
                "duration": input.duration.unwrap_or(0),
                "cached": input.cached,
            }));

            run_record["steps"] = json!(serde_json::to_string(&steps)?);
            storage.put("run", &run_id, run_record).await?;
        }

        Ok(GenerationPlanRecordStepOutput::Ok)
    }

    async fn complete(
        &self,
        _input: GenerationPlanCompleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GenerationPlanCompleteOutput, Box<dyn std::error::Error>> {
        let runs = storage.find("run", Some(&json!({"status": "running"}))).await?;
        if let Some(mut run_record) = runs.into_iter().last() {
            let run_id = run_record.get("run")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            run_record["status"] = json!("completed");
            run_record["completedAt"] = json!(Utc::now().to_rfc3339());
            storage.put("run", &run_id, run_record).await?;

            return Ok(GenerationPlanCompleteOutput::Ok { run: run_id });
        }

        Ok(GenerationPlanCompleteOutput::Ok {
            run: "no-active-run".to_string(),
        })
    }

    async fn status(
        &self,
        input: GenerationPlanStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GenerationPlanStatusOutput, Box<dyn std::error::Error>> {
        let record = storage.get("run", &input.run).await?;

        let steps_str = record
            .as_ref()
            .and_then(|r| r.get("steps").and_then(|v| v.as_str()))
            .unwrap_or("[]");

        let steps: Vec<serde_json::Value> = serde_json::from_str(steps_str).unwrap_or_default();

        // The output type uses inline struct syntax which is not valid Rust.
        // We serialize steps back as a JSON string in the Vec<...> field.
        // Since the generated types have anonymous struct fields, we return the steps
        // as serialized JSON strings within a Vec.
        let step_strings: Vec<String> = steps.iter()
            .map(|s| serde_json::to_string(s).unwrap_or_default())
            .collect();

        // Note: The generated types.rs has invalid Rust syntax for inline struct fields.
        // We work around this by providing data in a compatible format.
        // In practice, this would need the types.rs to be fixed to use named structs.
        Ok(GenerationPlanStatusOutput::Ok {
            steps: step_strings,
        })
    }

    async fn summary(
        &self,
        input: GenerationPlanSummaryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GenerationPlanSummaryOutput, Box<dyn std::error::Error>> {
        let record = storage.get("run", &input.run).await?;

        let steps_str = record
            .as_ref()
            .and_then(|r| r.get("steps").and_then(|v| v.as_str()))
            .unwrap_or("[]");

        let steps: Vec<serde_json::Value> = serde_json::from_str(steps_str).unwrap_or_default();

        let total = steps.len() as i64;
        let mut executed: i64 = 0;
        let mut cached: i64 = 0;
        let mut failed: i64 = 0;
        let mut total_duration: i64 = 0;
        let mut files_produced: i64 = 0;

        for step in &steps {
            let status = step.get("status").and_then(|v| v.as_str()).unwrap_or("");
            let is_cached = step.get("cached").and_then(|v| v.as_bool()).unwrap_or(false);
            let duration = step.get("duration").and_then(|v| v.as_i64()).unwrap_or(0);
            let files = step.get("filesProduced").and_then(|v| v.as_i64()).unwrap_or(0);

            if is_cached {
                cached += 1;
            } else if status == "failed" || status == "error" {
                failed += 1;
            } else {
                executed += 1;
            }
            total_duration += duration;
            files_produced += files;
        }

        Ok(GenerationPlanSummaryOutput::Ok {
            total,
            executed,
            cached,
            failed,
            total_duration,
            files_produced,
        })
    }

    async fn history(
        &self,
        input: GenerationPlanHistoryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GenerationPlanHistoryOutput, Box<dyn std::error::Error>> {
        let all_runs = storage.find("run", None).await?;
        let limit = input.limit.unwrap_or(10) as usize;

        let mut run_summaries: Vec<String> = Vec::new();
        for (i, run) in all_runs.iter().enumerate() {
            if i >= limit { break; }

            let run_id = run.get("run").and_then(|v| v.as_str()).unwrap_or("");
            let started_at = run.get("startedAt").and_then(|v| v.as_str()).unwrap_or("");
            let completed_at = run.get("completedAt").and_then(|v| v.as_str());
            let steps_str = run.get("steps").and_then(|v| v.as_str()).unwrap_or("[]");
            let steps: Vec<serde_json::Value> = serde_json::from_str(steps_str).unwrap_or_default();

            let total = steps.len() as i64;
            let mut executed: i64 = 0;
            let mut cached_count: i64 = 0;
            let mut failed: i64 = 0;

            for step in &steps {
                let status = step.get("status").and_then(|v| v.as_str()).unwrap_or("");
                let is_cached = step.get("cached").and_then(|v| v.as_bool()).unwrap_or(false);
                if is_cached {
                    cached_count += 1;
                } else if status == "failed" || status == "error" {
                    failed += 1;
                } else {
                    executed += 1;
                }
            }

            let summary = json!({
                "run": run_id,
                "startedAt": started_at,
                "completedAt": completed_at,
                "total": total,
                "executed": executed,
                "cached": cached_count,
                "failed": failed,
            });
            run_summaries.push(serde_json::to_string(&summary)?);
        }

        Ok(GenerationPlanHistoryOutput::Ok {
            runs: run_summaries,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_begin_creates_run() {
        let storage = InMemoryStorage::new();
        let handler = GenerationPlanHandlerImpl;
        let result = handler.begin(
            GenerationPlanBeginInput {},
            &storage,
        ).await.unwrap();
        match result {
            GenerationPlanBeginOutput::Ok { run } => {
                assert!(run.starts_with("gen-run-"));
            },
        }
    }

    #[tokio::test]
    async fn test_record_step() {
        let storage = InMemoryStorage::new();
        let handler = GenerationPlanHandlerImpl;
        handler.begin(GenerationPlanBeginInput {}, &storage).await.unwrap();
        let result = handler.record_step(
            GenerationPlanRecordStepInput {
                step_key: "rust-gen".to_string(),
                status: "ok".to_string(),
                files_produced: Some(5),
                duration: Some(100),
                cached: false,
            },
            &storage,
        ).await.unwrap();
        match result {
            GenerationPlanRecordStepOutput::Ok => {},
        }
    }

    #[tokio::test]
    async fn test_complete() {
        let storage = InMemoryStorage::new();
        let handler = GenerationPlanHandlerImpl;
        handler.begin(GenerationPlanBeginInput {}, &storage).await.unwrap();
        let result = handler.complete(
            GenerationPlanCompleteInput {},
            &storage,
        ).await.unwrap();
        match result {
            GenerationPlanCompleteOutput::Ok { run } => {
                assert!(run.starts_with("gen-run-"));
            },
        }
    }

    #[tokio::test]
    async fn test_summary() {
        let storage = InMemoryStorage::new();
        let handler = GenerationPlanHandlerImpl;
        let begin_result = handler.begin(GenerationPlanBeginInput {}, &storage).await.unwrap();
        if let GenerationPlanBeginOutput::Ok { run } = begin_result {
            handler.record_step(
                GenerationPlanRecordStepInput {
                    step_key: "step-1".to_string(),
                    status: "ok".to_string(),
                    files_produced: Some(3),
                    duration: Some(50),
                    cached: false,
                },
                &storage,
            ).await.unwrap();
            let result = handler.summary(
                GenerationPlanSummaryInput { run },
                &storage,
            ).await.unwrap();
            match result {
                GenerationPlanSummaryOutput::Ok { total, executed, .. } => {
                    assert_eq!(total, 1);
                    assert_eq!(executed, 1);
                },
            }
        }
    }

    #[tokio::test]
    async fn test_history_empty() {
        let storage = InMemoryStorage::new();
        let handler = GenerationPlanHandlerImpl;
        let result = handler.history(
            GenerationPlanHistoryInput { limit: Some(10) },
            &storage,
        ).await.unwrap();
        match result {
            GenerationPlanHistoryOutput::Ok { runs } => {
                assert!(runs.is_empty());
            },
        }
    }
}
