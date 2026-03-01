// Patch concept implementation
// Represent changes as first-class, invertible, composable patch objects.
// Patches can be applied, inverted, composed sequentially, and commuted when independent.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::PatchHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);
fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("patch-{}", id)
}

pub struct PatchHandlerImpl;

/// Apply an edit script to content. Returns result lines joined by newline.
fn apply_effect(content: &str, effect_str: &str) -> Option<String> {
    let ops: Vec<serde_json::Value> = serde_json::from_str(effect_str).ok()?;
    let mut result_lines = Vec::new();

    for op in &ops {
        let op_type = op["type"].as_str().unwrap_or("");
        let op_content = op["content"].as_str().unwrap_or("");
        match op_type {
            "equal" | "insert" => result_lines.push(op_content.to_string()),
            "delete" => {} // skip deleted lines
            _ => {}
        }
    }

    Some(result_lines.join("\n"))
}

/// Invert an edit script: swap insert and delete operations
fn invert_effect(effect_str: &str) -> Option<String> {
    let ops: Vec<serde_json::Value> = serde_json::from_str(effect_str).ok()?;
    let inverted: Vec<serde_json::Value> = ops.iter().map(|op| {
        let op_type = op["type"].as_str().unwrap_or("");
        let new_type = match op_type {
            "insert" => "delete",
            "delete" => "insert",
            other => other,
        };
        let mut new_op = op.clone();
        new_op["type"] = json!(new_type);
        new_op
    }).collect();
    serde_json::to_string(&inverted).ok()
}

/// Check if two edit scripts affect overlapping line regions
fn check_overlap(effect1: &str, effect2: &str) -> bool {
    let ops1: Vec<serde_json::Value> = match serde_json::from_str(effect1) {
        Ok(v) => v,
        Err(_) => return true,
    };
    let ops2: Vec<serde_json::Value> = match serde_json::from_str(effect2) {
        Ok(v) => v,
        Err(_) => return true,
    };

    let modified1: std::collections::HashSet<i64> = ops1.iter()
        .filter(|op| op["type"].as_str().unwrap_or("") != "equal")
        .filter_map(|op| op["line"].as_i64())
        .collect();
    let modified2: std::collections::HashSet<i64> = ops2.iter()
        .filter(|op| op["type"].as_str().unwrap_or("") != "equal")
        .filter_map(|op| op["line"].as_i64())
        .collect();

    modified1.intersection(&modified2).next().is_some()
}

#[async_trait]
impl PatchHandler for PatchHandlerImpl {
    async fn create(
        &self,
        input: PatchCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatchCreateOutput, Box<dyn std::error::Error>> {
        let effect_str = String::from_utf8_lossy(&input.effect).to_string();

        // Validate effect is parseable JSON
        if serde_json::from_str::<serde_json::Value>(&effect_str).is_err() {
            return Ok(PatchCreateOutput::InvalidEffect {
                message: "Effect bytes are not a valid edit script (must be JSON)".to_string(),
            });
        }

        let id = next_id();
        storage.put("patch", &id, json!({
            "id": id,
            "base": input.base,
            "target": input.target,
            "effect": effect_str,
            "dependencies": []
        })).await?;

        Ok(PatchCreateOutput::Ok { patch_id: id })
    }

    async fn apply(
        &self,
        input: PatchApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatchApplyOutput, Box<dyn std::error::Error>> {
        let record = match storage.get("patch", &input.patch_id).await? {
            Some(r) => r,
            None => return Ok(PatchApplyOutput::NotFound {
                message: format!("Patch '{}' not found", input.patch_id),
            }),
        };

        let effect = record["effect"].as_str().unwrap_or("[]");
        let content_str = String::from_utf8_lossy(&input.content).to_string();

        match apply_effect(&content_str, effect) {
            Some(result) => Ok(PatchApplyOutput::Ok { result: result.into_bytes() }),
            None => Ok(PatchApplyOutput::IncompatibleContext {
                message: "Content does not match patch base context. Cannot apply.".to_string(),
            }),
        }
    }

    async fn invert(
        &self,
        input: PatchInvertInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatchInvertOutput, Box<dyn std::error::Error>> {
        let record = match storage.get("patch", &input.patch_id).await? {
            Some(r) => r,
            None => return Ok(PatchInvertOutput::NotFound {
                message: format!("Patch '{}' not found", input.patch_id),
            }),
        };

        let effect = record["effect"].as_str().unwrap_or("[]");
        let inverted = match invert_effect(effect) {
            Some(e) => e,
            None => return Ok(PatchInvertOutput::NotFound {
                message: "Failed to invert patch effect".to_string(),
            }),
        };

        let inverse_id = next_id();
        storage.put("patch", &inverse_id, json!({
            "id": inverse_id,
            "base": record["target"],
            "target": record["base"],
            "effect": inverted,
            "dependencies": [input.patch_id]
        })).await?;

        Ok(PatchInvertOutput::Ok { inverse_patch_id: inverse_id })
    }

    async fn compose(
        &self,
        input: PatchComposeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatchComposeOutput, Box<dyn std::error::Error>> {
        let first_record = match storage.get("patch", &input.first).await? {
            Some(r) => r,
            None => return Ok(PatchComposeOutput::NotFound {
                message: format!("Patch '{}' not found", input.first),
            }),
        };

        let second_record = match storage.get("patch", &input.second).await? {
            Some(r) => r,
            None => return Ok(PatchComposeOutput::NotFound {
                message: format!("Patch '{}' not found", input.second),
            }),
        };

        // Check sequential: first.target must equal second.base
        let first_target = first_record["target"].as_str().unwrap_or("");
        let second_base = second_record["base"].as_str().unwrap_or("");
        if first_target != second_base {
            return Ok(PatchComposeOutput::NonSequential {
                message: format!(
                    "first.target ('{}') does not equal second.base ('{}').",
                    first_target, second_base
                ),
            });
        }

        // Compose: the result patch goes from first.base to second.target
        // with the second effect (simplified composition)
        let composed_id = next_id();
        storage.put("patch", &composed_id, json!({
            "id": composed_id,
            "base": first_record["base"],
            "target": second_record["target"],
            "effect": second_record["effect"],
            "dependencies": [input.first, input.second]
        })).await?;

        Ok(PatchComposeOutput::Ok { composed_id })
    }

    async fn commute(
        &self,
        input: PatchCommuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatchCommuteOutput, Box<dyn std::error::Error>> {
        let p1_record = match storage.get("patch", &input.p1).await? {
            Some(r) => r,
            None => return Ok(PatchCommuteOutput::NotFound {
                message: format!("Patch '{}' not found", input.p1),
            }),
        };

        let p2_record = match storage.get("patch", &input.p2).await? {
            Some(r) => r,
            None => return Ok(PatchCommuteOutput::NotFound {
                message: format!("Patch '{}' not found", input.p2),
            }),
        };

        let p1_effect = p1_record["effect"].as_str().unwrap_or("[]");
        let p2_effect = p2_record["effect"].as_str().unwrap_or("[]");

        if check_overlap(p1_effect, p2_effect) {
            return Ok(PatchCommuteOutput::CannotCommute {
                message: "Patches affect overlapping regions. Commutativity impossible.".to_string(),
            });
        }

        // For non-overlapping patches, commuted versions swap ordering context
        let p1_prime_id = next_id();
        let p2_prime_id = next_id();

        storage.put("patch", &p2_prime_id, json!({
            "id": p2_prime_id,
            "base": p1_record["base"],
            "target": p2_record["target"],
            "effect": p2_effect,
            "dependencies": [input.p2]
        })).await?;

        storage.put("patch", &p1_prime_id, json!({
            "id": p1_prime_id,
            "base": p2_record["base"],
            "target": p1_record["target"],
            "effect": p1_effect,
            "dependencies": [input.p1]
        })).await?;

        Ok(PatchCommuteOutput::Ok {
            p1_prime: p1_prime_id,
            p2_prime: p2_prime_id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_patch() {
        let storage = InMemoryStorage::new();
        let handler = PatchHandlerImpl;
        let effect = r#"[{"type":"equal","content":"line1","line":0}]"#;
        let result = handler.create(
            PatchCreateInput {
                base: "v1".to_string(),
                target: "v2".to_string(),
                effect: effect.as_bytes().to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PatchCreateOutput::Ok { patch_id } => assert!(!patch_id.is_empty()),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_patch_invalid_effect() {
        let storage = InMemoryStorage::new();
        let handler = PatchHandlerImpl;
        let result = handler.create(
            PatchCreateInput {
                base: "v1".to_string(),
                target: "v2".to_string(),
                effect: b"not-json".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PatchCreateOutput::InvalidEffect { .. } => {}
            _ => panic!("Expected InvalidEffect variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_patch() {
        let storage = InMemoryStorage::new();
        let handler = PatchHandlerImpl;
        let effect = r#"[{"type":"equal","content":"hello","line":0},{"type":"insert","content":"world","line":1}]"#;
        let create_result = handler.create(
            PatchCreateInput {
                base: "v1".to_string(),
                target: "v2".to_string(),
                effect: effect.as_bytes().to_vec(),
            },
            &storage,
        ).await.unwrap();
        let patch_id = match create_result {
            PatchCreateOutput::Ok { patch_id } => patch_id,
            _ => panic!("Expected Ok"),
        };
        let result = handler.apply(
            PatchApplyInput { patch_id, content: b"hello".to_vec() },
            &storage,
        ).await.unwrap();
        match result {
            PatchApplyOutput::Ok { result } => {
                let s = String::from_utf8(result).unwrap();
                assert!(s.contains("hello"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_patch_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PatchHandlerImpl;
        let result = handler.apply(
            PatchApplyInput { patch_id: "nonexistent".to_string(), content: b"test".to_vec() },
            &storage,
        ).await.unwrap();
        match result {
            PatchApplyOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_invert_patch() {
        let storage = InMemoryStorage::new();
        let handler = PatchHandlerImpl;
        let effect = r#"[{"type":"insert","content":"added","line":0}]"#;
        let create_result = handler.create(
            PatchCreateInput {
                base: "v1".to_string(),
                target: "v2".to_string(),
                effect: effect.as_bytes().to_vec(),
            },
            &storage,
        ).await.unwrap();
        let patch_id = match create_result {
            PatchCreateOutput::Ok { patch_id } => patch_id,
            _ => panic!("Expected Ok"),
        };
        let result = handler.invert(
            PatchInvertInput { patch_id },
            &storage,
        ).await.unwrap();
        match result {
            PatchInvertOutput::Ok { inverse_patch_id } => assert!(!inverse_patch_id.is_empty()),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_compose_non_sequential() {
        let storage = InMemoryStorage::new();
        let handler = PatchHandlerImpl;
        let effect1 = r#"[{"type":"equal","content":"a","line":0}]"#;
        let effect2 = r#"[{"type":"equal","content":"b","line":0}]"#;
        let p1 = match handler.create(PatchCreateInput { base: "v1".to_string(), target: "v2".to_string(), effect: effect1.as_bytes().to_vec() }, &storage).await.unwrap() {
            PatchCreateOutput::Ok { patch_id } => patch_id, _ => panic!(""),
        };
        let p2 = match handler.create(PatchCreateInput { base: "v3".to_string(), target: "v4".to_string(), effect: effect2.as_bytes().to_vec() }, &storage).await.unwrap() {
            PatchCreateOutput::Ok { patch_id } => patch_id, _ => panic!(""),
        };
        let result = handler.compose(
            PatchComposeInput { first: p1, second: p2 },
            &storage,
        ).await.unwrap();
        match result {
            PatchComposeOutput::NonSequential { .. } => {}
            _ => panic!("Expected NonSequential variant"),
        }
    }
}
