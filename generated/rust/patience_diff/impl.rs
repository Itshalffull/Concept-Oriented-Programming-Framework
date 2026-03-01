// PatienceDiff concept implementation
// Compute diffs using the Patience diff algorithm. Aligns unique lines first
// for more human-readable diffs, then fills gaps with simple LCS diff.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::PatienceDiffHandler;
use serde_json::json;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);
fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("patience-diff-{}", id)
}

#[derive(Clone, serde::Serialize)]
struct EditOp {
    #[serde(rename = "type")]
    op_type: String,
    line: usize,
    content: String,
}

pub struct PatienceDiffHandlerImpl;

/// Find lines that appear exactly once and their positions
fn find_unique_lines(lines: &[&str]) -> HashMap<String, usize> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    let mut positions: HashMap<String, usize> = HashMap::new();
    for (i, line) in lines.iter().enumerate() {
        *counts.entry(line.to_string()).or_insert(0) += 1;
        positions.insert(line.to_string(), i);
    }
    counts.into_iter()
        .filter(|(_, count)| *count == 1)
        .map(|(line, _)| {
            let pos = positions[&line];
            (line, pos)
        })
        .collect()
}

/// Simple LCS-based diff for gap regions
fn simple_diff(lines_a: &[&str], lines_b: &[&str]) -> Vec<EditOp> {
    if lines_a.is_empty() && lines_b.is_empty() {
        return vec![];
    }
    if lines_a.is_empty() {
        return lines_b.iter().enumerate()
            .map(|(i, line)| EditOp { op_type: "insert".to_string(), line: i, content: line.to_string() })
            .collect();
    }
    if lines_b.is_empty() {
        return lines_a.iter().enumerate()
            .map(|(i, line)| EditOp { op_type: "delete".to_string(), line: i, content: line.to_string() })
            .collect();
    }

    let m = lines_a.len();
    let n = lines_b.len();
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

    let mut ops = Vec::new();
    let mut i = m;
    let mut j = n;
    while i > 0 || j > 0 {
        if i > 0 && j > 0 && lines_a[i - 1] == lines_b[j - 1] {
            ops.push(EditOp { op_type: "equal".to_string(), line: i - 1, content: lines_a[i - 1].to_string() });
            i -= 1;
            j -= 1;
        } else if j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) {
            ops.push(EditOp { op_type: "insert".to_string(), line: j - 1, content: lines_b[j - 1].to_string() });
            j -= 1;
        } else {
            ops.push(EditOp { op_type: "delete".to_string(), line: i - 1, content: lines_a[i - 1].to_string() });
            i -= 1;
        }
    }

    ops.reverse();
    ops
}

/// Patience diff: find unique common lines as anchors, diff gaps between them
fn patience_diff(lines_a: &[&str], lines_b: &[&str]) -> Vec<EditOp> {
    let unique_a = find_unique_lines(lines_a);
    let unique_b = find_unique_lines(lines_b);

    // Find matching unique lines
    let mut matches: Vec<(usize, usize)> = Vec::new();
    for (line, a_idx) in &unique_a {
        if let Some(b_idx) = unique_b.get(line) {
            matches.push((*a_idx, *b_idx));
        }
    }

    if matches.is_empty() {
        return simple_diff(lines_a, lines_b);
    }

    // Sort by a_idx, then find LIS by b_idx to get anchors
    matches.sort_by_key(|m| m.0);
    // Simple greedy LIS on b indices
    let mut anchors: Vec<(usize, usize)> = Vec::new();
    for &(a_idx, b_idx) in &matches {
        if anchors.is_empty() || b_idx > anchors.last().unwrap().1 {
            anchors.push((a_idx, b_idx));
        }
    }

    if anchors.is_empty() {
        return simple_diff(lines_a, lines_b);
    }

    // Build edit script by diffing gaps between anchors
    let mut ops = Vec::new();
    let mut prev_a = 0;
    let mut prev_b = 0;

    for &(a_idx, b_idx) in &anchors {
        let gap_a: Vec<&str> = lines_a[prev_a..a_idx].to_vec();
        let gap_b: Vec<&str> = lines_b[prev_b..b_idx].to_vec();
        ops.extend(simple_diff(&gap_a, &gap_b));
        ops.push(EditOp { op_type: "equal".to_string(), line: a_idx, content: lines_a[a_idx].to_string() });
        prev_a = a_idx + 1;
        prev_b = b_idx + 1;
    }

    // Diff remaining gap
    let gap_a: Vec<&str> = lines_a[prev_a..].to_vec();
    let gap_b: Vec<&str> = lines_b[prev_b..].to_vec();
    ops.extend(simple_diff(&gap_a, &gap_b));

    ops
}

#[async_trait]
impl PatienceDiffHandler for PatienceDiffHandlerImpl {
    async fn register(
        &self,
        _input: PatienceDiffRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<PatienceDiffRegisterOutput, Box<dyn std::error::Error>> {
        Ok(PatienceDiffRegisterOutput::Ok {
            name: "patience".to_string(),
            category: "diff".to_string(),
            content_types: vec!["text/plain".to_string(), "text/*".to_string()],
        })
    }

    async fn compute(
        &self,
        input: PatienceDiffComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatienceDiffComputeOutput, Box<dyn std::error::Error>> {
        let content_a = String::from_utf8_lossy(&input.content_a);
        let content_b = String::from_utf8_lossy(&input.content_b);

        let lines_a: Vec<&str> = content_a.split('\n').collect();
        let lines_b: Vec<&str> = content_b.split('\n').collect();

        let edit_ops = patience_diff(&lines_a, &lines_b);
        let distance = edit_ops.iter().filter(|op| op.op_type != "equal").count() as i64;
        let edit_script = serde_json::to_string(&edit_ops)?;

        let id = next_id();
        storage.put("patience-diff", &id, json!({
            "id": id,
            "editScript": edit_script,
            "distance": distance
        })).await?;

        Ok(PatienceDiffComputeOutput::Ok {
            edit_script: edit_script.into_bytes(),
            distance,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = PatienceDiffHandlerImpl;
        let result = handler.register(
            PatienceDiffRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            PatienceDiffRegisterOutput::Ok { name, category, content_types } => {
                assert_eq!(name, "patience");
                assert_eq!(category, "diff");
                assert!(!content_types.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_compute_identical() {
        let storage = InMemoryStorage::new();
        let handler = PatienceDiffHandlerImpl;
        let content = b"line1\nline2\nline3".to_vec();
        let result = handler.compute(
            PatienceDiffComputeInput {
                content_a: content.clone(),
                content_b: content,
            },
            &storage,
        ).await.unwrap();
        match result {
            PatienceDiffComputeOutput::Ok { distance, .. } => {
                assert_eq!(distance, 0);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_compute_different() {
        let storage = InMemoryStorage::new();
        let handler = PatienceDiffHandlerImpl;
        let result = handler.compute(
            PatienceDiffComputeInput {
                content_a: b"line1\nline2".to_vec(),
                content_b: b"line1\nline3".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PatienceDiffComputeOutput::Ok { distance, .. } => {
                assert!(distance > 0);
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
