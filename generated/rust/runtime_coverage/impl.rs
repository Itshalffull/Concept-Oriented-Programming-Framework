use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RuntimeCoverageHandler;
use serde_json::json;

pub struct RuntimeCoverageHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("runtime-coverage-{}-{}", t.as_secs(), t.subsec_nanos())
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[async_trait]
impl RuntimeCoverageHandler for RuntimeCoverageHandlerImpl {
    async fn record(
        &self,
        input: RuntimeCoverageRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageRecordOutput, Box<dyn std::error::Error>> {
        let now = now_iso();
        let existing = storage.find("runtime-coverage", Some(&json!({"symbol": input.symbol}))).await?;

        if let Some(entry) = existing.first() {
            let id = entry.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let count = entry.get("executionCount").and_then(|v| v.as_i64()).unwrap_or(0) + 1;
            let mut flow_ids: Vec<String> = entry.get("flowIds")
                .and_then(|v| v.as_str())
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or_default();
            flow_ids.push(input.flow_id);

            let mut updated = entry.clone();
            updated["lastExercised"] = json!(now);
            updated["executionCount"] = json!(count);
            updated["flowIds"] = json!(serde_json::to_string(&flow_ids)?);
            storage.put("runtime-coverage", &id, updated).await?;

            Ok(RuntimeCoverageRecordOutput::Ok { entry: id })
        } else {
            let id = next_id();
            storage.put("runtime-coverage", &id, json!({
                "id": id,
                "entitySymbol": input.symbol,
                "symbol": input.symbol,
                "entityKind": input.kind,
                "firstExercised": now,
                "lastExercised": now,
                "executionCount": 1,
                "flowIds": serde_json::to_string(&vec![input.flow_id])?
            })).await?;

            Ok(RuntimeCoverageRecordOutput::Created { entry: id })
        }
    }

    async fn coverage_report(
        &self,
        input: RuntimeCoverageCoverageReportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageCoverageReportOutput, Box<dyn std::error::Error>> {
        let entries = storage.find("runtime-coverage", Some(&json!({"entityKind": input.kind}))).await?;
        let filtered: Vec<_> = if input.since.is_empty() {
            entries
        } else {
            entries.into_iter().filter(|e| {
                e.get("lastExercised").and_then(|v| v.as_str()).unwrap_or("") >= input.since.as_str()
            }).collect()
        };

        // Estimate total entities from the entity registry
        let entity_relation = match input.kind.as_str() {
            "action" => "action-entity",
            "variant" => "variant-entity",
            "sync" => "sync-entity",
            "widget-state" => "widget-state-entity",
            "state-field" => "state-field",
            _ => "runtime-coverage",
        };
        let total = storage.find(entity_relation, None).await?.len() as f64;
        let exercised = filtered.len() as f64;
        let unexercised = (total - exercised).max(0.0);
        let pct = if total > 0.0 { (exercised / total * 100.0 * 100.0).round() / 100.0 } else { 0.0 };

        Ok(RuntimeCoverageCoverageReportOutput::Ok {
            report: serde_json::to_string(&json!({
                "totalEntities": total as i64,
                "exercised": exercised as i64,
                "unexercised": unexercised as i64,
                "coveragePct": pct
            }))?,
        })
    }

    async fn variant_coverage(
        &self,
        input: RuntimeCoverageVariantCoverageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageVariantCoverageOutput, Box<dyn std::error::Error>> {
        let actions = storage.find("action-entity", Some(&json!({"concept": input.concept}))).await?;
        let mut report = Vec::new();

        for action in &actions {
            let action_name = action.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let action_ref = format!("{}/{}", input.concept, action_name);
            let variants = storage.find("variant-entity", Some(&json!({"action": action_ref}))).await?;

            for v in &variants {
                let symbol = v.get("symbol").and_then(|s| s.as_str()).unwrap_or("").to_string();
                let coverage = storage.find("runtime-coverage", Some(&json!({"symbol": symbol}))).await?;
                let entry = coverage.first();

                report.push(json!({
                    "action": action_ref,
                    "variant": v.get("tag").and_then(|s| s.as_str()).unwrap_or(""),
                    "exercised": entry.is_some(),
                    "count": entry.and_then(|e| e.get("executionCount").and_then(|v| v.as_i64())).unwrap_or(0),
                    "lastSeen": entry.and_then(|e| e.get("lastExercised").and_then(|v| v.as_str())).unwrap_or("")
                }));
            }
        }

        Ok(RuntimeCoverageVariantCoverageOutput::Ok {
            report: serde_json::to_string(&report)?,
        })
    }

    async fn sync_coverage(
        &self,
        input: RuntimeCoverageSyncCoverageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageSyncCoverageOutput, Box<dyn std::error::Error>> {
        let all_syncs = storage.find("sync-entity", None).await?;
        let mut report = Vec::new();

        for sync in &all_syncs {
            let symbol = sync.get("symbol").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let coverage = storage.find("runtime-coverage", Some(&json!({"symbol": symbol}))).await?;
            let entry = coverage.first();

            if !input.since.is_empty() {
                if let Some(e) = entry {
                    let last = e.get("lastExercised").and_then(|v| v.as_str()).unwrap_or("");
                    if last < input.since.as_str() { continue; }
                }
            }

            report.push(json!({
                "sync": sync.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                "tier": sync.get("tier").and_then(|v| v.as_str()).unwrap_or("standard"),
                "exercised": entry.is_some(),
                "count": entry.and_then(|e| e.get("executionCount").and_then(|v| v.as_i64())).unwrap_or(0),
                "avgDurationMs": 0
            }));
        }

        Ok(RuntimeCoverageSyncCoverageOutput::Ok {
            report: serde_json::to_string(&report)?,
        })
    }

    async fn widget_state_coverage(
        &self,
        input: RuntimeCoverageWidgetStateCoverageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageWidgetStateCoverageOutput, Box<dyn std::error::Error>> {
        let all_states = storage.find("widget-state-entity", Some(&json!({"widget": input.widget}))).await?;
        let mut report = Vec::new();

        for state in &all_states {
            let symbol = state.get("symbol").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let coverage = storage.find("runtime-coverage", Some(&json!({"symbol": symbol}))).await?;
            let entry = coverage.first();

            report.push(json!({
                "state": state.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                "entered": entry.is_some(),
                "count": entry.and_then(|e| e.get("executionCount").and_then(|v| v.as_i64())).unwrap_or(0),
                "transitionsExercised": [],
                "transitionsUnexercised": []
            }));
        }

        Ok(RuntimeCoverageWidgetStateCoverageOutput::Ok {
            report: serde_json::to_string(&report)?,
        })
    }

    async fn widget_lifecycle_report(
        &self,
        input: RuntimeCoverageWidgetLifecycleReportInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageWidgetLifecycleReportOutput, Box<dyn std::error::Error>> {
        let report = json!({
            "widget": input.widget,
            "mountCount": 0,
            "unmountCount": 0,
            "activeInstances": 0,
            "renderCount": 0,
            "unnecessaryRenderPct": 0.0,
            "propChangeSources": 0,
            "slotActivity": 0
        });

        Ok(RuntimeCoverageWidgetLifecycleReportOutput::Ok {
            report: serde_json::to_string(&report)?,
        })
    }

    async fn widget_render_trace(
        &self,
        input: RuntimeCoverageWidgetRenderTraceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageWidgetRenderTraceOutput, Box<dyn std::error::Error>> {
        let renders = storage.find("runtime-coverage", Some(&json!({
            "symbol": input.widget_instance,
            "entityKind": "widget-render"
        }))).await?;

        if renders.is_empty() {
            return Ok(RuntimeCoverageWidgetRenderTraceOutput::Notfound);
        }

        let mut traces = Vec::new();
        for r in &renders {
            let flow_ids: Vec<String> = r.get("flowIds")
                .and_then(|v| v.as_str())
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or_default();
            for fid in flow_ids {
                traces.push(json!({
                    "flowId": fid,
                    "timestamp": r.get("lastExercised").and_then(|v| v.as_str()).unwrap_or(""),
                    "duration": 0,
                    "trigger": "signal",
                    "propsChanged": [],
                    "necessary": true
                }));
            }
        }

        Ok(RuntimeCoverageWidgetRenderTraceOutput::Ok {
            renders: serde_json::to_string(&traces)?,
        })
    }

    async fn widget_comparison(
        &self,
        input: RuntimeCoverageWidgetComparisonInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageWidgetComparisonOutput, Box<dyn std::error::Error>> {
        let all_widgets = storage.find("widget-entity", None).await?;
        let mut ranking = Vec::new();
        let top_n = input.top_n.max(1) as usize;

        for w in &all_widgets {
            let widget_name = w.get("name").and_then(|v| v.as_str()).unwrap_or("");
            ranking.push(json!({
                "widget": widget_name,
                "mountCount": 0,
                "totalRenders": 0,
                "unnecessaryRenderPct": 0.0,
                "avgRenderMs": 0,
                "p90RenderMs": 0
            }));
        }

        ranking.truncate(top_n);

        Ok(RuntimeCoverageWidgetComparisonOutput::Ok {
            ranking: serde_json::to_string(&ranking)?,
        })
    }

    async fn dead_at_runtime(
        &self,
        input: RuntimeCoverageDeadAtRuntimeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageDeadAtRuntimeOutput, Box<dyn std::error::Error>> {
        let entity_relation = match input.kind.as_str() {
            "action" => "action-entity",
            "variant" => "variant-entity",
            "sync" => "sync-entity",
            "widget-state" => "widget-state-entity",
            "state-field" => "state-field",
            _ => "action-entity",
        };

        let all_entities = storage.find(entity_relation, None).await?;
        let exercised = storage.find("runtime-coverage", Some(&json!({"entityKind": input.kind}))).await?;

        let exercised_symbols: std::collections::HashSet<String> = exercised.iter()
            .filter_map(|e| e.get("symbol").and_then(|v| v.as_str()).map(String::from))
            .collect();

        let never_exercised: Vec<String> = all_entities.iter()
            .filter_map(|e| {
                let sym = e.get("symbol").and_then(|v| v.as_str())?;
                if exercised_symbols.contains(sym) { None } else { Some(sym.to_string()) }
            })
            .collect();

        Ok(RuntimeCoverageDeadAtRuntimeOutput::Ok {
            never_exercised: serde_json::to_string(&never_exercised)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_record_creates_new_entry() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeCoverageHandlerImpl;
        let result = handler.record(
            RuntimeCoverageRecordInput {
                symbol: "user/create".to_string(),
                kind: "action".to_string(),
                flow_id: "flow-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeCoverageRecordOutput::Created { entry } => {
                assert!(entry.starts_with("runtime-coverage-"));
            },
            _ => panic!("Expected Created variant"),
        }
    }

    #[tokio::test]
    async fn test_coverage_report() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeCoverageHandlerImpl;
        let result = handler.coverage_report(
            RuntimeCoverageCoverageReportInput {
                kind: "action".to_string(),
                since: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeCoverageCoverageReportOutput::Ok { report } => {
                assert!(report.contains("totalEntities"));
            },
        }
    }

    #[tokio::test]
    async fn test_widget_lifecycle_report() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeCoverageHandlerImpl;
        let result = handler.widget_lifecycle_report(
            RuntimeCoverageWidgetLifecycleReportInput {
                widget: "my-widget".to_string(),
                since: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeCoverageWidgetLifecycleReportOutput::Ok { report } => {
                assert!(report.contains("mountCount"));
            },
        }
    }

    #[tokio::test]
    async fn test_widget_render_trace_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeCoverageHandlerImpl;
        let result = handler.widget_render_trace(
            RuntimeCoverageWidgetRenderTraceInput { widget_instance: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeCoverageWidgetRenderTraceOutput::Notfound => {},
            _ => panic!("Expected Notfound"),
        }
    }

    #[tokio::test]
    async fn test_dead_at_runtime() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeCoverageHandlerImpl;
        let result = handler.dead_at_runtime(
            RuntimeCoverageDeadAtRuntimeInput { kind: "action".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeCoverageDeadAtRuntimeOutput::Ok { never_exercised } => {
                assert_eq!(never_exercised, "[]");
            },
        }
    }
}
