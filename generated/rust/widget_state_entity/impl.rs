// WidgetStateEntity Handler Implementation
//
// A state in a widget's finite state machine, with transitions,
// entry/exit actions, and guards. Enables static analysis of
// widget behavior -- reachability, dead states, unhandled events.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WidgetStateEntityHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};
use std::collections::{HashSet, VecDeque};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("widget-state-entity-{}", n)
}

/// Parse transition edges from a state record's transitions JSON string.
fn parse_transitions(record: &serde_json::Value) -> Vec<(String, String)> {
    let trans_str = record.get("transitions")
        .and_then(|v| v.as_str())
        .unwrap_or("[]");
    let transitions: Vec<serde_json::Value> = serde_json::from_str(trans_str).unwrap_or_default();
    transitions.iter().map(|t| {
        let target = t.get("target").or_else(|| t.get("to"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let event = t.get("event").or_else(|| t.get("on"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        (target, event)
    }).collect()
}

pub struct WidgetStateEntityHandlerImpl;

#[async_trait]
impl WidgetStateEntityHandler for WidgetStateEntityHandlerImpl {
    async fn register(
        &self,
        input: WidgetStateEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetStateEntityRegisterOutput, Box<dyn std::error::Error>> {
        let widget = &input.widget;
        let name = &input.name;
        let initial = &input.initial;

        let id = next_id();
        let symbol = format!("clef/widget-state/{}/{}", widget, name);

        storage.put("widget-state-entity", &id, json!({
            "id": id,
            "widget": widget,
            "name": name,
            "symbol": symbol,
            "initial": initial,
            "transitions": "[]",
            "entryActions": "[]",
            "exitActions": "[]",
            "transitionCount": 0
        })).await?;

        Ok(WidgetStateEntityRegisterOutput::Ok {
            widget_state: id,
        })
    }

    async fn find_by_widget(
        &self,
        input: WidgetStateEntityFindByWidgetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetStateEntityFindByWidgetOutput, Box<dyn std::error::Error>> {
        let results = storage.find("widget-state-entity", json!({ "widget": input.widget })).await?;

        Ok(WidgetStateEntityFindByWidgetOutput::Ok {
            states: serde_json::to_string(&results)?,
        })
    }

    async fn reachable_from(
        &self,
        input: WidgetStateEntityReachableFromInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetStateEntityReachableFromOutput, Box<dyn std::error::Error>> {
        let widget_state_id = &input.widget_state;

        let record = storage.get("widget-state-entity", widget_state_id).await?;
        if record.is_null() {
            return Ok(WidgetStateEntityReachableFromOutput::Ok {
                reachable: "[]".to_string(),
                via: "[]".to_string(),
            });
        }

        let widget = record.get("widget").and_then(|v| v.as_str()).unwrap_or("");
        let start_name = record.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();

        let all_states_val = storage.find("widget-state-entity", json!({ "widget": widget })).await?;
        let all_states = all_states_val.as_array().cloned().unwrap_or_default();

        // Build transition graph: state_name -> [(target, event)]
        let mut transition_map: std::collections::HashMap<String, Vec<(String, String)>> = std::collections::HashMap::new();
        for s in &all_states {
            let s_name = s.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let edges = parse_transitions(s);
            transition_map.insert(s_name, edges);
        }

        // BFS from start state
        let mut visited = HashSet::new();
        let mut via = Vec::new();
        let mut queue = VecDeque::new();
        visited.insert(start_name.clone());
        queue.push_back(start_name.clone());

        while let Some(current) = queue.pop_front() {
            if let Some(edges) = transition_map.get(&current) {
                for (target, event) in edges {
                    if !visited.contains(target) {
                        visited.insert(target.clone());
                        queue.push_back(target.clone());
                        via.push(json!({
                            "from": current,
                            "to": target,
                            "event": event
                        }));
                    }
                }
            }
        }

        // Remove start state from reachable set
        visited.remove(&start_name);

        Ok(WidgetStateEntityReachableFromOutput::Ok {
            reachable: serde_json::to_string(&visited.into_iter().collect::<Vec<_>>())?,
            via: serde_json::to_string(&via)?,
        })
    }

    async fn unreachable_states(
        &self,
        input: WidgetStateEntityUnreachableStatesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetStateEntityUnreachableStatesOutput, Box<dyn std::error::Error>> {
        let widget = &input.widget;

        let all_states_val = storage.find("widget-state-entity", json!({ "widget": widget })).await?;
        let all_states = all_states_val.as_array().cloned().unwrap_or_default();

        if all_states.is_empty() {
            return Ok(WidgetStateEntityUnreachableStatesOutput::Ok {
                unreachable: "[]".to_string(),
            });
        }

        // Find the initial state
        let initial_state = all_states.iter().find(|s| {
            s.get("initial").and_then(|v| v.as_str()) == Some("true")
        });

        if initial_state.is_none() {
            let all_names: Vec<String> = all_states.iter()
                .filter_map(|s| s.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()))
                .collect();
            return Ok(WidgetStateEntityUnreachableStatesOutput::Ok {
                unreachable: serde_json::to_string(&all_names)?,
            });
        }

        let initial_name = initial_state.unwrap()
            .get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();

        // BFS from initial state
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        visited.insert(initial_name.clone());
        queue.push_back(initial_name);

        while let Some(current) = queue.pop_front() {
            if let Some(state_record) = all_states.iter().find(|s| {
                s.get("name").and_then(|v| v.as_str()) == Some(&current)
            }) {
                let edges = parse_transitions(state_record);
                for (target, _event) in edges {
                    if !visited.contains(&target) {
                        visited.insert(target.clone());
                        queue.push_back(target);
                    }
                }
            }
        }

        let unreachable: Vec<String> = all_states.iter()
            .filter_map(|s| {
                let name = s.get("name").and_then(|v| v.as_str())?;
                if visited.contains(name) { None } else { Some(name.to_string()) }
            })
            .collect();

        Ok(WidgetStateEntityUnreachableStatesOutput::Ok {
            unreachable: serde_json::to_string(&unreachable)?,
        })
    }

    async fn trace_event(
        &self,
        input: WidgetStateEntityTraceEventInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetStateEntityTraceEventOutput, Box<dyn std::error::Error>> {
        let widget = &input.widget;
        let event = &input.event;

        let all_states_val = storage.find("widget-state-entity", json!({ "widget": widget })).await?;
        let all_states = all_states_val.as_array().cloned().unwrap_or_default();

        if all_states.is_empty() {
            return Ok(WidgetStateEntityTraceEventOutput::Unhandled {
                in_states: "[]".to_string(),
            });
        }

        let mut paths = Vec::new();
        let mut unhandled_in = Vec::new();

        for s in &all_states {
            let s_name = s.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let trans_str = s.get("transitions")
                .and_then(|v| v.as_str())
                .unwrap_or("[]");
            let transitions: Vec<serde_json::Value> = serde_json::from_str(trans_str).unwrap_or_default();

            let matching: Vec<&serde_json::Value> = transitions.iter().filter(|t| {
                let t_event = t.get("event").or_else(|| t.get("on"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                t_event == event
            }).collect();

            if !matching.is_empty() {
                for t in matching {
                    let target = t.get("target").or_else(|| t.get("to"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let guard = t.get("guard");
                    paths.push(json!({
                        "from": s_name,
                        "to": target,
                        "guard": guard
                    }));
                }
            } else {
                unhandled_in.push(s_name.to_string());
            }
        }

        if paths.is_empty() {
            return Ok(WidgetStateEntityTraceEventOutput::Unhandled {
                in_states: serde_json::to_string(&unhandled_in)?,
            });
        }

        Ok(WidgetStateEntityTraceEventOutput::Ok {
            paths: serde_json::to_string(&paths)?,
        })
    }

    async fn get(
        &self,
        input: WidgetStateEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetStateEntityGetOutput, Box<dyn std::error::Error>> {
        let widget_state_id = &input.widget_state;

        let record = storage.get("widget-state-entity", widget_state_id).await?;
        if record.is_null() {
            return Ok(WidgetStateEntityGetOutput::Notfound);
        }

        let trans_str = record.get("transitions")
            .and_then(|v| v.as_str())
            .unwrap_or("[]");
        let transition_count: i64 = serde_json::from_str::<Vec<serde_json::Value>>(trans_str)
            .map(|v| v.len() as i64)
            .unwrap_or(0);

        Ok(WidgetStateEntityGetOutput::Ok {
            widget_state: record.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            widget: record.get("widget").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            name: record.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            initial: record.get("initial").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            transition_count,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_success() {
        let storage = InMemoryStorage::new();
        let handler = WidgetStateEntityHandlerImpl;
        let result = handler.register(
            WidgetStateEntityRegisterInput {
                widget: "Button".to_string(),
                name: "idle".to_string(),
                initial: "true".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetStateEntityRegisterOutput::Ok { widget_state } => {
                assert!(!widget_state.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_get_success() {
        let storage = InMemoryStorage::new();
        let handler = WidgetStateEntityHandlerImpl;
        let reg = handler.register(
            WidgetStateEntityRegisterInput {
                widget: "Button".to_string(),
                name: "idle".to_string(),
                initial: "true".to_string(),
            },
            &storage,
        ).await.unwrap();
        let id = match reg {
            WidgetStateEntityRegisterOutput::Ok { widget_state } => widget_state,
        };
        let result = handler.get(
            WidgetStateEntityGetInput { widget_state: id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            WidgetStateEntityGetOutput::Ok { widget_state, widget, name, initial, transition_count } => {
                assert_eq!(widget_state, id);
                assert_eq!(widget, "Button");
                assert_eq!(name, "idle");
                assert_eq!(initial, "true");
                assert_eq!(transition_count, 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = WidgetStateEntityHandlerImpl;
        let result = handler.get(
            WidgetStateEntityGetInput { widget_state: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            WidgetStateEntityGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_trace_event_unhandled() {
        let storage = InMemoryStorage::new();
        let handler = WidgetStateEntityHandlerImpl;
        let result = handler.trace_event(
            WidgetStateEntityTraceEventInput {
                widget: "NonexistentWidget".to_string(),
                event: "click".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetStateEntityTraceEventOutput::Unhandled { .. } => {},
            _ => panic!("Expected Unhandled variant"),
        }
    }
}
