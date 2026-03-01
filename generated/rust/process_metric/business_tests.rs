// Business logic tests for ProcessMetric concept.
// Validates aggregation functions, time-range filtering,
// edge cases in statistics, and metric isolation.

#[cfg(test)]
mod tests {
    use super::super::handler::ProcessMetricHandler;
    use super::super::r#impl::ProcessMetricHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_aggregate_avg_with_identical_values() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        for _ in 0..5 {
            handler.record(ProcessMetricRecordInput {
                metric_name: "constant".to_string(),
                metric_value: 42.0,
                dimensions: json!({}),
                run_ref: None,
                spec_ref: None,
            }, &storage).await.unwrap();
        }

        let result = handler.aggregate(ProcessMetricAggregateInput {
            metric_name: "constant".to_string(),
            aggregation: "avg".to_string(),
            from: "2000-01-01T00:00:00Z".to_string(),
            to: "2100-01-01T00:00:00Z".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessMetricAggregateOutput::Ok { value, sample_count } => {
                assert_eq!(sample_count, 5);
                assert!((value - 42.0).abs() < 0.001);
            }
        }
    }

    #[tokio::test]
    async fn test_aggregate_p50_median() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        for val in &[10.0, 20.0, 30.0, 40.0, 50.0] {
            handler.record(ProcessMetricRecordInput {
                metric_name: "p50_test".to_string(),
                metric_value: *val,
                dimensions: json!({}),
                run_ref: None,
                spec_ref: None,
            }, &storage).await.unwrap();
        }

        let result = handler.aggregate(ProcessMetricAggregateInput {
            metric_name: "p50_test".to_string(),
            aggregation: "p50".to_string(),
            from: "2000-01-01T00:00:00Z".to_string(),
            to: "2100-01-01T00:00:00Z".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessMetricAggregateOutput::Ok { value, sample_count } => {
                assert_eq!(sample_count, 5);
                assert_eq!(value, 30.0);
            }
        }
    }

    #[tokio::test]
    async fn test_aggregate_p95() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        // 20 values from 1.0 to 20.0
        for i in 1..=20 {
            handler.record(ProcessMetricRecordInput {
                metric_name: "p95_test".to_string(),
                metric_value: i as f64,
                dimensions: json!({}),
                run_ref: None,
                spec_ref: None,
            }, &storage).await.unwrap();
        }

        let result = handler.aggregate(ProcessMetricAggregateInput {
            metric_name: "p95_test".to_string(),
            aggregation: "p95".to_string(),
            from: "2000-01-01T00:00:00Z".to_string(),
            to: "2100-01-01T00:00:00Z".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessMetricAggregateOutput::Ok { value, sample_count } => {
                assert_eq!(sample_count, 20);
                assert!(value >= 19.0, "p95 should be >= 19.0, got {}", value);
            }
        }
    }

    #[tokio::test]
    async fn test_aggregate_empty_returns_zero() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        let result = handler.aggregate(ProcessMetricAggregateInput {
            metric_name: "nonexistent".to_string(),
            aggregation: "avg".to_string(),
            from: "2000-01-01T00:00:00Z".to_string(),
            to: "2100-01-01T00:00:00Z".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessMetricAggregateOutput::Ok { value, sample_count } => {
                assert_eq!(sample_count, 0);
                assert_eq!(value, 0.0);
            }
        }
    }

    #[tokio::test]
    async fn test_query_empty_returns_zero_count() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        let result = handler.query(ProcessMetricQueryInput {
            metric_name: "missing".to_string(),
            from: "2000-01-01T00:00:00Z".to_string(),
            to: "2100-01-01T00:00:00Z".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessMetricQueryOutput::Ok { count, metrics } => {
                assert_eq!(count, 0);
                assert!(metrics.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_metrics_isolated_by_name() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        handler.record(ProcessMetricRecordInput {
            metric_name: "latency_ms".to_string(),
            metric_value: 100.0,
            dimensions: json!({}),
            run_ref: None,
            spec_ref: None,
        }, &storage).await.unwrap();

        handler.record(ProcessMetricRecordInput {
            metric_name: "error_rate".to_string(),
            metric_value: 0.05,
            dimensions: json!({}),
            run_ref: None,
            spec_ref: None,
        }, &storage).await.unwrap();

        let latency = handler.query(ProcessMetricQueryInput {
            metric_name: "latency_ms".to_string(),
            from: "2000-01-01T00:00:00Z".to_string(),
            to: "2100-01-01T00:00:00Z".to_string(),
        }, &storage).await.unwrap();
        match latency {
            ProcessMetricQueryOutput::Ok { count, .. } => assert_eq!(count, 1),
        }

        let errors = handler.query(ProcessMetricQueryInput {
            metric_name: "error_rate".to_string(),
            from: "2000-01-01T00:00:00Z".to_string(),
            to: "2100-01-01T00:00:00Z".to_string(),
        }, &storage).await.unwrap();
        match errors {
            ProcessMetricQueryOutput::Ok { count, .. } => assert_eq!(count, 1),
        }
    }

    #[tokio::test]
    async fn test_record_with_all_optional_fields() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        let result = handler.record(ProcessMetricRecordInput {
            metric_name: "step.duration".to_string(),
            metric_value: 3500.0,
            dimensions: json!({"step": "validate", "env": "production"}),
            run_ref: Some("run-abc".to_string()),
            spec_ref: Some("onboarding:v2".to_string()),
        }, &storage).await.unwrap();
        match result {
            ProcessMetricRecordOutput::Ok { metric_id, metric_name } => {
                assert!(metric_id.starts_with("pm-"));
                assert_eq!(metric_name, "step.duration");
            }
        }
    }

    #[tokio::test]
    async fn test_record_without_optional_fields() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        let result = handler.record(ProcessMetricRecordInput {
            metric_name: "simple.counter".to_string(),
            metric_value: 1.0,
            dimensions: json!({}),
            run_ref: None,
            spec_ref: None,
        }, &storage).await.unwrap();
        match result {
            ProcessMetricRecordOutput::Ok { metric_id, .. } => {
                assert!(metric_id.starts_with("pm-"));
            }
        }
    }

    #[tokio::test]
    async fn test_aggregate_single_value() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        handler.record(ProcessMetricRecordInput {
            metric_name: "single".to_string(),
            metric_value: 77.0,
            dimensions: json!({}),
            run_ref: None,
            spec_ref: None,
        }, &storage).await.unwrap();

        // avg of single value = the value itself
        let avg = handler.aggregate(ProcessMetricAggregateInput {
            metric_name: "single".to_string(),
            aggregation: "avg".to_string(),
            from: "2000-01-01T00:00:00Z".to_string(),
            to: "2100-01-01T00:00:00Z".to_string(),
        }, &storage).await.unwrap();
        match avg {
            ProcessMetricAggregateOutput::Ok { value, sample_count } => {
                assert_eq!(sample_count, 1);
                assert!((value - 77.0).abs() < 0.001);
            }
        }

        // min of single value
        let min = handler.aggregate(ProcessMetricAggregateInput {
            metric_name: "single".to_string(),
            aggregation: "min".to_string(),
            from: "2000-01-01T00:00:00Z".to_string(),
            to: "2100-01-01T00:00:00Z".to_string(),
        }, &storage).await.unwrap();
        match min {
            ProcessMetricAggregateOutput::Ok { value, .. } => {
                assert!((value - 77.0).abs() < 0.001);
            }
        }

        // max of single value
        let max = handler.aggregate(ProcessMetricAggregateInput {
            metric_name: "single".to_string(),
            aggregation: "max".to_string(),
            from: "2000-01-01T00:00:00Z".to_string(),
            to: "2100-01-01T00:00:00Z".to_string(),
        }, &storage).await.unwrap();
        match max {
            ProcessMetricAggregateOutput::Ok { value, .. } => {
                assert!((value - 77.0).abs() < 0.001);
            }
        }
    }

    #[tokio::test]
    async fn test_aggregate_p99() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        for i in 1..=100 {
            handler.record(ProcessMetricRecordInput {
                metric_name: "p99_test".to_string(),
                metric_value: i as f64,
                dimensions: json!({}),
                run_ref: None,
                spec_ref: None,
            }, &storage).await.unwrap();
        }

        let result = handler.aggregate(ProcessMetricAggregateInput {
            metric_name: "p99_test".to_string(),
            aggregation: "p99".to_string(),
            from: "2000-01-01T00:00:00Z".to_string(),
            to: "2100-01-01T00:00:00Z".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessMetricAggregateOutput::Ok { value, sample_count } => {
                assert_eq!(sample_count, 100);
                assert!(value >= 99.0, "p99 of 1..100 should be >= 99, got {}", value);
            }
        }
    }

    #[tokio::test]
    async fn test_query_returns_matching_metrics_only() {
        let storage = InMemoryStorage::new();
        let handler = ProcessMetricHandlerImpl;

        for i in 0..3 {
            handler.record(ProcessMetricRecordInput {
                metric_name: "target_metric".to_string(),
                metric_value: (i as f64) * 10.0,
                dimensions: json!({}),
                run_ref: None,
                spec_ref: None,
            }, &storage).await.unwrap();
        }

        handler.record(ProcessMetricRecordInput {
            metric_name: "other_metric".to_string(),
            metric_value: 999.0,
            dimensions: json!({}),
            run_ref: None,
            spec_ref: None,
        }, &storage).await.unwrap();

        let result = handler.query(ProcessMetricQueryInput {
            metric_name: "target_metric".to_string(),
            from: "2000-01-01T00:00:00Z".to_string(),
            to: "2100-01-01T00:00:00Z".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessMetricQueryOutput::Ok { count, .. } => {
                assert_eq!(count, 3);
            }
        }
    }
}
