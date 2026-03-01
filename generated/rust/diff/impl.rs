// Diff Handler Implementation
//
// Compute minimal differences between two content states using
// LCS-based line diff. Supports pluggable algorithms, patch
// application, and provider registration.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DiffHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("diff-{}", id)
}

/// LCS-based line diff producing an edit script and edit distance.
fn compute_line_diff(a: &str, b: &str) -> (String, i64) {
    let lines_a: Vec<&str> = a.split('\n').collect();
    let lines_b: Vec<&str> = b.split('\n').collect();
    let m = lines_a.len();
    let n = lines_b.len();

    // Build LCS table
    let mut dp = vec![vec![0usize; n + 1]; m + 1];
    for i in 1..=m {
        for j in 1..=n {
            if lines_a[i - 1] == lines_b[j - 1] {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
            }
        }
    }

    // Backtrack to produce edit operations
    let mut edit_ops = Vec::new();
    let mut i = m;
    let mut j = n;
    let mut distance: i64 = 0;

    while i > 0 || j > 0 {
        if i > 0 && j > 0 && lines_a[i - 1] == lines_b[j - 1] {
            edit_ops.push(json!({"type": "equal", "line": i - 1, "content": lines_a[i - 1]}));
            i -= 1;
            j -= 1;
        } else if j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) {
            edit_ops.push(json!({"type": "insert", "line": j - 1, "content": lines_b[j - 1]}));
            distance += 1;
            j -= 1;
        } else if i > 0 {
            edit_ops.push(json!({"type": "delete", "line": i - 1, "content": lines_a[i - 1]}));
            distance += 1;
            i -= 1;
        }
    }

    edit_ops.reverse();
    (serde_json::to_string(&edit_ops).unwrap_or_default(), distance)
}

/// Apply an edit script to content.
fn apply_edit_script(content: &str, edit_script: &str) -> Option<String> {
    let ops: Vec<serde_json::Value> = serde_json::from_str(edit_script).ok()?;
    let mut result_lines = Vec::new();

    for op in &ops {
        let op_type = op.get("type")?.as_str()?;
        let op_content = op.get("content")?.as_str()?;
        match op_type {
            "equal" | "insert" => result_lines.push(op_content.to_string()),
            "delete" => {} // Skip deleted lines
            _ => {}
        }
    }

    Some(result_lines.join("\n"))
}

pub struct DiffHandlerImpl;

#[async_trait]
impl DiffHandler for DiffHandlerImpl {
    async fn register_provider(
        &self,
        input: DiffRegisterProviderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DiffRegisterProviderOutput, Box<dyn std::error::Error>> {
        let existing = storage.find("diff-provider", Some(&json!({"name": input.name}))).await?;
        if !existing.is_empty() {
            return Ok(DiffRegisterProviderOutput::Duplicate {
                message: format!("A provider with name '{}' already exists", input.name),
            });
        }

        let id = next_id();
        storage.put("diff-provider", &id, json!({
            "id": id,
            "name": input.name,
            "contentTypes": input.content_types,
        })).await?;

        Ok(DiffRegisterProviderOutput::Ok {
            provider: json!(id),
        })
    }

    async fn diff(
        &self,
        input: DiffDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DiffDiffOutput, Box<dyn std::error::Error>> {
        if input.content_a == input.content_b {
            return Ok(DiffDiffOutput::Identical);
        }

        // If algorithm specified, verify provider exists
        if let Some(ref algorithm) = input.algorithm {
            if !algorithm.is_empty() {
                let providers = storage.find("diff-provider", Some(&json!({"name": algorithm}))).await?;
                if providers.is_empty() {
                    return Ok(DiffDiffOutput::NoProvider {
                        message: format!("No registered provider handles algorithm '{}'", algorithm),
                    });
                }
            }
        }

        let (edit_script, distance) = compute_line_diff(&input.content_a, &input.content_b);

        // Cache result
        let cache_id = next_id();
        storage.put("diff-cache", &cache_id, json!({
            "id": cache_id,
            "contentA": input.content_a,
            "contentB": input.content_b,
            "editScript": edit_script,
            "distance": distance,
        })).await?;

        Ok(DiffDiffOutput::Diffed {
            edit_script: edit_script.into_bytes(),
            distance,
        })
    }

    async fn patch(
        &self,
        input: DiffPatchInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<DiffPatchOutput, Box<dyn std::error::Error>> {
        let edit_script_str = String::from_utf8(input.edit_script)?;
        match apply_edit_script(&input.content, &edit_script_str) {
            Some(result) => Ok(DiffPatchOutput::Ok { result }),
            None => Ok(DiffPatchOutput::Incompatible {
                message: "Edit script does not apply cleanly to this content".to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_provider() {
        let storage = InMemoryStorage::new();
        let handler = DiffHandlerImpl;
        let result = handler.register_provider(
            DiffRegisterProviderInput {
                name: "lcs".to_string(),
                content_types: vec!["text".to_string()],
            },
            &storage,
        ).await.unwrap();
        match result {
            DiffRegisterProviderOutput::Ok { provider } => {
                assert!(!provider.is_null());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_provider_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = DiffHandlerImpl;
        handler.register_provider(
            DiffRegisterProviderInput {
                name: "lcs".to_string(),
                content_types: vec!["text".to_string()],
            },
            &storage,
        ).await.unwrap();
        let result = handler.register_provider(
            DiffRegisterProviderInput {
                name: "lcs".to_string(),
                content_types: vec!["text".to_string()],
            },
            &storage,
        ).await.unwrap();
        match result {
            DiffRegisterProviderOutput::Duplicate { .. } => {},
            _ => panic!("Expected Duplicate variant"),
        }
    }

    #[tokio::test]
    async fn test_diff_identical() {
        let storage = InMemoryStorage::new();
        let handler = DiffHandlerImpl;
        let result = handler.diff(
            DiffDiffInput {
                content_a: "hello\nworld".to_string(),
                content_b: "hello\nworld".to_string(),
                algorithm: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            DiffDiffOutput::Identical => {},
            _ => panic!("Expected Identical variant"),
        }
    }

    #[tokio::test]
    async fn test_diff_different() {
        let storage = InMemoryStorage::new();
        let handler = DiffHandlerImpl;
        let result = handler.diff(
            DiffDiffInput {
                content_a: "hello\nworld".to_string(),
                content_b: "hello\nrust".to_string(),
                algorithm: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            DiffDiffOutput::Diffed { distance, .. } => {
                assert!(distance > 0);
            },
            _ => panic!("Expected Diffed variant"),
        }
    }
}
