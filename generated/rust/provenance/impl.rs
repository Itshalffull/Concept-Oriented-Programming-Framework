// Provenance concept implementation
// Tracks lineage and audit trail for entities through recording, tracing, auditing,
// rollback, diffing, and reproduction of provenance chains.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ProvenanceHandler;
use serde_json::json;

pub struct ProvenanceHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("prov-{}-{}", t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl ProvenanceHandler for ProvenanceHandlerImpl {
    async fn record(
        &self,
        input: ProvenanceRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProvenanceRecordOutput, Box<dyn std::error::Error>> {
        let record_id = next_id();
        let now = chrono::Utc::now().to_rfc3339();
        let batch_id = format!("batch-{}", &now[..10]);

        storage.put("provenanceRecord", &record_id, json!({
            "recordId": record_id,
            "entity": input.entity,
            "activity": input.activity,
            "agent": input.agent,
            "inputs": input.inputs,
            "timestamp": now,
            "batchId": batch_id,
        })).await?;

        // Update batch map table for tracking
        let map_table = storage.get("provenanceMapTable", &batch_id).await?;
        let mut entries: Vec<serde_json::Value> = if let Some(ref m) = map_table {
            let entries_str = m.get("entries").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            entries_str
        } else {
            Vec::new()
        };
        entries.push(json!({
            "recordId": record_id,
            "entity": input.entity,
            "activity": input.activity,
        }));
        storage.put("provenanceMapTable", &batch_id, json!({
            "batchId": batch_id,
            "entries": entries,
        })).await?;

        Ok(ProvenanceRecordOutput::Ok { record_id })
    }

    async fn trace(
        &self,
        input: ProvenanceTraceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProvenanceTraceOutput, Box<dyn std::error::Error>> {
        let all_records = storage.find("provenanceRecord", None).await?;
        let mut chain: Vec<serde_json::Value> = all_records
            .iter()
            .filter(|r| r.get("entity").and_then(|v| v.as_str()) == Some(&input.entity_id))
            .cloned()
            .collect();

        if chain.is_empty() {
            return Ok(ProvenanceTraceOutput::Notfound {
                message: format!("No provenance records for \"{}\"", input.entity_id),
            });
        }

        // Sort by timestamp ascending
        chain.sort_by(|a, b| {
            let ta = a.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
            let tb = b.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
            ta.cmp(tb)
        });

        let result: Vec<serde_json::Value> = chain.iter().map(|r| {
            json!({
                "recordId": r.get("recordId"),
                "activity": r.get("activity"),
                "agent": r.get("agent"),
                "timestamp": r.get("timestamp"),
                "inputs": r.get("inputs"),
            })
        }).collect();

        Ok(ProvenanceTraceOutput::Ok {
            chain: serde_json::to_string(&result)?,
        })
    }

    async fn audit(
        &self,
        input: ProvenanceAuditInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProvenanceAuditOutput, Box<dyn std::error::Error>> {
        let map_table = storage.get("provenanceMapTable", &input.batch_id).await?;
        match map_table {
            None => Ok(ProvenanceAuditOutput::Notfound {
                message: format!("Batch \"{}\" not found", input.batch_id),
            }),
            Some(m) => {
                let entries = m.get("entries").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let graph = json!({
                    "batchId": input.batch_id,
                    "nodeCount": entries.len(),
                    "entries": entries,
                });
                Ok(ProvenanceAuditOutput::Ok {
                    graph: serde_json::to_string(&graph)?,
                })
            }
        }
    }

    async fn rollback(
        &self,
        input: ProvenanceRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProvenanceRollbackOutput, Box<dyn std::error::Error>> {
        let map_table = storage.get("provenanceMapTable", &input.batch_id).await?;
        match map_table {
            None => Ok(ProvenanceRollbackOutput::Notfound {
                message: format!("Batch \"{}\" not found", input.batch_id),
            }),
            Some(m) => {
                let entries = m.get("entries").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let mut rolled: i64 = 0;

                // Reverse-walk entries and delete rollback-eligible records
                for entry in entries.iter().rev() {
                    let activity = entry.get("activity").and_then(|v| v.as_str()).unwrap_or("");
                    if activity == "storage" || activity == "import" || activity == "capture" {
                        if let Some(rid) = entry.get("recordId").and_then(|v| v.as_str()) {
                            storage.del("provenanceRecord", rid).await?;
                            rolled += 1;
                        }
                    }
                }

                Ok(ProvenanceRollbackOutput::Ok { rolled })
            }
        }
    }

    async fn diff(
        &self,
        input: ProvenanceDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProvenanceDiffOutput, Box<dyn std::error::Error>> {
        let record1 = storage.get("provenanceRecord", &input.version1).await?;
        let record2 = storage.get("provenanceRecord", &input.version2).await?;

        match (record1, record2) {
            (Some(r1), Some(r2)) => {
                let mut changes = serde_json::Map::new();
                let r1_obj = r1.as_object().cloned().unwrap_or_default();
                let r2_obj = r2.as_object().cloned().unwrap_or_default();

                let mut all_keys: std::collections::HashSet<String> = r1_obj.keys().cloned().collect();
                for k in r2_obj.keys() {
                    all_keys.insert(k.clone());
                }

                for key in &all_keys {
                    let v1 = r1_obj.get(key);
                    let v2 = r2_obj.get(key);
                    if v1 != v2 {
                        changes.insert(key.clone(), json!({
                            "before": v1,
                            "after": v2,
                        }));
                    }
                }

                Ok(ProvenanceDiffOutput::Ok {
                    changes: serde_json::to_string(&changes)?,
                })
            }
            _ => Ok(ProvenanceDiffOutput::Notfound {
                message: "One or both versions not found".to_string(),
            }),
        }
    }

    async fn reproduce(
        &self,
        input: ProvenanceReproduceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProvenanceReproduceOutput, Box<dyn std::error::Error>> {
        let all_records = storage.find("provenanceRecord", None).await?;
        let mut chain: Vec<serde_json::Value> = all_records
            .iter()
            .filter(|r| r.get("entity").and_then(|v| v.as_str()) == Some(&input.entity_id))
            .cloned()
            .collect();

        if chain.is_empty() {
            return Ok(ProvenanceReproduceOutput::Notfound {
                message: format!("No provenance records for \"{}\"", input.entity_id),
            });
        }

        chain.sort_by(|a, b| {
            let ta = a.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
            let tb = b.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
            ta.cmp(tb)
        });

        let plan: Vec<serde_json::Value> = chain.iter().enumerate().map(|(i, r)| {
            json!({
                "step": i + 1,
                "action": r.get("activity").and_then(|v| v.as_str()).unwrap_or(""),
                "agent": r.get("agent").and_then(|v| v.as_str()).unwrap_or(""),
                "inputs": r.get("inputs").and_then(|v| v.as_str()).unwrap_or(""),
            })
        }).collect();

        Ok(ProvenanceReproduceOutput::Ok {
            plan: serde_json::to_string(&plan)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_record_provenance() {
        let storage = InMemoryStorage::new();
        let handler = ProvenanceHandlerImpl;
        let result = handler.record(
            ProvenanceRecordInput {
                entity: "doc-1".to_string(),
                activity: "create".to_string(),
                agent: "alice".to_string(),
                inputs: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProvenanceRecordOutput::Ok { record_id } => {
                assert!(!record_id.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_trace_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProvenanceHandlerImpl;
        let result = handler.trace(
            ProvenanceTraceInput { entity_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProvenanceTraceOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_audit_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProvenanceHandlerImpl;
        let result = handler.audit(
            ProvenanceAuditInput { batch_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProvenanceAuditOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_rollback_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProvenanceHandlerImpl;
        let result = handler.rollback(
            ProvenanceRollbackInput { batch_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProvenanceRollbackOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_diff_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProvenanceHandlerImpl;
        let result = handler.diff(
            ProvenanceDiffInput {
                entity_id: "doc-1".to_string(),
                version1: "v1".to_string(),
                version2: "v2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProvenanceDiffOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_reproduce_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProvenanceHandlerImpl;
        let result = handler.reproduce(
            ProvenanceReproduceInput { entity_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProvenanceReproduceOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
