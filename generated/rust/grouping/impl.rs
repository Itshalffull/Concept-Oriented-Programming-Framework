// Grouping concept implementation
// Action classification and item grouping by CRUD role, intent, event type, and MCP type strategies.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::GroupingHandler;
use serde_json::json;
use std::collections::HashMap;

pub struct GroupingHandlerImpl;

/// Classify an action name into its CRUD role
fn classify_crud(action_name: &str) -> &'static str {
    let lower = action_name.to_lowercase();
    if lower.starts_with("create") || lower.starts_with("add") || lower.starts_with("register")
        || lower.starts_with("insert") || lower.starts_with("new") || lower.starts_with("init")
        || lower.starts_with("provision") || lower.starts_with("emit") || lower.starts_with("define")
    {
        "create"
    } else if lower.starts_with("get") || lower.starts_with("list") || lower.starts_with("find")
        || lower.starts_with("search") || lower.starts_with("query") || lower.starts_with("read")
        || lower.starts_with("fetch") || lower.starts_with("check") || lower.starts_with("discover")
        || lower.starts_with("verify") || lower.starts_with("status") || lower.starts_with("inspect")
    {
        "read"
    } else if lower.starts_with("update") || lower.starts_with("set") || lower.starts_with("assign")
        || lower.starts_with("modify") || lower.starts_with("edit") || lower.starts_with("patch")
        || lower.starts_with("rename") || lower.starts_with("toggle") || lower.starts_with("configure")
    {
        "update"
    } else if lower.starts_with("delete") || lower.starts_with("remove") || lower.starts_with("destroy")
        || lower.starts_with("teardown") || lower.starts_with("revoke") || lower.starts_with("purge")
        || lower.starts_with("drop") || lower.starts_with("unregister") || lower.starts_with("unmount")
    {
        "delete"
    } else {
        "action"
    }
}

/// Classify the intent of an action
fn classify_intent(action_name: &str) -> &'static str {
    let lower = action_name.to_lowercase();
    if lower.contains("validate") || lower.contains("verify") || lower.contains("check") || lower.contains("lint") {
        "validation"
    } else if lower.contains("transform") || lower.contains("normalize") || lower.contains("convert")
        || lower.contains("parse") || lower.contains("compile")
    {
        "transformation"
    } else if lower.contains("deploy") || lower.contains("provision") || lower.contains("emit")
        || lower.contains("apply") || lower.contains("generate")
    {
        "provisioning"
    } else if lower.contains("query") || lower.contains("search") || lower.contains("find")
        || lower.contains("discover") || lower.contains("list") || lower.contains("get")
    {
        "retrieval"
    } else if lower.contains("subscribe") || lower.contains("watch") || lower.contains("listen")
        || lower.contains("follow")
    {
        "subscription"
    } else if lower.contains("auth") || lower.contains("login") || lower.contains("grant")
        || lower.contains("revoke") || lower.contains("permission")
    {
        "authorization"
    } else {
        "mutation"
    }
}

/// Determine if the action produces events and what the event verb is
fn classify_event(action_name: &str) -> (bool, &'static str) {
    let lower = action_name.to_lowercase();
    if lower.starts_with("create") || lower.starts_with("add") || lower.starts_with("register") {
        (true, "created")
    } else if lower.starts_with("update") || lower.starts_with("set") || lower.starts_with("assign") {
        (true, "updated")
    } else if lower.starts_with("delete") || lower.starts_with("remove") || lower.starts_with("destroy") {
        (true, "deleted")
    } else if lower.starts_with("deploy") || lower.starts_with("provision") {
        (true, "provisioned")
    } else if lower.starts_with("get") || lower.starts_with("list") || lower.starts_with("find")
        || lower.starts_with("check") || lower.starts_with("verify")
    {
        (false, "none")
    } else {
        (true, "changed")
    }
}

/// Classify the MCP (Model Context Protocol) operation type
fn classify_mcp_type(action_name: &str) -> &'static str {
    let crud = classify_crud(action_name);
    match crud {
        "create" => "tool",
        "read" => "resource",
        "update" => "tool",
        "delete" => "tool",
        _ => "tool",
    }
}

#[async_trait]
impl GroupingHandler for GroupingHandlerImpl {
    async fn group(
        &self,
        input: GroupingGroupInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GroupingGroupOutput, Box<dyn std::error::Error>> {
        if input.items.is_empty() {
            return Ok(GroupingGroupOutput::EmptyInput);
        }

        let config: serde_json::Value = match serde_json::from_str(&input.config) {
            Ok(v) => v,
            Err(_) => json!({"strategy": "by-crud"}),
        };

        let strategy = config.get("strategy")
            .and_then(|v| v.as_str())
            .unwrap_or("by-crud");

        let mut groups: HashMap<String, Vec<String>> = HashMap::new();

        match strategy {
            "by-crud" => {
                for item in &input.items {
                    let role = classify_crud(item);
                    groups.entry(role.to_string()).or_default().push(item.clone());
                }
            }
            "by-intent" => {
                for item in &input.items {
                    let intent = classify_intent(item);
                    groups.entry(intent.to_string()).or_default().push(item.clone());
                }
            }
            "by-event" => {
                for item in &input.items {
                    let (produces, verb) = classify_event(item);
                    let key = if produces { verb.to_string() } else { "no-event".to_string() };
                    groups.entry(key).or_default().push(item.clone());
                }
            }
            "by-mcp-type" => {
                for item in &input.items {
                    let mcp_type = classify_mcp_type(item);
                    groups.entry(mcp_type.to_string()).or_default().push(item.clone());
                }
            }
            "per-concept" => {
                // Each item goes into its own group based on concept prefix
                for item in &input.items {
                    let concept = item.split('.').next()
                        .or_else(|| item.split('/').next())
                        .unwrap_or(item);
                    groups.entry(concept.to_string()).or_default().push(item.clone());
                }
            }
            _ => {
                return Ok(GroupingGroupOutput::InvalidStrategy {
                    strategy: strategy.to_string(),
                });
            }
        }

        let group_count = groups.len() as i64;
        let group_names: Vec<String> = groups.keys().cloned().collect();
        let grouping = serde_json::to_string(&groups)?;

        // Store the grouping result
        let grouping_id = format!("grouping-{}", chrono::Utc::now().timestamp_millis());
        storage.put("grouping", &grouping_id, json!({
            "grouping": grouping_id,
            "strategy": strategy,
            "groups": grouping,
            "groupCount": group_count,
        })).await?;

        Ok(GroupingGroupOutput::Ok {
            grouping,
            groups: group_names,
            group_count,
        })
    }

    async fn classify(
        &self,
        input: GroupingClassifyInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<GroupingClassifyOutput, Box<dyn std::error::Error>> {
        let crud_role = classify_crud(&input.action_name).to_string();
        let intent = classify_intent(&input.action_name).to_string();
        let (event_producing, event_verb_str) = classify_event(&input.action_name);
        let event_verb = event_verb_str.to_string();
        let mcp_type = classify_mcp_type(&input.action_name).to_string();

        Ok(GroupingClassifyOutput::Ok {
            crud_role,
            intent,
            event_producing,
            event_verb,
            mcp_type,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_group_by_crud() {
        let storage = InMemoryStorage::new();
        let handler = GroupingHandlerImpl;
        let result = handler.group(
            GroupingGroupInput {
                items: vec!["createUser".to_string(), "getProfile".to_string(), "deleteAccount".to_string()],
                config: r#"{"strategy":"by-crud"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GroupingGroupOutput::Ok { group_count, .. } => {
                assert!(group_count >= 2);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_group_empty_input() {
        let storage = InMemoryStorage::new();
        let handler = GroupingHandlerImpl;
        let result = handler.group(
            GroupingGroupInput {
                items: vec![],
                config: r#"{"strategy":"by-crud"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GroupingGroupOutput::EmptyInput => {},
            _ => panic!("Expected EmptyInput variant"),
        }
    }

    #[tokio::test]
    async fn test_group_invalid_strategy() {
        let storage = InMemoryStorage::new();
        let handler = GroupingHandlerImpl;
        let result = handler.group(
            GroupingGroupInput {
                items: vec!["createUser".to_string()],
                config: r#"{"strategy":"invalid"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GroupingGroupOutput::InvalidStrategy { strategy } => {
                assert_eq!(strategy, "invalid");
            },
            _ => panic!("Expected InvalidStrategy variant"),
        }
    }

    #[tokio::test]
    async fn test_classify_create() {
        let storage = InMemoryStorage::new();
        let handler = GroupingHandlerImpl;
        let result = handler.classify(
            GroupingClassifyInput { action_name: "createUser".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GroupingClassifyOutput::Ok { crud_role, .. } => {
                assert_eq!(crud_role, "create");
            },
        }
    }

    #[tokio::test]
    async fn test_classify_read() {
        let storage = InMemoryStorage::new();
        let handler = GroupingHandlerImpl;
        let result = handler.classify(
            GroupingClassifyInput { action_name: "getProfile".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GroupingClassifyOutput::Ok { crud_role, .. } => {
                assert_eq!(crud_role, "read");
            },
        }
    }
}
