// ProcessMetric concept implementation
// Aggregates and exposes process-level performance metrics
// for dashboards, SLA monitoring, and process mining.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ProcessMetricHandler;
use serde_json::json;

pub struct ProcessMetricHandlerImpl;

fn generate_metric_id() -> String {
    format!("pm-{}", uuid::Uuid::new_v4())
}

#[async_trait]
impl ProcessMetricHandler for ProcessMetricHandlerImpl {
    async fn record(
        &self,
        input: ProcessMetricRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessMetricRecordOutput, Box<dyn std::error::Error>> {
        let metric_id = generate_metric_id();
        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("process_metrics", &metric_id, json!({
            "metric_id": metric_id,
            "metric_name": input.metric_name,
            "metric_value": input.metric_value,
            "dimensions": input.dimensions,
            "run_ref": input.run_ref,
            "spec_ref": input.spec_ref,
            "recorded_at": timestamp,
        })).await?;

        Ok(ProcessMetricRecordOutput::Ok {
            metric_id,
            metric_name: input.metric_name,
        })
    }

    async fn query(
        &self,
        input: ProcessMetricQueryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessMetricQueryOutput, Box<dyn std::error::Error>> {
        let all = storage.find("process_metrics", Some(&json!({
            "metric_name": input.metric_name,
        }))).await?;

        // Filter by time range
        let filtered: Vec<serde_json::Value> = all.into_iter()
            .filter(|m| {
                let ts = m["recorded_at"].as_str().unwrap_or("");
                ts >= input.from.as_str() && ts <= input.to.as_str()
            })
            .collect();

        let count = filtered.len() as i64;

        Ok(ProcessMetricQueryOutput::Ok {
            metrics: filtered,
            count,
        })
    }

    async fn aggregate(
        &self,
        input: ProcessMetricAggregateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessMetricAggregateOutput, Box<dyn std::error::Error>> {
        let all = storage.find("process_metrics", Some(&json!({
            "metric_name": input.metric_name,
        }))).await?;

        // Filter by time range
        let values: Vec<f64> = all.into_iter()
            .filter(|m| {
                let ts = m["recorded_at"].as_str().unwrap_or("");
                ts >= input.from.as_str() && ts <= input.to.as_str()
            })
            .filter_map(|m| m["metric_value"].as_f64())
            .collect();

        let sample_count = values.len() as i64;

        if values.is_empty() {
            return Ok(ProcessMetricAggregateOutput::Ok {
                value: 0.0,
                sample_count: 0,
            });
        }

        let result = match input.aggregation.as_str() {
            "avg" => values.iter().sum::<f64>() / values.len() as f64,
            "sum" => values.iter().sum::<f64>(),
            "min" => values.iter().cloned().fold(f64::INFINITY, f64::min),
            "max" => values.iter().cloned().fold(f64::NEG_INFINITY, f64::max),
            "p50" | "p95" | "p99" => {
                let mut sorted = values.clone();
                sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                let percentile = match input.aggregation.as_str() {
                    "p50" => 0.50,
                    "p95" => 0.95,
                    "p99" => 0.99,
                    _ => 0.50,
                };
                let idx = ((sorted.len() as f64 * percentile).ceil() as usize).min(sorted.len()) - 1;
                sorted[idx]
            }
            _ => values.iter().sum::<f64>() / values.len() as f64, // default to avg
        };

        Ok(ProcessMetricAggregateOutput::Ok {
            value: result,
            sample_count,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_record_metric() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;
        let result = handler.record(
            ProcessMetricRecordInput {
                metric_name: "step.duration_ms".to_string(),
                metric_value: 1500.0,
                dimensions: json!({ "step": "validate", "run": "run-001" }),
                run_ref: Some("run-001".to_string()),
                spec_ref: Some("onboard".to_string()),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessMetricRecordOutput::Ok { metric_id, metric_name } => {
                assert!(metric_id.starts_with("pm-"));
                assert_eq!(metric_name, "step.duration_ms");
            }
        }
    }

    #[tokio::test]
    async fn test_query_metrics() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        handler.record(
            ProcessMetricRecordInput {
                metric_name: "step.duration_ms".to_string(),
                metric_value: 100.0,
                dimensions: json!({}),
                run_ref: None,
                spec_ref: None,
            },
            &storage,
        ).await.unwrap();

        handler.record(
            ProcessMetricRecordInput {
                metric_name: "step.duration_ms".to_string(),
                metric_value: 200.0,
                dimensions: json!({}),
                run_ref: None,
                spec_ref: None,
            },
            &storage,
        ).await.unwrap();

        let result = handler.query(
            ProcessMetricQueryInput {
                metric_name: "step.duration_ms".to_string(),
                from: "2000-01-01T00:00:00Z".to_string(),
                to: "2100-01-01T00:00:00Z".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessMetricQueryOutput::Ok { count, .. } => {
                assert_eq!(count, 2);
            }
        }
    }

    #[tokio::test]
    async fn test_aggregate_avg() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        for val in &[100.0, 200.0, 300.0] {
            handler.record(
                ProcessMetricRecordInput {
                    metric_name: "latency".to_string(),
                    metric_value: *val,
                    dimensions: json!({}),
                    run_ref: None,
                    spec_ref: None,
                },
                &storage,
            ).await.unwrap();
        }

        let result = handler.aggregate(
            ProcessMetricAggregateInput {
                metric_name: "latency".to_string(),
                aggregation: "avg".to_string(),
                from: "2000-01-01T00:00:00Z".to_string(),
                to: "2100-01-01T00:00:00Z".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessMetricAggregateOutput::Ok { value, sample_count } => {
                assert_eq!(sample_count, 3);
                assert!((value - 200.0).abs() < 0.001);
            }
        }
    }

    #[tokio::test]
    async fn test_aggregate_sum() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        for val in &[10.0, 20.0, 30.0] {
            handler.record(
                ProcessMetricRecordInput {
                    metric_name: "count".to_string(),
                    metric_value: *val,
                    dimensions: json!({}),
                    run_ref: None,
                    spec_ref: None,
                },
                &storage,
            ).await.unwrap();
        }

        let result = handler.aggregate(
            ProcessMetricAggregateInput {
                metric_name: "count".to_string(),
                aggregation: "sum".to_string(),
                from: "2000-01-01T00:00:00Z".to_string(),
                to: "2100-01-01T00:00:00Z".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessMetricAggregateOutput::Ok { value, .. } => {
                assert!((value - 60.0).abs() < 0.001);
            }
        }
    }

    #[tokio::test]
    async fn test_aggregate_min_max() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        for val in &[5.0, 15.0, 25.0] {
            handler.record(
                ProcessMetricRecordInput {
                    metric_name: "range_test".to_string(),
                    metric_value: *val,
                    dimensions: json!({}),
                    run_ref: None,
                    spec_ref: None,
                },
                &storage,
            ).await.unwrap();
        }

        let min_result = handler.aggregate(
            ProcessMetricAggregateInput {
                metric_name: "range_test".to_string(),
                aggregation: "min".to_string(),
                from: "2000-01-01T00:00:00Z".to_string(),
                to: "2100-01-01T00:00:00Z".to_string(),
            },
            &storage,
        ).await.unwrap();
        match min_result {
            ProcessMetricAggregateOutput::Ok { value, .. } => {
                assert!((value - 5.0).abs() < 0.001);
            }
        }

        let max_result = handler.aggregate(
            ProcessMetricAggregateInput {
                metric_name: "range_test".to_string(),
                aggregation: "max".to_string(),
                from: "2000-01-01T00:00:00Z".to_string(),
                to: "2100-01-01T00:00:00Z".to_string(),
            },
            &storage,
        ).await.unwrap();
        match max_result {
            ProcessMetricAggregateOutput::Ok { value, .. } => {
                assert!((value - 25.0).abs() < 0.001);
            }
        }
    }
}
