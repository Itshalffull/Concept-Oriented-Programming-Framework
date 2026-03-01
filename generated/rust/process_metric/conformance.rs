// generated: process_metric/conformance.rs
// Conformance tests for ProcessMetric concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::ProcessMetricHandler;
    use super::super::r#impl::ProcessMetricHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    fn create_test_handler() -> ProcessMetricHandlerImpl {
        ProcessMetricHandlerImpl
    }

    #[tokio::test]
    async fn process_metric_invariant_record_query_roundtrip() {
        // Invariant: recorded metrics are retrievable via query
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        handler.record(
            ProcessMetricRecordInput {
                metric_name: "step.duration_ms".to_string(),
                metric_value: 500.0,
                dimensions: json!({ "step": "validate" }),
                run_ref: Some("run-inv-001".to_string()),
                spec_ref: Some("onboard".to_string()),
            },
            &storage,
        ).await.unwrap();

        handler.record(
            ProcessMetricRecordInput {
                metric_name: "step.duration_ms".to_string(),
                metric_value: 750.0,
                dimensions: json!({ "step": "process" }),
                run_ref: Some("run-inv-001".to_string()),
                spec_ref: Some("onboard".to_string()),
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
    async fn process_metric_invariant_aggregate_correctness() {
        // Invariant: aggregate produces mathematically correct results
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let values = vec![100.0, 200.0, 300.0, 400.0, 500.0];
        for v in &values {
            handler.record(
                ProcessMetricRecordInput {
                    metric_name: "latency_ms".to_string(),
                    metric_value: *v,
                    dimensions: json!({}),
                    run_ref: None,
                    spec_ref: None,
                },
                &storage,
            ).await.unwrap();
        }

        let avg = handler.aggregate(
            ProcessMetricAggregateInput {
                metric_name: "latency_ms".to_string(),
                aggregation: "avg".to_string(),
                from: "2000-01-01T00:00:00Z".to_string(),
                to: "2100-01-01T00:00:00Z".to_string(),
            },
            &storage,
        ).await.unwrap();
        match avg {
            ProcessMetricAggregateOutput::Ok { value, sample_count } => {
                assert_eq!(sample_count, 5);
                assert!((value - 300.0).abs() < 0.001);
            }
        }

        let sum = handler.aggregate(
            ProcessMetricAggregateInput {
                metric_name: "latency_ms".to_string(),
                aggregation: "sum".to_string(),
                from: "2000-01-01T00:00:00Z".to_string(),
                to: "2100-01-01T00:00:00Z".to_string(),
            },
            &storage,
        ).await.unwrap();
        match sum {
            ProcessMetricAggregateOutput::Ok { value, .. } => {
                assert!((value - 1500.0).abs() < 0.001);
            }
        }
    }
}
