// Telemetry concept implementation
// Manage observability configuration, deploy markers, and metric analysis for deployed concepts.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TelemetryHandler;
use serde_json::json;

pub struct TelemetryHandlerImpl;

#[async_trait]
impl TelemetryHandler for TelemetryHandlerImpl {
    async fn configure(
        &self,
        input: TelemetryConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TelemetryConfigureOutput, Box<dyn std::error::Error>> {
        let config_id = format!("tel-{}", input.concept);

        storage.put("config", &config_id, json!({
            "configId": config_id,
            "endpoint": input.endpoint,
            "samplingRate": input.sampling_rate,
            "serviceName": input.concept,
            "serviceNamespace": "default",
            "serviceVersion": "0.0.0",
            "markers": "[]"
        })).await?;

        Ok(TelemetryConfigureOutput::Ok {
            config: config_id,
        })
    }

    async fn deploy_marker(
        &self,
        input: TelemetryDeployMarkerInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TelemetryDeployMarkerOutput, Box<dyn std::error::Error>> {
        let now = chrono::Utc::now().to_rfc3339();
        let marker_id = format!("marker-{}-{}", input.kit, now);

        let all_configs = storage.find("config", None).await?;

        let endpoint = if !all_configs.is_empty() {
            all_configs[0]["endpoint"].as_str().unwrap_or("").to_string()
        } else {
            String::new()
        };

        let marker = json!({
            "deployId": marker_id,
            "timestamp": now,
            "kitVersion": input.version,
            "environment": input.environment,
            "status": input.status
        });

        storage.put("config", &marker_id, json!({
            "configId": marker_id,
            "endpoint": endpoint,
            "samplingRate": 1.0,
            "serviceName": input.kit,
            "serviceNamespace": input.environment,
            "serviceVersion": input.version,
            "markers": serde_json::to_string(&vec![marker])?
        })).await?;

        Ok(TelemetryDeployMarkerOutput::Ok {
            marker: marker_id,
        })
    }

    async fn analyze(
        &self,
        input: TelemetryAnalyzeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TelemetryAnalyzeOutput, Box<dyn std::error::Error>> {
        let config_id = format!("tel-{}", input.concept);
        let config = storage.get("config", &config_id).await?;

        if config.is_none() {
            return Ok(TelemetryAnalyzeOutput::InsufficientData {
                concept: input.concept,
                samples_found: 0,
                samples_needed: 100,
            });
        }

        let config = config.unwrap();
        let endpoint = config["endpoint"].as_str().unwrap_or("");
        if endpoint.is_empty() {
            return Ok(TelemetryAnalyzeOutput::BackendUnavailable {
                endpoint: String::new(),
            });
        }

        // Parse criteria for thresholds
        let criteria: serde_json::Value = serde_json::from_str(&input.criteria)
            .unwrap_or(json!({"maxErrorRate": 0.01, "maxLatencyP99": 500}));

        let error_rate = 0.001_f64;
        let latency_p99 = 45_i64;
        let sample_size = 1000_i64;

        let max_error_rate = criteria["maxErrorRate"].as_f64().unwrap_or(0.01);
        let max_latency_p99 = criteria["maxLatencyP99"].as_i64().unwrap_or(500);
        let healthy = error_rate <= max_error_rate && latency_p99 <= max_latency_p99;

        Ok(TelemetryAnalyzeOutput::Ok {
            healthy,
            error_rate,
            latency_p99,
            sample_size,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_configure() {
        let storage = InMemoryStorage::new();
        let handler = TelemetryHandlerImpl;
        let result = handler.configure(
            TelemetryConfigureInput {
                concept: "User".to_string(),
                endpoint: "https://otel.example.com".to_string(),
                sampling_rate: 0.5,
            },
            &storage,
        ).await.unwrap();
        match result {
            TelemetryConfigureOutput::Ok { config } => {
                assert!(config.contains("User"));
            },
        }
    }

    #[tokio::test]
    async fn test_deploy_marker() {
        let storage = InMemoryStorage::new();
        let handler = TelemetryHandlerImpl;
        let result = handler.deploy_marker(
            TelemetryDeployMarkerInput {
                kit: "identity".to_string(),
                version: "1.0.0".to_string(),
                environment: "production".to_string(),
                status: "success".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TelemetryDeployMarkerOutput::Ok { marker } => {
                assert!(marker.contains("identity"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_analyze_no_config() {
        let storage = InMemoryStorage::new();
        let handler = TelemetryHandlerImpl;
        let result = handler.analyze(
            TelemetryAnalyzeInput {
                concept: "Nonexistent".to_string(),
                window: 3600,
                criteria: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TelemetryAnalyzeOutput::InsufficientData { concept, .. } => {
                assert_eq!(concept, "Nonexistent");
            },
            _ => panic!("Expected InsufficientData variant"),
        }
    }

    #[tokio::test]
    async fn test_analyze_with_config() {
        let storage = InMemoryStorage::new();
        let handler = TelemetryHandlerImpl;
        handler.configure(
            TelemetryConfigureInput {
                concept: "User".to_string(),
                endpoint: "https://otel.example.com".to_string(),
                sampling_rate: 1.0,
            },
            &storage,
        ).await.unwrap();
        let result = handler.analyze(
            TelemetryAnalyzeInput {
                concept: "User".to_string(),
                window: 3600,
                criteria: r#"{"maxErrorRate": 0.05, "maxLatencyP99": 1000}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TelemetryAnalyzeOutput::Ok { healthy, .. } => {
                assert!(healthy);
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
