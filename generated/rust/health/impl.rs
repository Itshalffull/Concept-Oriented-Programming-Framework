// Health concept implementation
// Deployment health checks at concept, sync, suite, and invariant levels with latency monitoring.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::HealthHandler;
use serde_json::json;
use chrono::Utc;

pub struct HealthHandlerImpl;

#[async_trait]
impl HealthHandler for HealthHandlerImpl {
    async fn check_concept(
        &self,
        input: HealthCheckConceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HealthCheckConceptOutput, Box<dyn std::error::Error>> {
        let start = Utc::now();

        // Attempt a round-trip storage operation as health probe
        let probe_key = format!("health-probe-{}", input.concept);
        let probe_result = storage.put("health", &probe_key, json!({
            "concept": input.concept,
            "runtime": input.runtime,
            "probeAt": start.to_rfc3339(),
        })).await;

        if let Err(e) = probe_result {
            return Ok(HealthCheckConceptOutput::StorageFailed {
                concept: input.concept,
                storage: input.runtime.clone(),
                reason: e.to_string(),
            });
        }

        // Verify we can read back
        let read_result = storage.get("health", &probe_key).await;
        let latency_ms = (Utc::now() - start).num_milliseconds();

        if let Err(e) = read_result {
            return Ok(HealthCheckConceptOutput::StorageFailed {
                concept: input.concept,
                storage: input.runtime,
                reason: e.to_string(),
            });
        }

        // Clean up probe
        let _ = storage.del("health", &probe_key).await;

        // Degradation threshold: 500ms
        let threshold: i64 = 500;
        if latency_ms > threshold {
            return Ok(HealthCheckConceptOutput::Degraded {
                concept: input.concept,
                latency_ms,
                threshold,
            });
        }

        let check_id = format!("check-{}-{}", input.concept, Utc::now().timestamp_millis());

        Ok(HealthCheckConceptOutput::Ok {
            check: check_id,
            latency_ms,
        })
    }

    async fn check_sync(
        &self,
        input: HealthCheckSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HealthCheckSyncOutput, Box<dyn std::error::Error>> {
        let start = Utc::now();
        let mut failed_concepts: Vec<String> = Vec::new();

        for concept in &input.concepts {
            let probe_key = format!("sync-probe-{}-{}", input.sync, concept);
            let result = storage.put("health", &probe_key, json!({
                "sync": input.sync,
                "concept": concept,
                "probeAt": start.to_rfc3339(),
            })).await;

            match result {
                Ok(_) => {
                    // Verify read-back
                    if storage.get("health", &probe_key).await.is_err() {
                        failed_concepts.push(concept.clone());
                    }
                    let _ = storage.del("health", &probe_key).await;
                }
                Err(_) => {
                    failed_concepts.push(concept.clone());
                }
            }
        }

        let round_trip_ms = (Utc::now() - start).num_milliseconds();

        // Timeout threshold: 5 seconds
        let timeout_ms: i64 = 5000;
        if round_trip_ms > timeout_ms {
            return Ok(HealthCheckSyncOutput::Timeout {
                sync: input.sync,
                timeout_ms,
            });
        }

        if !failed_concepts.is_empty() {
            return Ok(HealthCheckSyncOutput::PartialFailure {
                sync: input.sync,
                failed: failed_concepts,
            });
        }

        let check_id = format!("sync-check-{}-{}", input.sync, Utc::now().timestamp_millis());

        Ok(HealthCheckSyncOutput::Ok {
            check: check_id,
            round_trip_ms,
        })
    }

    async fn check_kit(
        &self,
        input: HealthCheckKitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HealthCheckKitOutput, Box<dyn std::error::Error>> {
        // Load kit configuration to discover its concepts and syncs
        let kit_record = storage.get("kit", &input.kit).await?;

        let concepts: Vec<String> = kit_record.as_ref()
            .and_then(|r| r.get("concepts").and_then(|v| v.as_str()))
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        let syncs: Vec<String> = kit_record.as_ref()
            .and_then(|r| r.get("syncs").and_then(|v| v.as_str()))
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        let mut healthy: Vec<String> = Vec::new();
        let mut degraded: Vec<String> = Vec::new();
        let mut failed: Vec<String> = Vec::new();
        let mut concept_results: Vec<String> = Vec::new();
        let mut sync_results: Vec<String> = Vec::new();

        // Check each concept
        for concept in &concepts {
            let result = self.check_concept(
                HealthCheckConceptInput {
                    concept: concept.clone(),
                    runtime: input.environment.clone(),
                },
                storage,
            ).await?;

            match &result {
                HealthCheckConceptOutput::Ok { check, latency_ms } => {
                    healthy.push(concept.clone());
                    concept_results.push(format!("{}:ok:{}ms", concept, latency_ms));
                }
                HealthCheckConceptOutput::Degraded { concept: c, latency_ms, .. } => {
                    degraded.push(c.clone());
                    concept_results.push(format!("{}:degraded:{}ms", c, latency_ms));
                }
                _ => {
                    failed.push(concept.clone());
                    concept_results.push(format!("{}:failed", concept));
                }
            }
        }

        // Check each sync
        for sync_name in &syncs {
            let result = self.check_sync(
                HealthCheckSyncInput {
                    sync: sync_name.clone(),
                    concepts: concepts.clone(),
                },
                storage,
            ).await?;

            match &result {
                HealthCheckSyncOutput::Ok { check, round_trip_ms } => {
                    sync_results.push(format!("{}:ok:{}ms", sync_name, round_trip_ms));
                }
                HealthCheckSyncOutput::PartialFailure { sync, failed: f } => {
                    sync_results.push(format!("{}:partial:{}", sync, f.join(",")));
                }
                HealthCheckSyncOutput::Timeout { sync, timeout_ms } => {
                    sync_results.push(format!("{}:timeout:{}ms", sync, timeout_ms));
                }
            }
        }

        let check_id = format!("kit-check-{}-{}", input.kit, Utc::now().timestamp_millis());

        if !failed.is_empty() {
            return Ok(HealthCheckKitOutput::Failed {
                check: check_id,
                healthy,
                failed,
            });
        }

        if !degraded.is_empty() {
            return Ok(HealthCheckKitOutput::Degraded {
                check: check_id,
                healthy,
                degraded,
            });
        }

        Ok(HealthCheckKitOutput::Ok {
            check: check_id,
            concept_results,
            sync_results,
        })
    }

    async fn check_invariant(
        &self,
        input: HealthCheckInvariantInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HealthCheckInvariantOutput, Box<dyn std::error::Error>> {
        // Load the invariant definition
        let invariant_record = storage.get("invariant", &format!("{}:{}", input.concept, input.invariant)).await?;

        let Some(inv) = invariant_record else {
            let check_id = format!("inv-check-{}-{}", input.concept, Utc::now().timestamp_millis());
            return Ok(HealthCheckInvariantOutput::Ok { check: check_id });
        };

        let expected = inv.get("expected")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let check_field = inv.get("checkField")
            .and_then(|v| v.as_str())
            .unwrap_or("status");

        // Load the concept record to verify the invariant
        let concept_record = storage.get("concept", &input.concept).await?;
        let actual = concept_record.as_ref()
            .and_then(|r| r.get(check_field).and_then(|v| v.as_str()))
            .unwrap_or("")
            .to_string();

        if actual != expected && !expected.is_empty() {
            return Ok(HealthCheckInvariantOutput::Violated {
                concept: input.concept,
                invariant: input.invariant,
                expected,
                actual,
            });
        }

        let check_id = format!("inv-check-{}-{}-{}", input.concept, input.invariant, Utc::now().timestamp_millis());
        Ok(HealthCheckInvariantOutput::Ok { check: check_id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_check_concept_success() {
        let storage = InMemoryStorage::new();
        let handler = HealthHandlerImpl;
        let result = handler.check_concept(
            HealthCheckConceptInput {
                concept: "user".to_string(),
                runtime: "local".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            HealthCheckConceptOutput::Ok { check, latency_ms } => {
                assert!(!check.is_empty());
                assert!(latency_ms >= 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_check_sync_success() {
        let storage = InMemoryStorage::new();
        let handler = HealthHandlerImpl;
        let result = handler.check_sync(
            HealthCheckSyncInput {
                sync: "user-profile".to_string(),
                concepts: vec!["user".to_string(), "profile".to_string()],
            },
            &storage,
        ).await.unwrap();
        match result {
            HealthCheckSyncOutput::Ok { check, round_trip_ms } => {
                assert!(!check.is_empty());
                assert!(round_trip_ms >= 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_check_kit_success() {
        let storage = InMemoryStorage::new();
        let handler = HealthHandlerImpl;
        let result = handler.check_kit(
            HealthCheckKitInput {
                kit: "identity".to_string(),
                environment: "local".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            HealthCheckKitOutput::Ok { check, concept_results, sync_results } => {
                assert!(!check.is_empty());
                // No kit registered so concept_results and sync_results are empty
                assert!(concept_results.is_empty());
                assert!(sync_results.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_check_invariant_ok_no_invariant() {
        let storage = InMemoryStorage::new();
        let handler = HealthHandlerImpl;
        let result = handler.check_invariant(
            HealthCheckInvariantInput {
                concept: "user".to_string(),
                invariant: "status-active".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            HealthCheckInvariantOutput::Ok { check } => {
                assert!(!check.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_check_invariant_violated() {
        let storage = InMemoryStorage::new();
        let handler = HealthHandlerImpl;
        // Set up an invariant expectation
        storage.put("invariant", "user:status-active", json!({
            "expected": "active",
            "checkField": "status",
        })).await.unwrap();
        // Set up the concept record with a mismatched status
        storage.put("concept", "user", json!({
            "status": "suspended",
        })).await.unwrap();
        let result = handler.check_invariant(
            HealthCheckInvariantInput {
                concept: "user".to_string(),
                invariant: "status-active".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            HealthCheckInvariantOutput::Violated { concept, invariant, expected, actual } => {
                assert_eq!(concept, "user");
                assert_eq!(invariant, "status-active");
                assert_eq!(expected, "active");
                assert_eq!(actual, "suspended");
            },
            _ => panic!("Expected Violated variant"),
        }
    }
}
