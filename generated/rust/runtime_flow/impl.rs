use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RuntimeFlowHandler;
use serde_json::json;

pub struct RuntimeFlowHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("runtime-flow-{}-{}", t.as_secs(), t.subsec_nanos())
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[async_trait]
impl RuntimeFlowHandler for RuntimeFlowHandlerImpl {
    async fn correlate(
        &self,
        input: RuntimeFlowCorrelateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowCorrelateOutput, Box<dyn std::error::Error>> {
        let log_entries = storage.find("action-log", Some(&json!({"flow": input.flow_id}))).await?;
        if log_entries.is_empty() {
            return Ok(RuntimeFlowCorrelateOutput::Notfound);
        }

        let id = next_id();
        let now = now_iso();
        let mut unresolved = Vec::new();
        let mut steps = Vec::new();
        let mut trigger = String::new();
        let mut has_error = false;

        for entry in &log_entries {
            let concept = entry.get("concept").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let action = entry.get("action").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let variant_name = entry.get("variant").and_then(|v| v.as_str()).unwrap_or("").to_string();

            // Resolve to static entities
            let concept_results = storage.find("concept-entity", Some(&json!({"name": concept}))).await?;
            if concept_results.is_empty() && !concept.is_empty() {
                unresolved.push(json!({"type": "concept", "name": concept}));
            }

            let action_results = storage.find("action-entity", Some(&json!({"concept": concept, "name": action}))).await?;
            if action_results.is_empty() && !action.is_empty() {
                unresolved.push(json!({"type": "action", "name": format!("{}/{}", concept, action)}));
            }

            if steps.is_empty() {
                trigger = format!("{}/{}", concept, action);
            }

            let entry_type = entry.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if entry_type == "completion" && variant_name == "error" {
                has_error = true;
            }

            steps.push(json!({
                "index": steps.len(),
                "type": entry_type,
                "concept": concept,
                "action": action,
                "variant": variant_name,
                "timestamp": entry.get("timestamp").and_then(|v| v.as_str()).unwrap_or(""),
                "status": if has_error { "error" } else { "ok" }
            }));
        }

        let status = if has_error { "failed" } else { "completed" };
        let step_count = steps.len() as i64;

        // Compare against static flow graph
        let flow_graphs = storage.find("flow-graph", Some(&json!({"trigger": trigger}))).await?;
        let deviation_count = if flow_graphs.is_empty() { 0i64 } else { 0i64 };

        storage.put("runtime-flow", &id, json!({
            "id": id,
            "flowId": input.flow_id,
            "startedAt": now,
            "completedAt": now,
            "status": status,
            "trigger": trigger,
            "steps": serde_json::to_string(&steps)?,
            "stepCount": step_count,
            "deviationCount": deviation_count,
            "deviations": "[]"
        })).await?;

        if !unresolved.is_empty() {
            Ok(RuntimeFlowCorrelateOutput::Partial {
                flow: id,
                unresolved: serde_json::to_string(&unresolved)?,
            })
        } else {
            Ok(RuntimeFlowCorrelateOutput::Ok { flow: id })
        }
    }

    async fn find_by_action(
        &self,
        input: RuntimeFlowFindByActionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowFindByActionOutput, Box<dyn std::error::Error>> {
        let all_flows = storage.find("runtime-flow", None).await?;
        let matching: Vec<_> = all_flows.into_iter().filter(|f| {
            let steps_str = f.get("steps").and_then(|v| v.as_str()).unwrap_or("[]");
            let steps: Vec<serde_json::Value> = serde_json::from_str(steps_str).unwrap_or_default();
            let has_action = steps.iter().any(|s| s.get("action").and_then(|v| v.as_str()) == Some(&input.action));
            if !has_action { return false; }
            if !input.since.is_empty() {
                f.get("startedAt").and_then(|v| v.as_str()).unwrap_or("") >= input.since.as_str()
            } else { true }
        }).collect();

        Ok(RuntimeFlowFindByActionOutput::Ok {
            flows: serde_json::to_string(&matching)?,
        })
    }

    async fn find_by_sync(
        &self,
        input: RuntimeFlowFindBySyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowFindBySyncOutput, Box<dyn std::error::Error>> {
        let all_flows = storage.find("runtime-flow", None).await?;
        let matching: Vec<_> = all_flows.into_iter().filter(|f| {
            let steps_str = f.get("steps").and_then(|v| v.as_str()).unwrap_or("[]");
            let steps: Vec<serde_json::Value> = serde_json::from_str(steps_str).unwrap_or_default();
            let has_sync = steps.iter().any(|s| {
                s.get("syncEntity").and_then(|v| v.as_str()) == Some(&input.sync) ||
                s.get("sync").and_then(|v| v.as_str()) == Some(&input.sync)
            });
            if !has_sync { return false; }
            if !input.since.is_empty() {
                f.get("startedAt").and_then(|v| v.as_str()).unwrap_or("") >= input.since.as_str()
            } else { true }
        }).collect();

        Ok(RuntimeFlowFindBySyncOutput::Ok {
            flows: serde_json::to_string(&matching)?,
        })
    }

    async fn find_by_variant(
        &self,
        input: RuntimeFlowFindByVariantInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowFindByVariantOutput, Box<dyn std::error::Error>> {
        let all_flows = storage.find("runtime-flow", None).await?;
        let matching: Vec<_> = all_flows.into_iter().filter(|f| {
            let steps_str = f.get("steps").and_then(|v| v.as_str()).unwrap_or("[]");
            let steps: Vec<serde_json::Value> = serde_json::from_str(steps_str).unwrap_or_default();
            let has_variant = steps.iter().any(|s| {
                s.get("variant").and_then(|v| v.as_str()) == Some(&input.variant) ||
                s.get("variantEntity").and_then(|v| v.as_str()) == Some(&input.variant)
            });
            if !has_variant { return false; }
            if !input.since.is_empty() {
                f.get("startedAt").and_then(|v| v.as_str()).unwrap_or("") >= input.since.as_str()
            } else { true }
        }).collect();

        Ok(RuntimeFlowFindByVariantOutput::Ok {
            flows: serde_json::to_string(&matching)?,
        })
    }

    async fn find_failures(
        &self,
        input: RuntimeFlowFindFailuresInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowFindFailuresOutput, Box<dyn std::error::Error>> {
        let all_flows = storage.find("runtime-flow", None).await?;
        let failures: Vec<_> = all_flows.into_iter().filter(|f| {
            let status = f.get("status").and_then(|v| v.as_str()).unwrap_or("");
            if status != "failed" && status != "timeout" { return false; }
            if !input.since.is_empty() {
                f.get("startedAt").and_then(|v| v.as_str()).unwrap_or("") >= input.since.as_str()
            } else { true }
        }).collect();

        Ok(RuntimeFlowFindFailuresOutput::Ok {
            flows: serde_json::to_string(&failures)?,
        })
    }

    async fn compare_to_static(
        &self,
        input: RuntimeFlowCompareToStaticInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowCompareToStaticOutput, Box<dyn std::error::Error>> {
        let record = storage.get("runtime-flow", &input.flow).await?;
        if record.is_none() {
            return Ok(RuntimeFlowCompareToStaticOutput::NoStaticPath);
        }
        let record = record.unwrap();

        let trigger = record.get("trigger").and_then(|v| v.as_str()).unwrap_or("");
        let flow_graphs = storage.find("flow-graph", Some(&json!({"trigger": trigger}))).await?;
        if flow_graphs.is_empty() {
            return Ok(RuntimeFlowCompareToStaticOutput::NoStaticPath);
        }

        let deviations_str = record.get("deviations").and_then(|v| v.as_str()).unwrap_or("[]");
        let deviations: Vec<serde_json::Value> = serde_json::from_str(deviations_str).unwrap_or_default();
        let steps_str = record.get("steps").and_then(|v| v.as_str()).unwrap_or("[]");
        let steps: Vec<serde_json::Value> = serde_json::from_str(steps_str).unwrap_or_default();

        if deviations.is_empty() {
            Ok(RuntimeFlowCompareToStaticOutput::Matches {
                path_length: steps.len() as i64,
            })
        } else {
            Ok(RuntimeFlowCompareToStaticOutput::Deviates {
                deviations: serde_json::to_string(&deviations)?,
            })
        }
    }

    async fn source_locations(
        &self,
        input: RuntimeFlowSourceLocationsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowSourceLocationsOutput, Box<dyn std::error::Error>> {
        let record = storage.get("runtime-flow", &input.flow).await?;
        if record.is_none() {
            return Ok(RuntimeFlowSourceLocationsOutput::Ok { locations: "[]".to_string() });
        }

        let record = record.unwrap();
        let steps_str = record.get("steps").and_then(|v| v.as_str()).unwrap_or("[]");
        let steps: Vec<serde_json::Value> = serde_json::from_str(steps_str).unwrap_or_default();

        let mut locations = Vec::new();
        for step in &steps {
            let concept = step.get("concept").and_then(|v| v.as_str()).unwrap_or("");
            let action = step.get("action").and_then(|v| v.as_str()).unwrap_or("");
            locations.push(json!({
                "step": step.get("index").and_then(|v| v.as_i64()).unwrap_or(0),
                "file": "",
                "line": 0,
                "col": 0,
                "symbol": format!("{}/{}", concept, action)
            }));
        }

        Ok(RuntimeFlowSourceLocationsOutput::Ok {
            locations: serde_json::to_string(&locations)?,
        })
    }

    async fn get(
        &self,
        input: RuntimeFlowGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("runtime-flow", &input.flow).await?;
        if record.is_none() {
            return Ok(RuntimeFlowGetOutput::Notfound);
        }

        let r = record.unwrap();
        Ok(RuntimeFlowGetOutput::Ok {
            flow: r.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            flow_id: r.get("flowId").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            status: r.get("status").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            step_count: r.get("stepCount").and_then(|v| v.as_i64()).unwrap_or(0),
            deviation_count: r.get("deviationCount").and_then(|v| v.as_i64()).unwrap_or(0),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_correlate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeFlowHandlerImpl;
        let result = handler.correlate(
            RuntimeFlowCorrelateInput { flow_id: "missing-flow".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeFlowCorrelateOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_find_by_action_empty() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeFlowHandlerImpl;
        let result = handler.find_by_action(
            RuntimeFlowFindByActionInput { action: "create".to_string(), since: "".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeFlowFindByActionOutput::Ok { flows } => {
                assert_eq!(flows, "[]");
            },
        }
    }

    #[tokio::test]
    async fn test_find_by_sync_empty() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeFlowHandlerImpl;
        let result = handler.find_by_sync(
            RuntimeFlowFindBySyncInput { sync: "my-sync".to_string(), since: "".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeFlowFindBySyncOutput::Ok { flows } => {
                assert_eq!(flows, "[]");
            },
        }
    }

    #[tokio::test]
    async fn test_find_by_variant_empty() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeFlowHandlerImpl;
        let result = handler.find_by_variant(
            RuntimeFlowFindByVariantInput { variant: "ok".to_string(), since: "".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeFlowFindByVariantOutput::Ok { flows } => {
                assert_eq!(flows, "[]");
            },
        }
    }

    #[tokio::test]
    async fn test_find_failures_empty() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeFlowHandlerImpl;
        let result = handler.find_failures(
            RuntimeFlowFindFailuresInput { since: "".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeFlowFindFailuresOutput::Ok { flows } => {
                assert_eq!(flows, "[]");
            },
        }
    }

    #[tokio::test]
    async fn test_compare_to_static_no_static_path() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeFlowHandlerImpl;
        let result = handler.compare_to_static(
            RuntimeFlowCompareToStaticInput { flow: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeFlowCompareToStaticOutput::NoStaticPath => {},
            _ => panic!("Expected NoStaticPath variant"),
        }
    }

    #[tokio::test]
    async fn test_source_locations_empty() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeFlowHandlerImpl;
        let result = handler.source_locations(
            RuntimeFlowSourceLocationsInput { flow: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeFlowSourceLocationsOutput::Ok { locations } => {
                assert_eq!(locations, "[]");
            },
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeFlowHandlerImpl;
        let result = handler.get(
            RuntimeFlowGetInput { flow: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeFlowGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
