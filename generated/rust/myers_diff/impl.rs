// MyersDiff -- implements Myers' O(ND) difference algorithm for computing
// minimal edit scripts between two sequences. Operates on line-delimited
// text content, producing insert/delete edit operations.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::MyersDiffHandler;
use serde_json::json;

pub struct MyersDiffHandlerImpl;

/// Represents a single edit operation in the diff output.
#[derive(Debug)]
enum EditOp {
    Equal(String),
    Insert(String),
    Delete(String),
}

/// Core Myers diff algorithm on line sequences.
fn compute_myers_diff(lines_a: &[&str], lines_b: &[&str]) -> Vec<EditOp> {
    let n = lines_a.len();
    let m = lines_b.len();
    let max = n + m;

    if max == 0 {
        return Vec::new();
    }

    // V array indexed by diagonal k, offset by max to handle negative indices
    let mut v: Vec<isize> = vec![0; 2 * max + 1];
    let mut trace: Vec<Vec<isize>> = Vec::new();

    'outer: for d in 0..=(max as isize) {
        trace.push(v.clone());

        for k in (-d..=d).step_by(2) {
            let idx = (k + max as isize) as usize;
            let mut x = if k == -d || (k != d && v[idx - 1] < v[idx + 1]) {
                v[idx + 1]
            } else {
                v[idx - 1] + 1
            };
            let mut y = x - k;

            // Follow diagonal (equal elements)
            while (x as usize) < n && (y as usize) < m && lines_a[x as usize] == lines_b[y as usize] {
                x += 1;
                y += 1;
            }

            v[idx] = x;

            if x as usize >= n && y as usize >= m {
                break 'outer;
            }
        }
    }

    // Backtrack to produce edit script
    let mut ops = Vec::new();
    let mut x = n as isize;
    let mut y = m as isize;

    for d in (0..trace.len()).rev() {
        let v_prev = &trace[d];
        let k = x - y;

        let prev_k = if k == -(d as isize) || (k != d as isize && v_prev[(k - 1 + max as isize) as usize] < v_prev[(k + 1 + max as isize) as usize]) {
            k + 1
        } else {
            k - 1
        };

        let prev_x = v_prev[(prev_k + max as isize) as usize];
        let prev_y = prev_x - prev_k;

        // Diagonal moves (equal)
        while x > prev_x + if prev_k < k { 0 } else { 1 } && y > prev_y + if prev_k < k { 1 } else { 0 } {
            x -= 1;
            y -= 1;
            if (x as usize) < n {
                ops.push(EditOp::Equal(lines_a[x as usize].to_string()));
            }
        }

        if d > 0 {
            if prev_k < k {
                // Insert from B
                if (prev_y as usize) < m {
                    ops.push(EditOp::Insert(lines_b[prev_y as usize].to_string()));
                }
            } else {
                // Delete from A
                if (prev_x as usize) < n {
                    ops.push(EditOp::Delete(lines_a[prev_x as usize].to_string()));
                }
            }
        }

        x = prev_x;
        y = prev_y;
    }

    ops.reverse();
    ops
}

#[async_trait]
impl MyersDiffHandler for MyersDiffHandlerImpl {
    async fn register(
        &self,
        _input: MyersDiffRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<MyersDiffRegisterOutput, Box<dyn std::error::Error>> {
        Ok(MyersDiffRegisterOutput::Ok {
            name: "myers-diff".to_string(),
            category: "diff".to_string(),
            content_types: vec!["text/plain".to_string(), "text/markdown".to_string(), "application/json".to_string()],
        })
    }

    async fn compute(
        &self,
        input: MyersDiffComputeInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<MyersDiffComputeOutput, Box<dyn std::error::Error>> {
        // Convert bytes to text
        let text_a = match std::str::from_utf8(&input.content_a) {
            Ok(s) => s,
            Err(_) => {
                return Ok(MyersDiffComputeOutput::UnsupportedContent {
                    message: "Content A is not valid UTF-8 text".to_string(),
                });
            }
        };

        let text_b = match std::str::from_utf8(&input.content_b) {
            Ok(s) => s,
            Err(_) => {
                return Ok(MyersDiffComputeOutput::UnsupportedContent {
                    message: "Content B is not valid UTF-8 text".to_string(),
                });
            }
        };

        let lines_a: Vec<&str> = text_a.lines().collect();
        let lines_b: Vec<&str> = text_b.lines().collect();

        let ops = compute_myers_diff(&lines_a, &lines_b);

        let distance = ops.iter()
            .filter(|op| !matches!(op, EditOp::Equal(_)))
            .count() as i64;

        let edit_script: Vec<serde_json::Value> = ops.iter()
            .map(|op| match op {
                EditOp::Equal(line) => json!({ "op": "equal", "line": line }),
                EditOp::Insert(line) => json!({ "op": "insert", "line": line }),
                EditOp::Delete(line) => json!({ "op": "delete", "line": line }),
            })
            .collect();

        let script_bytes = serde_json::to_vec(&edit_script)?;

        Ok(MyersDiffComputeOutput::Ok {
            edit_script: script_bytes,
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
        let handler = MyersDiffHandlerImpl;
        let result = handler.register(
            MyersDiffRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            MyersDiffRegisterOutput::Ok { name, category, content_types } => {
                assert_eq!(name, "myers-diff");
                assert_eq!(category, "diff");
                assert!(!content_types.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_compute_identical() {
        let storage = InMemoryStorage::new();
        let handler = MyersDiffHandlerImpl;
        let content = b"line1\nline2\nline3".to_vec();
        let result = handler.compute(
            MyersDiffComputeInput { content_a: content.clone(), content_b: content },
            &storage,
        ).await.unwrap();
        match result {
            MyersDiffComputeOutput::Ok { distance, .. } => {
                assert_eq!(distance, 0);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_compute_with_changes() {
        let storage = InMemoryStorage::new();
        let handler = MyersDiffHandlerImpl;
        let result = handler.compute(
            MyersDiffComputeInput {
                content_a: b"a\nb\nc".to_vec(),
                content_b: b"a\nx\nc".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            MyersDiffComputeOutput::Ok { distance, .. } => {
                assert!(distance > 0);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_compute_unsupported_content() {
        let storage = InMemoryStorage::new();
        let handler = MyersDiffHandlerImpl;
        let result = handler.compute(
            MyersDiffComputeInput {
                content_a: vec![0xFF, 0xFE],
                content_b: b"valid".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            MyersDiffComputeOutput::UnsupportedContent { .. } => {}
            _ => panic!("Expected UnsupportedContent variant"),
        }
    }
}
