// Provenance Concept Implementation (Rust)
//
// Data integration kit — lineage tracking, audit, and rollback.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceRecordInput {
    pub entity: String,
    pub activity: String,
    pub agent: String,
    pub inputs: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProvenanceRecordOutput {
    #[serde(rename = "ok")]
    Ok { record_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceTraceInput {
    pub entity_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProvenanceTraceOutput {
    #[serde(rename = "ok")]
    Ok { chain: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceAuditInput {
    pub batch_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProvenanceAuditOutput {
    #[serde(rename = "ok")]
    Ok { graph: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceRollbackInput {
    pub batch_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProvenanceRollbackOutput {
    #[serde(rename = "ok")]
    Ok { rolled: u64 },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceDiffInput {
    pub entity_id: String,
    pub version1: String,
    pub version2: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProvenanceDiffOutput {
    #[serde(rename = "ok")]
    Ok { changes: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceReproduceInput {
    pub entity_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProvenanceReproduceOutput {
    #[serde(rename = "ok")]
    Ok { plan: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

pub struct ProvenanceHandler;

impl ProvenanceHandler {
    pub async fn record(
        &self,
        input: ProvenanceRecordInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProvenanceRecordOutput> {
        let record_id = format!("prov-{}", chrono::Utc::now().timestamp_millis());
        let now = chrono::Utc::now().to_rfc3339();
        let batch_id = format!("batch-{}", &now[..10]);

        storage
            .put(
                "provenance_record",
                &record_id,
                json!({
                    "record_id": record_id,
                    "entity": input.entity,
                    "activity": input.activity,
                    "agent": input.agent,
                    "inputs": input.inputs,
                    "timestamp": now,
                    "batch_id": batch_id,
                }),
            )
            .await?;

        // Update map table
        let map_key = batch_id.clone();
        let mut map_table = storage
            .get("provenance_map_table", &map_key)
            .await?
            .unwrap_or(json!({"batch_id": batch_id, "entries": []}));
        let entries = map_table["entries"].as_array_mut().unwrap_or(&mut vec![]);
        let mut new_entries: Vec<serde_json::Value> = entries.clone();
        new_entries.push(json!({
            "record_id": record_id,
            "entity": input.entity,
            "activity": input.activity,
        }));
        map_table["entries"] = json!(new_entries);
        storage
            .put("provenance_map_table", &map_key, map_table)
            .await?;

        Ok(ProvenanceRecordOutput::Ok { record_id })
    }

    pub async fn trace(
        &self,
        input: ProvenanceTraceInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProvenanceTraceOutput> {
        let all = storage.find("provenance_record", None).await?;
        let chain: Vec<_> = all
            .iter()
            .filter(|r| r["entity"].as_str() == Some(&input.entity_id))
            .map(|r| {
                json!({
                    "record_id": r["record_id"],
                    "activity": r["activity"],
                    "agent": r["agent"],
                    "timestamp": r["timestamp"],
                    "inputs": r["inputs"],
                })
            })
            .collect();

        if chain.is_empty() {
            return Ok(ProvenanceTraceOutput::Notfound {
                message: format!("No provenance records for \"{}\"", input.entity_id),
            });
        }

        Ok(ProvenanceTraceOutput::Ok {
            chain: json!(chain).to_string(),
        })
    }

    pub async fn audit(
        &self,
        input: ProvenanceAuditInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProvenanceAuditOutput> {
        let map_table = storage
            .get("provenance_map_table", &input.batch_id)
            .await?;
        match map_table {
            None => Ok(ProvenanceAuditOutput::Notfound {
                message: format!("Batch \"{}\" not found", input.batch_id),
            }),
            Some(table) => {
                let entries = table["entries"].as_array().cloned().unwrap_or_default();
                let graph = json!({
                    "batch_id": input.batch_id,
                    "node_count": entries.len(),
                    "entries": entries,
                });
                Ok(ProvenanceAuditOutput::Ok {
                    graph: graph.to_string(),
                })
            }
        }
    }

    pub async fn rollback(
        &self,
        input: ProvenanceRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProvenanceRollbackOutput> {
        let map_table = storage
            .get("provenance_map_table", &input.batch_id)
            .await?;
        match map_table {
            None => Ok(ProvenanceRollbackOutput::Notfound {
                message: format!("Batch \"{}\" not found", input.batch_id),
            }),
            Some(table) => {
                let entries = table["entries"].as_array().cloned().unwrap_or_default();
                let mut rolled: u64 = 0;
                for entry in entries.iter().rev() {
                    let rid = entry["record_id"].as_str().unwrap_or("");
                    storage.del("provenance_record", rid).await?;
                    rolled += 1;
                }
                Ok(ProvenanceRollbackOutput::Ok { rolled })
            }
        }
    }

    pub async fn diff(
        &self,
        input: ProvenanceDiffInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProvenanceDiffOutput> {
        let r1 = storage.get("provenance_record", &input.version1).await?;
        let r2 = storage.get("provenance_record", &input.version2).await?;

        match (r1, r2) {
            (Some(v1), Some(v2)) => {
                let mut changes = serde_json::Map::new();
                if let (Some(o1), Some(o2)) = (v1.as_object(), v2.as_object()) {
                    for key in o1.keys().chain(o2.keys()).collect::<std::collections::HashSet<_>>() {
                        let a = o1.get(key).unwrap_or(&json!(null));
                        let b = o2.get(key).unwrap_or(&json!(null));
                        if a != b {
                            changes.insert(key.clone(), json!({"before": a, "after": b}));
                        }
                    }
                }
                Ok(ProvenanceDiffOutput::Ok {
                    changes: serde_json::Value::Object(changes).to_string(),
                })
            }
            _ => Ok(ProvenanceDiffOutput::Notfound {
                message: "One or both versions not found".into(),
            }),
        }
    }

    pub async fn reproduce(
        &self,
        input: ProvenanceReproduceInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProvenanceReproduceOutput> {
        let all = storage.find("provenance_record", None).await?;
        let chain: Vec<_> = all
            .iter()
            .filter(|r| r["entity"].as_str() == Some(&input.entity_id))
            .collect();

        if chain.is_empty() {
            return Ok(ProvenanceReproduceOutput::Notfound {
                message: format!("No provenance records for \"{}\"", input.entity_id),
            });
        }

        let plan: Vec<_> = chain
            .iter()
            .enumerate()
            .map(|(i, r)| {
                json!({
                    "step": i + 1,
                    "action": r["activity"],
                    "agent": r["agent"],
                    "inputs": r["inputs"],
                })
            })
            .collect();

        Ok(ProvenanceReproduceOutput::Ok {
            plan: json!(plan).to_string(),
        })
    }
}
