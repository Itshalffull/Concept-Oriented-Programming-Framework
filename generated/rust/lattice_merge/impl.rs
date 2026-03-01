// Lattice merge implementation
// Merges CRDT-based content using lattice join semantics.
// Always produces a clean result -- lattice joins are conflict-free
// by construction. Supports G-Counter, PN-Counter, OR-Set,
// LWW-Register, and Max-Register CRDT types.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::LatticeMergeHandler;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};

pub struct LatticeMergeHandlerImpl;

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    format!("lattice-merge-{}", ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1)
}

/// Perform lattice join on two CRDT values sharing a common base.
fn lattice_join(
    base: &serde_json::Value,
    ours: &serde_json::Value,
    theirs: &serde_json::Value,
) -> Option<serde_json::Value> {
    let our_type = ours.get("type").and_then(|v| v.as_str())?;
    let their_type = theirs.get("type").and_then(|v| v.as_str())?;

    if our_type != their_type {
        return None;
    }

    match our_type {
        "g-counter" => {
            // Element-wise max of counter vectors
            let ours_c = ours.get("counters").and_then(|v| v.as_object()).cloned().unwrap_or_default();
            let theirs_c = theirs.get("counters").and_then(|v| v.as_object()).cloned().unwrap_or_default();
            let mut merged = HashMap::new();

            let all_keys: HashSet<&String> = ours_c.keys().chain(theirs_c.keys()).collect();
            for key in all_keys {
                let o = ours_c.get(key).and_then(|v| v.as_f64()).unwrap_or(0.0);
                let t = theirs_c.get(key).and_then(|v| v.as_f64()).unwrap_or(0.0);
                merged.insert(key.clone(), json!(o.max(t)));
            }

            Some(json!({ "type": "g-counter", "counters": merged }))
        }
        "pn-counter" => {
            let merge_map = |ours_m: &serde_json::Map<String, serde_json::Value>, theirs_m: &serde_json::Map<String, serde_json::Value>| -> serde_json::Value {
                let mut merged = HashMap::new();
                let all_keys: HashSet<&String> = ours_m.keys().chain(theirs_m.keys()).collect();
                for key in all_keys {
                    let o = ours_m.get(key).and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let t = theirs_m.get(key).and_then(|v| v.as_f64()).unwrap_or(0.0);
                    merged.insert(key.clone(), json!(o.max(t)));
                }
                json!(merged)
            };

            let ours_p = ours.get("positive").and_then(|v| v.as_object()).cloned().unwrap_or_default();
            let theirs_p = theirs.get("positive").and_then(|v| v.as_object()).cloned().unwrap_or_default();
            let ours_n = ours.get("negative").and_then(|v| v.as_object()).cloned().unwrap_or_default();
            let theirs_n = theirs.get("negative").and_then(|v| v.as_object()).cloned().unwrap_or_default();

            Some(json!({
                "type": "pn-counter",
                "positive": merge_map(&ours_p, &theirs_p),
                "negative": merge_map(&ours_n, &theirs_n),
            }))
        }
        "or-set" => {
            let ours_elems: HashSet<String> = ours.get("elements")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();
            let theirs_elems: HashSet<String> = theirs.get("elements")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();
            let ours_tombs: HashSet<String> = ours.get("tombstones")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();
            let theirs_tombs: HashSet<String> = theirs.get("tombstones")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();

            let all_elems: HashSet<String> = ours_elems.union(&theirs_elems).cloned().collect();
            let all_tombs: HashSet<String> = ours_tombs.union(&theirs_tombs).cloned().collect();

            let merged: Vec<String> = all_elems.into_iter()
                .filter(|e| !all_tombs.contains(e))
                .collect();
            let tombs_vec: Vec<String> = all_tombs.into_iter().collect();

            Some(json!({
                "type": "or-set",
                "elements": merged,
                "tombstones": tombs_vec,
            }))
        }
        "lww-register" => {
            let ours_ts = ours.get("timestamp").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let theirs_ts = theirs.get("timestamp").and_then(|v| v.as_f64()).unwrap_or(0.0);

            if ours_ts >= theirs_ts {
                Some(json!({ "type": "lww-register", "value": ours.get("value"), "timestamp": ours_ts }))
            } else {
                Some(json!({ "type": "lww-register", "value": theirs.get("value"), "timestamp": theirs_ts }))
            }
        }
        "max-register" => {
            let ours_val = ours.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let theirs_val = theirs.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
            Some(json!({ "type": "max-register", "value": ours_val.max(theirs_val) }))
        }
        _ => {
            // Generic object merge: union of keys, prefer changed-from-base side
            let mut merged = serde_json::Map::new();
            merged.insert("type".into(), json!(our_type));

            if let (Some(o), Some(t)) = (ours.as_object(), theirs.as_object()) {
                let all_keys: HashSet<&String> = o.keys().chain(t.keys()).collect();
                for key in all_keys {
                    if key == "type" { continue; }
                    match (o.get(key), t.get(key)) {
                        (Some(ov), Some(tv)) => {
                            let bv = base.get(key);
                            if Some(ov) != bv { merged.insert(key.clone(), ov.clone()); }
                            else { merged.insert(key.clone(), tv.clone()); }
                        }
                        (Some(ov), None) => { merged.insert(key.clone(), ov.clone()); }
                        (None, Some(tv)) => { merged.insert(key.clone(), tv.clone()); }
                        _ => {}
                    }
                }
            }

            Some(serde_json::Value::Object(merged))
        }
    }
}

#[async_trait]
impl LatticeMergeHandler for LatticeMergeHandlerImpl {
    async fn register(
        &self,
        _input: LatticeMergeRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<LatticeMergeRegisterOutput, Box<dyn std::error::Error>> {
        Ok(LatticeMergeRegisterOutput::Ok {
            name: "lattice".into(),
            category: "merge".into(),
            content_types: vec!["application/crdt+json".into()],
        })
    }

    async fn execute(
        &self,
        input: LatticeMergeExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LatticeMergeExecuteOutput, Box<dyn std::error::Error>> {
        let base_str = std::str::from_utf8(&input.base).unwrap_or("");
        let ours_str = std::str::from_utf8(&input.ours).unwrap_or("");
        let theirs_str = std::str::from_utf8(&input.theirs).unwrap_or("");

        let parsed_base: serde_json::Value = serde_json::from_str(base_str)
            .map_err(|_| "Base content is not valid CRDT JSON")?;
        let parsed_ours: serde_json::Value = serde_json::from_str(ours_str)
            .map_err(|_| "Ours content is not valid CRDT JSON")?;
        let parsed_theirs: serde_json::Value = serde_json::from_str(theirs_str)
            .map_err(|_| "Theirs content is not valid CRDT JSON")?;

        if parsed_ours.get("type").is_none() || parsed_theirs.get("type").is_none() {
            return Ok(LatticeMergeExecuteOutput::UnsupportedContent {
                message: "Content is not a recognized CRDT lattice type (missing type field)".into(),
            });
        }

        match lattice_join(&parsed_base, &parsed_ours, &parsed_theirs) {
            Some(merged) => {
                let result = serde_json::to_vec(&merged)?;
                let id = next_id();
                storage.put("lattice-merge", &id, json!({ "id": id, "result": merged })).await?;
                Ok(LatticeMergeExecuteOutput::Clean { result })
            }
            None => {
                let ours_type = parsed_ours.get("type").and_then(|v| v.as_str()).unwrap_or("unknown");
                let theirs_type = parsed_theirs.get("type").and_then(|v| v.as_str()).unwrap_or("unknown");
                Ok(LatticeMergeExecuteOutput::UnsupportedContent {
                    message: format!("Cannot merge incompatible CRDT types: '{}' and '{}'", ours_type, theirs_type),
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = LatticeMergeHandlerImpl;
        let result = handler.register(
            LatticeMergeRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            LatticeMergeRegisterOutput::Ok { name, category, content_types } => {
                assert_eq!(name, "lattice");
                assert_eq!(category, "merge");
                assert!(!content_types.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_execute_g_counter_merge() {
        let storage = InMemoryStorage::new();
        let handler = LatticeMergeHandlerImpl;
        let base = br#"{"type":"g-counter","counters":{"a":1,"b":2}}"#.to_vec();
        let ours = br#"{"type":"g-counter","counters":{"a":3,"b":2}}"#.to_vec();
        let theirs = br#"{"type":"g-counter","counters":{"a":1,"b":5}}"#.to_vec();
        let result = handler.execute(
            LatticeMergeExecuteInput { base, ours, theirs },
            &storage,
        ).await.unwrap();
        match result {
            LatticeMergeExecuteOutput::Clean { result } => {
                let merged: serde_json::Value = serde_json::from_slice(&result).unwrap();
                assert_eq!(merged["type"], "g-counter");
            }
            _ => panic!("Expected Clean variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_incompatible_types() {
        let storage = InMemoryStorage::new();
        let handler = LatticeMergeHandlerImpl;
        let base = br#"{"type":"g-counter"}"#.to_vec();
        let ours = br#"{"type":"g-counter","counters":{}}"#.to_vec();
        let theirs = br#"{"type":"or-set","elements":[]}"#.to_vec();
        let result = handler.execute(
            LatticeMergeExecuteInput { base, ours, theirs },
            &storage,
        ).await.unwrap();
        match result {
            LatticeMergeExecuteOutput::UnsupportedContent { message } => {
                assert!(message.contains("incompatible"));
            }
            _ => panic!("Expected UnsupportedContent variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_missing_type_field() {
        let storage = InMemoryStorage::new();
        let handler = LatticeMergeHandlerImpl;
        let base = br#"{}"#.to_vec();
        let ours = br#"{"data":1}"#.to_vec();
        let theirs = br#"{"data":2}"#.to_vec();
        let result = handler.execute(
            LatticeMergeExecuteInput { base, ours, theirs },
            &storage,
        ).await.unwrap();
        match result {
            LatticeMergeExecuteOutput::UnsupportedContent { .. } => {}
            _ => panic!("Expected UnsupportedContent variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_max_register() {
        let storage = InMemoryStorage::new();
        let handler = LatticeMergeHandlerImpl;
        let base = br#"{"type":"max-register","value":5}"#.to_vec();
        let ours = br#"{"type":"max-register","value":10}"#.to_vec();
        let theirs = br#"{"type":"max-register","value":7}"#.to_vec();
        let result = handler.execute(
            LatticeMergeExecuteInput { base, ours, theirs },
            &storage,
        ).await.unwrap();
        match result {
            LatticeMergeExecuteOutput::Clean { result } => {
                let merged: serde_json::Value = serde_json::from_slice(&result).unwrap();
                assert_eq!(merged["value"], 10.0);
            }
            _ => panic!("Expected Clean variant"),
        }
    }
}
