// SyncEngine concept implementation
// Orchestrates reactive synchronizations between concepts.
// Registers compiled syncs, evaluates where-clauses, manages pending queues,
// handles concept availability changes, and drains conflict records.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SyncEngineHandler;
use serde_json::json;

pub struct SyncEngineHandlerImpl;

fn generate_id(prefix: &str) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}-{}-{}", prefix, t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl SyncEngineHandler for SyncEngineHandlerImpl {
    async fn register_sync(
        &self,
        input: SyncEngineRegisterSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEngineRegisterSyncOutput, Box<dyn std::error::Error>> {
        let sync = &input.sync;

        // Extract the sync name for keying
        let name = sync.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("unnamed")
            .to_string();

        // Store the registered sync in the engine's registry
        storage.put("registered_sync", &name, json!({
            "name": &name,
            "sync": sync,
            "registeredAt": generate_id("ts"),
            "status": "active",
        })).await?;

        // Index the when-clause trigger patterns for fast lookup
        if let Some(when) = sync.get("when").and_then(|v| v.as_array()) {
            for pattern in when {
                if let Some(concept) = pattern.get("concept").and_then(|v| v.as_str()) {
                    let action = pattern.get("action").and_then(|v| v.as_str()).unwrap_or("*");
                    let variant = pattern.get("variant").and_then(|v| v.as_str()).unwrap_or("*");
                    let trigger_key = format!("{}:{}:{}", concept, action, variant);
                    storage.put("sync_trigger", &trigger_key, json!({
                        "syncName": &name,
                        "concept": concept,
                        "action": action,
                        "variant": variant,
                    })).await?;
                }
            }
        }

        Ok(SyncEngineRegisterSyncOutput::Ok)
    }

    async fn on_completion(
        &self,
        input: SyncEngineOnCompletionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEngineOnCompletionOutput, Box<dyn std::error::Error>> {
        let completion = &input.completion;

        let concept = completion.get("concept")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let action = completion.get("action")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let variant = completion.get("variant")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // Look for registered syncs triggered by this completion
        let mut invocations = Vec::new();

        // Check exact match and wildcard triggers
        let trigger_keys = vec![
            format!("{}:{}:{}", concept, action, variant),
            format!("{}:{}:*", concept, action),
            format!("{}:*:*", concept),
        ];

        for trigger_key in &trigger_keys {
            if let Some(trigger) = storage.get("sync_trigger", trigger_key).await? {
                let sync_name = trigger.get("syncName")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                if let Some(sync_reg) = storage.get("registered_sync", sync_name).await? {
                    if let Some(sync_def) = sync_reg.get("sync") {
                        // Build invocations from the then-clause
                        if let Some(then_actions) = sync_def.get("then").and_then(|v| v.as_array()) {
                            for then_action in then_actions {
                                invocations.push(json!({
                                    "syncName": sync_name,
                                    "action": then_action,
                                    "bindings": completion.get("output").cloned().unwrap_or(json!({})),
                                }));
                            }
                        }
                    }
                }
            }
        }

        Ok(SyncEngineOnCompletionOutput::Ok { invocations })
    }

    async fn evaluate_where(
        &self,
        input: SyncEngineEvaluateWhereInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SyncEngineEvaluateWhereOutput, Box<dyn std::error::Error>> {
        let bindings = &input.bindings;
        let queries = &input.queries;
        let mut results = Vec::new();

        for query in queries {
            let query_type = query.get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");

            match query_type {
                "bind" => {
                    // A bind clause creates a new variable from an expression
                    let expr = query.get("expr").and_then(|v| v.as_str()).unwrap_or("");
                    let as_name = query.get("as").and_then(|v| v.as_str()).unwrap_or("");

                    // Resolve variable references in the expression
                    let value = if expr.starts_with('$') {
                        let var_name = &expr[1..];
                        bindings.get(var_name).cloned().unwrap_or(json!(null))
                    } else {
                        json!(expr)
                    };

                    results.push(json!({
                        "type": "bind",
                        "as": as_name,
                        "value": value,
                    }));
                }
                "query" => {
                    // A query clause invokes a concept action to fetch data
                    results.push(json!({
                        "type": "query",
                        "concept": query.get("concept"),
                        "action": query.get("action"),
                        "bindings": bindings,
                        "status": "pending",
                    }));
                }
                "guard" => {
                    // A guard clause evaluates a boolean condition
                    let condition = query.get("condition")
                        .and_then(|v| v.as_str())
                        .unwrap_or("true");
                    let pass = condition != "false";
                    results.push(json!({
                        "type": "guard",
                        "condition": condition,
                        "pass": pass,
                    }));
                }
                _ => {
                    return Ok(SyncEngineEvaluateWhereOutput::Error {
                        message: format!("Unknown where-clause type: {}", query_type),
                    });
                }
            }
        }

        Ok(SyncEngineEvaluateWhereOutput::Ok { results })
    }

    async fn queue_sync(
        &self,
        input: SyncEngineQueueSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEngineQueueSyncOutput, Box<dyn std::error::Error>> {
        let pending_id = generate_id("pending");

        storage.put("pending_sync", &pending_id, json!({
            "pendingId": &pending_id,
            "sync": &input.sync,
            "bindings": &input.bindings,
            "flow": &input.flow,
            "status": "queued",
            "queuedAt": generate_id("ts"),
        })).await?;

        Ok(SyncEngineQueueSyncOutput::Ok { pending_id })
    }

    async fn on_availability_change(
        &self,
        input: SyncEngineOnAvailabilityChangeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEngineOnAvailabilityChangeOutput, Box<dyn std::error::Error>> {
        let mut drained = Vec::new();

        if !input.available {
            // Concept went offline; nothing to drain
            return Ok(SyncEngineOnAvailabilityChangeOutput::Ok { drained });
        }

        // Concept became available; drain pending syncs targeting it
        let pending = storage.find("pending_sync", Some(&json!({
            "status": "queued",
        }))).await?;

        for p in &pending {
            // Check if this pending sync references the now-available concept
            let sync_val = p.get("sync");
            let targets_concept = if let Some(sv) = sync_val {
                let concept_ref = sv.get("concept")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                concept_ref == input.concept_uri
            } else {
                false
            };

            if targets_concept {
                let pending_id = p.get("pendingId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                // Mark as drained
                let mut updated = p.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("drained"));
                }
                storage.put("pending_sync", pending_id, updated).await?;

                drained.push(p.clone());
            }
        }

        Ok(SyncEngineOnAvailabilityChangeOutput::Ok { drained })
    }

    async fn drain_conflicts(
        &self,
        _input: SyncEngineDrainConflictsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEngineDrainConflictsOutput, Box<dyn std::error::Error>> {
        let conflicts = storage.find("sync_conflict", None).await?;
        let mut drained = Vec::new();

        for c in &conflicts {
            let conflict_id = c.get("conflictId")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            drained.push(c.clone());
            storage.del("sync_conflict", conflict_id).await?;
        }

        Ok(SyncEngineDrainConflictsOutput::Ok { conflicts: drained })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_sync() {
        let storage = InMemoryStorage::new();
        let handler = SyncEngineHandlerImpl;
        let result = handler.register_sync(
            SyncEngineRegisterSyncInput {
                sync: json!({
                    "name": "UserFollow",
                    "when": [{"concept": "User", "action": "follow", "variant": "ok"}],
                    "then": [{"concept": "Follow", "action": "create"}],
                }),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncEngineRegisterSyncOutput::Ok => {},
        }
    }

    #[tokio::test]
    async fn test_on_completion() {
        let storage = InMemoryStorage::new();
        let handler = SyncEngineHandlerImpl;
        let result = handler.on_completion(
            SyncEngineOnCompletionInput {
                completion: json!({
                    "concept": "User",
                    "action": "create",
                    "variant": "ok",
                    "output": {"userId": "123"},
                }),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncEngineOnCompletionOutput::Ok { invocations } => {
                // No registered syncs, so empty invocations
                assert!(invocations.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_evaluate_where_bind() {
        let storage = InMemoryStorage::new();
        let handler = SyncEngineHandlerImpl;
        let result = handler.evaluate_where(
            SyncEngineEvaluateWhereInput {
                bindings: json!({"userId": "123"}),
                queries: vec![json!({"type": "bind", "expr": "$userId", "as": "id"})],
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncEngineEvaluateWhereOutput::Ok { results } => {
                assert_eq!(results.len(), 1);
                assert_eq!(results[0]["type"].as_str().unwrap(), "bind");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_evaluate_where_unknown_type() {
        let storage = InMemoryStorage::new();
        let handler = SyncEngineHandlerImpl;
        let result = handler.evaluate_where(
            SyncEngineEvaluateWhereInput {
                bindings: json!({}),
                queries: vec![json!({"type": "invalid"})],
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncEngineEvaluateWhereOutput::Error { message } => {
                assert!(message.contains("Unknown where-clause type"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_queue_sync() {
        let storage = InMemoryStorage::new();
        let handler = SyncEngineHandlerImpl;
        let result = handler.queue_sync(
            SyncEngineQueueSyncInput {
                sync: json!({"name": "TestSync"}),
                bindings: json!({"key": "value"}),
                flow: "flow-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncEngineQueueSyncOutput::Ok { pending_id } => {
                assert!(pending_id.starts_with("pending-"));
            },
        }
    }

    #[tokio::test]
    async fn test_drain_conflicts_empty() {
        let storage = InMemoryStorage::new();
        let handler = SyncEngineHandlerImpl;
        let result = handler.drain_conflicts(
            SyncEngineDrainConflictsInput {},
            &storage,
        ).await.unwrap();
        match result {
            SyncEngineDrainConflictsOutput::Ok { conflicts } => {
                assert!(conflicts.is_empty());
            },
        }
    }
}
