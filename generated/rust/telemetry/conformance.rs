// generated: telemetry/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::TelemetryHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn telemetry_invariant_1() {
        // invariant 1: after configure, deployMarker behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();
        let m = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // configure(concept: "User", endpoint: "http://otel:4317", samplingRate: 0.5) -> ok(config: t)
        let step1 = handler.configure(
            ConfigureInput { concept: "User".to_string(), endpoint: "http://otel:4317".to_string(), sampling_rate: 0.5 },
            &storage,
        ).await.unwrap();
        match step1 {
            ConfigureOutput::Ok { config, .. } => {
                assert_eq!(config, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // deployMarker(kit: "auth", version: "1.0.0", environment: "staging", status: "started") -> ok(marker: m)
        let step2 = handler.deploy_marker(
            DeployMarkerInput { kit: "auth".to_string(), version: "1.0.0".to_string(), environment: "staging".to_string(), status: "started".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DeployMarkerOutput::Ok { marker, .. } => {
                assert_eq!(marker, m.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
