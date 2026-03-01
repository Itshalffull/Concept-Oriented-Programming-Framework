// Three-way merge implementation
// Combines two divergent versions sharing a common ancestor.
// Performs line-level three-way merge, identifies conflicts,
// allows per-conflict resolution, and finalizes the merge.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::MergeHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

pub struct MergeHandlerImpl;

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    format!("merge-{}", ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1)
}

#[derive(Clone)]
struct ConflictRegion {
    region: String,
    ours_content: String,
    theirs_content: String,
    status: String,
    resolution: Option<String>,
}

/// Simple three-way line merge
fn three_way_merge(base: &str, ours: &str, theirs: &str) -> (Option<String>, Vec<ConflictRegion>) {
    let base_lines: Vec<&str> = base.split('\n').collect();
    let our_lines: Vec<&str> = ours.split('\n').collect();
    let their_lines: Vec<&str> = theirs.split('\n').collect();
    let mut conflicts = Vec::new();
    let mut result_lines = Vec::new();

    let max_len = base_lines.len().max(our_lines.len()).max(their_lines.len());

    for i in 0..max_len {
        let base_line = base_lines.get(i).copied();
        let our_line = our_lines.get(i).copied();
        let their_line = their_lines.get(i).copied();

        if our_line == their_line {
            if let Some(line) = our_line {
                result_lines.push(line.to_string());
            }
        } else if our_line == base_line {
            if let Some(line) = their_line {
                result_lines.push(line.to_string());
            }
        } else if their_line == base_line {
            if let Some(line) = our_line {
                result_lines.push(line.to_string());
            }
        } else {
            // Both changed differently -- conflict
            conflicts.push(ConflictRegion {
                region: format!("line {}", i + 1),
                ours_content: our_line.unwrap_or("").to_string(),
                theirs_content: their_line.unwrap_or("").to_string(),
                status: "unresolved".to_string(),
                resolution: None,
            });
            result_lines.push("<<<<<<< ours".to_string());
            if let Some(line) = our_line { result_lines.push(line.to_string()); }
            result_lines.push("=======".to_string());
            if let Some(line) = their_line { result_lines.push(line.to_string()); }
            result_lines.push(">>>>>>> theirs".to_string());
        }
    }

    if conflicts.is_empty() {
        (Some(result_lines.join("\n")), Vec::new())
    } else {
        (None, conflicts)
    }
}

#[async_trait]
impl MergeHandler for MergeHandlerImpl {
    async fn register_strategy(
        &self,
        input: MergeRegisterStrategyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MergeRegisterStrategyOutput, Box<dyn std::error::Error>> {
        let existing = storage.find("merge-strategy", Some(&json!({ "name": input.name }))).await?;
        if !existing.is_empty() {
            return Ok(MergeRegisterStrategyOutput::Duplicate {
                message: format!("Strategy '{}' already registered", input.name),
            });
        }

        let id = next_id();
        storage.put("merge-strategy", &id, json!({
            "id": id,
            "name": input.name,
            "contentTypes": input.content_types,
        })).await?;

        Ok(MergeRegisterStrategyOutput::Ok { strategy: json!(id) })
    }

    async fn merge(
        &self,
        input: MergeMergeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MergeMergeOutput, Box<dyn std::error::Error>> {
        // If strategy specified, verify it exists
        if let Some(ref strategy) = input.strategy {
            let strategies = storage.find("merge-strategy", Some(&json!({ "name": strategy }))).await?;
            if strategies.is_empty() {
                return Ok(MergeMergeOutput::NoStrategy {
                    message: format!("No strategy registered for '{}'", strategy),
                });
            }
        }

        let (result, conflicts) = three_way_merge(&input.base, &input.ours, &input.theirs);

        if let Some(result) = result {
            return Ok(MergeMergeOutput::Clean { result });
        }

        let merge_id = next_id();
        let conflicts_json: Vec<serde_json::Value> = conflicts.iter()
            .map(|c| json!({
                "region": c.region,
                "oursContent": c.ours_content,
                "theirsContent": c.theirs_content,
                "status": c.status,
            }))
            .collect();

        storage.put("merge-active", &merge_id, json!({
            "id": merge_id,
            "base": input.base,
            "ours": input.ours,
            "theirs": input.theirs,
            "conflicts": serde_json::to_string(&conflicts_json)?,
            "result": null,
        })).await?;

        Ok(MergeMergeOutput::Conflicts {
            merge_id: json!(merge_id),
            conflict_count: conflicts.len() as i64,
        })
    }

    async fn resolve_conflict(
        &self,
        input: MergeResolveConflictInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MergeResolveConflictOutput, Box<dyn std::error::Error>> {
        let merge_id = input.merge_id.as_str().unwrap_or("").to_string();

        let merge_record = match storage.get("merge-active", &merge_id).await? {
            Some(r) => r,
            None => return Ok(MergeResolveConflictOutput::InvalidIndex {
                message: format!("Merge '{}' not found", merge_id),
            }),
        };

        let conflicts_str = merge_record.get("conflicts")
            .and_then(|v| v.as_str())
            .unwrap_or("[]");
        let mut conflicts: Vec<serde_json::Value> = serde_json::from_str(conflicts_str)?;

        let idx = input.conflict_index as usize;
        if idx >= conflicts.len() {
            return Ok(MergeResolveConflictOutput::InvalidIndex {
                message: format!("Conflict index {} out of range [0, {}]", idx, conflicts.len().saturating_sub(1)),
            });
        }

        if conflicts[idx].get("status").and_then(|v| v.as_str()) == Some("resolved") {
            return Ok(MergeResolveConflictOutput::AlreadyResolved {
                message: format!("Conflict at index {} was already resolved", idx),
            });
        }

        if let Some(obj) = conflicts[idx].as_object_mut() {
            obj.insert("status".into(), json!("resolved"));
            let resolution_str = String::from_utf8_lossy(&input.resolution).to_string();
            obj.insert("resolution".into(), json!(resolution_str));
        }

        let remaining = conflicts.iter()
            .filter(|c| c.get("status").and_then(|v| v.as_str()) != Some("resolved"))
            .count() as i64;

        let mut updated = merge_record.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("conflicts".into(), json!(serde_json::to_string(&conflicts)?));
        }
        storage.put("merge-active", &merge_id, updated).await?;

        Ok(MergeResolveConflictOutput::Ok { remaining })
    }

    async fn finalize(
        &self,
        input: MergeFinalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MergeFinalizeOutput, Box<dyn std::error::Error>> {
        let merge_id = input.merge_id.as_str().unwrap_or("").to_string();

        let merge_record = match storage.get("merge-active", &merge_id).await? {
            Some(r) => r,
            None => return Ok(MergeFinalizeOutput::UnresolvedConflicts { count: 0 }),
        };

        let conflicts_str = merge_record.get("conflicts")
            .and_then(|v| v.as_str())
            .unwrap_or("[]");
        let conflicts: Vec<serde_json::Value> = serde_json::from_str(conflicts_str)?;

        let unresolved = conflicts.iter()
            .filter(|c| c.get("status").and_then(|v| v.as_str()) != Some("resolved"))
            .count() as i64;

        if unresolved > 0 {
            return Ok(MergeFinalizeOutput::UnresolvedConflicts { count: unresolved });
        }

        // Build final result by applying resolutions
        let base = merge_record.get("base").and_then(|v| v.as_str()).unwrap_or("");
        let ours = merge_record.get("ours").and_then(|v| v.as_str()).unwrap_or("");
        let theirs = merge_record.get("theirs").and_then(|v| v.as_str()).unwrap_or("");

        let base_lines: Vec<&str> = base.split('\n').collect();
        let our_lines: Vec<&str> = ours.split('\n').collect();
        let their_lines: Vec<&str> = theirs.split('\n').collect();
        let max_len = base_lines.len().max(our_lines.len()).max(their_lines.len());

        let mut result_lines = Vec::new();
        let mut conflict_idx = 0;

        for i in 0..max_len {
            let base_line = base_lines.get(i).copied();
            let our_line = our_lines.get(i).copied();
            let their_line = their_lines.get(i).copied();

            if our_line == their_line {
                if let Some(line) = our_line { result_lines.push(line.to_string()); }
            } else if our_line == base_line {
                if let Some(line) = their_line { result_lines.push(line.to_string()); }
            } else if their_line == base_line {
                if let Some(line) = our_line { result_lines.push(line.to_string()); }
            } else {
                if let Some(c) = conflicts.get(conflict_idx) {
                    if let Some(resolution) = c.get("resolution").and_then(|v| v.as_str()) {
                        result_lines.push(resolution.to_string());
                    }
                }
                conflict_idx += 1;
            }
        }

        let result = result_lines.join("\n");
        storage.del("merge-active", &merge_id).await?;

        Ok(MergeFinalizeOutput::Ok { result })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_strategy() {
        let storage = InMemoryStorage::new();
        let handler = MergeHandlerImpl;
        let result = handler.register_strategy(
            MergeRegisterStrategyInput { name: "text-merge".into(), content_types: vec!["text/plain".into()] },
            &storage,
        ).await.unwrap();
        match result {
            MergeRegisterStrategyOutput::Ok { .. } => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_strategy_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = MergeHandlerImpl;
        handler.register_strategy(
            MergeRegisterStrategyInput { name: "text-merge".into(), content_types: vec!["text/plain".into()] },
            &storage,
        ).await.unwrap();
        let result = handler.register_strategy(
            MergeRegisterStrategyInput { name: "text-merge".into(), content_types: vec!["text/plain".into()] },
            &storage,
        ).await.unwrap();
        match result {
            MergeRegisterStrategyOutput::Duplicate { .. } => {}
            _ => panic!("Expected Duplicate variant"),
        }
    }

    #[tokio::test]
    async fn test_merge_clean() {
        let storage = InMemoryStorage::new();
        let handler = MergeHandlerImpl;
        let result = handler.merge(
            MergeMergeInput {
                base: "line1\nline2\nline3".into(),
                ours: "line1\nmodified\nline3".into(),
                theirs: "line1\nline2\nline3".into(),
                strategy: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            MergeMergeOutput::Clean { result } => {
                assert!(result.contains("modified"));
            }
            _ => panic!("Expected Clean variant"),
        }
    }

    #[tokio::test]
    async fn test_merge_conflicts() {
        let storage = InMemoryStorage::new();
        let handler = MergeHandlerImpl;
        let result = handler.merge(
            MergeMergeInput {
                base: "line1".into(),
                ours: "ours_change".into(),
                theirs: "theirs_change".into(),
                strategy: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            MergeMergeOutput::Conflicts { conflict_count, .. } => {
                assert!(conflict_count > 0);
            }
            _ => panic!("Expected Conflicts variant"),
        }
    }

    #[tokio::test]
    async fn test_merge_no_strategy() {
        let storage = InMemoryStorage::new();
        let handler = MergeHandlerImpl;
        let result = handler.merge(
            MergeMergeInput {
                base: "a".into(),
                ours: "a".into(),
                theirs: "a".into(),
                strategy: Some("nonexistent".into()),
            },
            &storage,
        ).await.unwrap();
        match result {
            MergeMergeOutput::NoStrategy { .. } => {}
            _ => panic!("Expected NoStrategy variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_conflict_invalid_index() {
        let storage = InMemoryStorage::new();
        let handler = MergeHandlerImpl;
        let result = handler.resolve_conflict(
            MergeResolveConflictInput {
                merge_id: json!("nonexistent"),
                conflict_index: 0,
                resolution: b"fix".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            MergeResolveConflictOutput::InvalidIndex { .. } => {}
            _ => panic!("Expected InvalidIndex variant"),
        }
    }
}
