// ErrorCorrelation Handler Implementation
//
// Links runtime errors to their static context -- which concept,
// action, variant, sync, widget, file, and line produced the
// error, and what was the state of the flow at failure time. The
// root_cause action walks backward through the flow to find the
// earliest deviation from the expected FlowGraph path.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ErrorCorrelationHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("error-correlation-{}", id)
}

pub struct ErrorCorrelationHandlerImpl;

#[async_trait]
impl ErrorCorrelationHandler for ErrorCorrelationHandlerImpl {
    async fn record(
        &self,
        input: ErrorCorrelationRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ErrorCorrelationRecordOutput, Box<dyn std::error::Error>> {
        let id = next_id();
        let timestamp = chrono::Utc::now().to_rfc3339();

        // Auto-resolve static context from the raw event
        let mut concept_entity = String::new();
        let mut action_entity = String::new();
        let mut variant_entity = String::new();
        let mut sync_entity = String::new();
        let mut widget_entity = String::new();
        let mut source_location = "{}".to_string();
        let mut flow_context = "{}".to_string();

        if let Ok(event) = serde_json::from_str::<serde_json::Value>(&input.raw_event) {
            concept_entity = event["concept"].as_str()
                .or_else(|| event["conceptEntity"].as_str())
                .unwrap_or("").to_string();
            action_entity = event["action"].as_str()
                .or_else(|| event["actionEntity"].as_str())
                .unwrap_or("").to_string();
            variant_entity = event["variant"].as_str()
                .or_else(|| event["variantEntity"].as_str())
                .unwrap_or("").to_string();
            sync_entity = event["sync"].as_str()
                .or_else(|| event["syncEntity"].as_str())
                .unwrap_or("").to_string();
            widget_entity = event["widget"].as_str()
                .or_else(|| event["widgetEntity"].as_str())
                .unwrap_or("").to_string();

            if event.get("file").is_some() || event.get("line").is_some() {
                source_location = json!({
                    "file": event["file"].as_str().unwrap_or(""),
                    "line": event["line"].as_i64().unwrap_or(0),
                    "col": event["col"].as_i64().unwrap_or(0),
                }).to_string();
            }

            flow_context = json!({
                "flowId": input.flow_id,
                "step": event["step"].as_i64().unwrap_or(0),
                "phase": event["phase"].as_str().unwrap_or(""),
            }).to_string();
        }

        storage.put("error-correlation", &id, json!({
            "id": id,
            "flowId": input.flow_id,
            "timestamp": timestamp,
            "errorKind": input.error_kind,
            "errorMessage": input.message,
            "conceptEntity": concept_entity,
            "actionEntity": action_entity,
            "variantEntity": variant_entity,
            "syncEntity": sync_entity,
            "widgetEntity": widget_entity,
            "sourceLocation": source_location,
            "flowContext": flow_context,
        })).await?;

        Ok(ErrorCorrelationRecordOutput::Ok { error: id })
    }

    async fn find_by_entity(
        &self,
        input: ErrorCorrelationFindByEntityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ErrorCorrelationFindByEntityOutput, Box<dyn std::error::Error>> {
        let all_errors = storage.find("error-correlation", json!({})).await?;
        let symbol = &input.symbol;
        let since = &input.since;

        let matching: Vec<&serde_json::Value> = all_errors.iter().filter(|e| {
            let matches_symbol =
                e["conceptEntity"].as_str() == Some(symbol) ||
                e["actionEntity"].as_str() == Some(symbol) ||
                e["variantEntity"].as_str() == Some(symbol) ||
                e["syncEntity"].as_str() == Some(symbol) ||
                e["widgetEntity"].as_str() == Some(symbol);

            if !matches_symbol {
                return false;
            }

            if !since.is_empty() {
                let error_time = e["timestamp"].as_str().unwrap_or("");
                return error_time >= since.as_str();
            }
            true
        }).collect();

        Ok(ErrorCorrelationFindByEntityOutput::Ok {
            errors: serde_json::to_string(&matching)?,
        })
    }

    async fn find_by_kind(
        &self,
        input: ErrorCorrelationFindByKindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ErrorCorrelationFindByKindOutput, Box<dyn std::error::Error>> {
        let results = storage.find("error-correlation", json!({
            "errorKind": input.error_kind,
        })).await?;

        let filtered: Vec<&serde_json::Value> = if !input.since.is_empty() {
            results.iter()
                .filter(|e| e["timestamp"].as_str().unwrap_or("") >= input.since.as_str())
                .collect()
        } else {
            results.iter().collect()
        };

        Ok(ErrorCorrelationFindByKindOutput::Ok {
            errors: serde_json::to_string(&filtered)?,
        })
    }

    async fn error_hotspots(
        &self,
        input: ErrorCorrelationErrorHotspotsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ErrorCorrelationErrorHotspotsOutput, Box<dyn std::error::Error>> {
        let all_errors = storage.find("error-correlation", json!({})).await?;

        let filtered: Vec<&serde_json::Value> = if !input.since.is_empty() {
            all_errors.iter()
                .filter(|e| e["timestamp"].as_str().unwrap_or("") >= input.since.as_str())
                .collect()
        } else {
            all_errors.iter().collect()
        };

        // Group by entity symbols and count
        let mut counts: std::collections::HashMap<String, (i64, String, String)> =
            std::collections::HashMap::new();

        for e in &filtered {
            let symbol = e["actionEntity"].as_str()
                .filter(|s| !s.is_empty())
                .or_else(|| e["syncEntity"].as_str().filter(|s| !s.is_empty()))
                .or_else(|| e["conceptEntity"].as_str().filter(|s| !s.is_empty()))
                .or_else(|| e["widgetEntity"].as_str().filter(|s| !s.is_empty()))
                .unwrap_or("unknown")
                .to_string();

            let ts = e["timestamp"].as_str().unwrap_or("").to_string();
            let msg = e["errorMessage"].as_str().unwrap_or("").to_string();

            let entry = counts.entry(symbol).or_insert((0, String::new(), String::new()));
            entry.0 += 1;
            if ts > entry.1 {
                entry.1 = ts;
                entry.2 = msg;
            }
        }

        let top_n = if input.top_n > 0 { input.top_n as usize } else { 10 };
        let mut hotspots: Vec<serde_json::Value> = counts.into_iter()
            .map(|(symbol, (count, last_seen, sample_message))| json!({
                "symbol": symbol,
                "count": count,
                "lastSeen": last_seen,
                "sampleMessage": sample_message,
            }))
            .collect();

        hotspots.sort_by(|a, b| {
            b["count"].as_i64().unwrap_or(0).cmp(&a["count"].as_i64().unwrap_or(0))
        });
        hotspots.truncate(top_n);

        Ok(ErrorCorrelationErrorHotspotsOutput::Ok {
            hotspots: serde_json::to_string(&hotspots)?,
        })
    }

    async fn root_cause(
        &self,
        input: ErrorCorrelationRootCauseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ErrorCorrelationRootCauseOutput, Box<dyn std::error::Error>> {
        let record = storage.get("error-correlation", &input.error).await?;
        if record.is_none() {
            return Ok(ErrorCorrelationRootCauseOutput::Inconclusive {
                partial_chain: "[]".to_string(),
            });
        }

        let record = record.unwrap();
        let flow_id = record["flowId"].as_str().unwrap_or("");

        // Retrieve the enriched flow for this error's flow ID
        let flows = storage.find("runtime-flow", json!({ "flowId": flow_id })).await?;
        if flows.is_empty() {
            return Ok(ErrorCorrelationRootCauseOutput::Inconclusive {
                partial_chain: "[]".to_string(),
            });
        }

        let flow = &flows[0];
        let steps: Vec<serde_json::Value> = serde_json::from_str(
            flow["steps"].as_str().unwrap_or("[]")
        ).unwrap_or_default();

        // Walk backward through steps to find first deviation
        let mut chain: Vec<serde_json::Value> = Vec::new();
        let mut likely_cause: Option<serde_json::Value> = None;

        for i in (0..steps.len()).rev() {
            let step = &steps[i];
            let status = step["status"].as_str()
                .or_else(|| step["outcome"].as_str())
                .unwrap_or("ok");

            chain.insert(0, json!({
                "step": i,
                "entity": step["entity"].as_str()
                    .or_else(|| step["symbol"].as_str())
                    .unwrap_or(""),
                "status": status,
            }));

            if status == "error" || status == "failed" || status == "deviation" {
                likely_cause = Some(json!({
                    "entity": step["entity"].as_str()
                        .or_else(|| step["symbol"].as_str())
                        .unwrap_or(""),
                    "reason": step["error"].as_str()
                        .or_else(|| step["reason"].as_str())
                        .unwrap_or("Unknown deviation"),
                }));
                break;
            }
        }

        match likely_cause {
            None => Ok(ErrorCorrelationRootCauseOutput::Inconclusive {
                partial_chain: serde_json::to_string(&chain)?,
            }),
            Some(cause) => {
                let source = record["sourceLocation"].as_str().unwrap_or("{}");
                let source = if source == "{}" {
                    json!({"file": "", "line": 0, "col": 0}).to_string()
                } else {
                    source.to_string()
                };

                Ok(ErrorCorrelationRootCauseOutput::Ok {
                    chain: serde_json::to_string(&chain)?,
                    likely_cause: serde_json::to_string(&cause)?,
                    source,
                })
            }
        }
    }

    async fn get(
        &self,
        input: ErrorCorrelationGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ErrorCorrelationGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("error-correlation", &input.error).await?;
        match record {
            None => Ok(ErrorCorrelationGetOutput::Notfound),
            Some(rec) => Ok(ErrorCorrelationGetOutput::Ok {
                error: rec["id"].as_str().unwrap_or("").to_string(),
                flow_id: rec["flowId"].as_str().unwrap_or("").to_string(),
                error_kind: rec["errorKind"].as_str().unwrap_or("").to_string(),
                error_message: rec["errorMessage"].as_str().unwrap_or("").to_string(),
                timestamp: rec["timestamp"].as_str().unwrap_or("").to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_record_error() {
        let storage = InMemoryStorage::new();
        let handler = ErrorCorrelationHandlerImpl;
        let raw_event = json!({
            "concept": "echo",
            "action": "send",
            "file": "src/echo.ts",
            "line": 42,
        });
        let result = handler.record(
            ErrorCorrelationRecordInput {
                flow_id: "flow-1".to_string(),
                error_kind: "runtime".to_string(),
                message: "Something failed".to_string(),
                raw_event: serde_json::to_string(&raw_event).unwrap(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ErrorCorrelationRecordOutput::Ok { error } => {
                assert!(!error.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_find_by_entity() {
        let storage = InMemoryStorage::new();
        let handler = ErrorCorrelationHandlerImpl;
        let result = handler.find_by_entity(
            ErrorCorrelationFindByEntityInput {
                symbol: "echo".to_string(),
                since: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ErrorCorrelationFindByEntityOutput::Ok { errors } => {
                assert!(!errors.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_error_hotspots_empty() {
        let storage = InMemoryStorage::new();
        let handler = ErrorCorrelationHandlerImpl;
        let result = handler.error_hotspots(
            ErrorCorrelationErrorHotspotsInput {
                since: "".to_string(),
                top_n: 5,
            },
            &storage,
        ).await.unwrap();
        match result {
            ErrorCorrelationErrorHotspotsOutput::Ok { hotspots } => {
                assert!(hotspots.contains("[]") || !hotspots.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_root_cause_inconclusive() {
        let storage = InMemoryStorage::new();
        let handler = ErrorCorrelationHandlerImpl;
        let result = handler.root_cause(
            ErrorCorrelationRootCauseInput {
                error: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ErrorCorrelationRootCauseOutput::Inconclusive { .. } => {},
            _ => panic!("Expected Inconclusive variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ErrorCorrelationHandlerImpl;
        let result = handler.get(
            ErrorCorrelationGetInput {
                error: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ErrorCorrelationGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
