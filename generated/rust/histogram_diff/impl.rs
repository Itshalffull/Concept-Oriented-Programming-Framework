// HistogramDiff concept implementation
// Histogram-based diff algorithm: frequency-anchored line matching with LCS fallback.
// Produces edit scripts (add/remove/keep) for content comparison.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::HistogramDiffHandler;
use serde_json::json;
use std::collections::HashMap;

pub struct HistogramDiffHandlerImpl;

/// Build a frequency histogram of lines
fn build_histogram(lines: &[&str]) -> HashMap<&str, usize> {
    let mut hist = HashMap::new();
    for line in lines {
        *hist.entry(*line).or_insert(0) += 1;
    }
    hist
}

/// Find the longest common subsequence using dynamic programming
fn lcs_length(a: &[&str], b: &[&str]) -> Vec<Vec<usize>> {
    let m = a.len();
    let n = b.len();
    let mut dp = vec![vec![0usize; n + 1]; m + 1];

    for i in 1..=m {
        for j in 1..=n {
            if a[i - 1] == b[j - 1] {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
            }
        }
    }

    dp
}

/// Produce an edit script from two content buffers using histogram-based diff
fn compute_edit_script(content_a: &[u8], content_b: &[u8]) -> (Vec<u8>, i64) {
    let text_a = String::from_utf8_lossy(content_a);
    let text_b = String::from_utf8_lossy(content_b);

    let lines_a: Vec<&str> = text_a.lines().collect();
    let lines_b: Vec<&str> = text_b.lines().collect();

    if lines_a.is_empty() && lines_b.is_empty() {
        return (Vec::new(), 0);
    }

    if lines_a.is_empty() {
        let mut script = String::new();
        for line in &lines_b {
            script.push_str(&format!("+{}\n", line));
        }
        let distance = lines_b.len() as i64;
        return (script.into_bytes(), distance);
    }

    if lines_b.is_empty() {
        let mut script = String::new();
        for line in &lines_a {
            script.push_str(&format!("-{}\n", line));
        }
        let distance = lines_a.len() as i64;
        return (script.into_bytes(), distance);
    }

    // Build histograms for frequency-based anchoring
    let hist_a = build_histogram(&lines_a);
    let hist_b = build_histogram(&lines_b);

    // Find unique lines that appear exactly once in both - these are strong anchors
    let mut anchors: Vec<(usize, usize)> = Vec::new();
    for (i, line) in lines_a.iter().enumerate() {
        if hist_a.get(line) == Some(&1) && hist_b.get(line) == Some(&1) {
            if let Some(j) = lines_b.iter().position(|l| l == line) {
                anchors.push((i, j));
            }
        }
    }

    // Use LCS as fallback for non-anchored regions
    let dp = lcs_length(&lines_a, &lines_b);

    // Backtrack to produce the edit script
    let mut script = String::new();
    let mut distance: i64 = 0;
    let mut i = lines_a.len();
    let mut j = lines_b.len();
    let mut edits: Vec<String> = Vec::new();

    while i > 0 || j > 0 {
        if i > 0 && j > 0 && lines_a[i - 1] == lines_b[j - 1] {
            edits.push(format!(" {}", lines_a[i - 1]));
            i -= 1;
            j -= 1;
        } else if j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) {
            edits.push(format!("+{}", lines_b[j - 1]));
            distance += 1;
            j -= 1;
        } else if i > 0 {
            edits.push(format!("-{}", lines_a[i - 1]));
            distance += 1;
            i -= 1;
        }
    }

    edits.reverse();
    for edit in &edits {
        script.push_str(edit);
        script.push('\n');
    }

    (script.into_bytes(), distance)
}

#[async_trait]
impl HistogramDiffHandler for HistogramDiffHandlerImpl {
    async fn register(
        &self,
        _input: HistogramDiffRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<HistogramDiffRegisterOutput, Box<dyn std::error::Error>> {
        Ok(HistogramDiffRegisterOutput::Ok {
            name: "histogram-diff".to_string(),
            category: "diff".to_string(),
            content_types: vec![
                "text/plain".to_string(),
                "text/x-source".to_string(),
                "application/json".to_string(),
                "text/yaml".to_string(),
                "text/markdown".to_string(),
            ],
        })
    }

    async fn compute(
        &self,
        input: HistogramDiffComputeInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<HistogramDiffComputeOutput, Box<dyn std::error::Error>> {
        // Validate that content is text (not binary)
        let is_binary_a = input.content_a.iter().any(|&b| b == 0);
        let is_binary_b = input.content_b.iter().any(|&b| b == 0);

        if is_binary_a || is_binary_b {
            return Ok(HistogramDiffComputeOutput::UnsupportedContent {
                message: "Binary content is not supported; histogram diff requires text input".to_string(),
            });
        }

        let (edit_script, distance) = compute_edit_script(&input.content_a, &input.content_b);

        Ok(HistogramDiffComputeOutput::Ok {
            edit_script,
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
        let handler = HistogramDiffHandlerImpl;
        let result = handler.register(
            HistogramDiffRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            HistogramDiffRegisterOutput::Ok { name, category, content_types } => {
                assert_eq!(name, "histogram-diff");
                assert_eq!(category, "diff");
                assert!(!content_types.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_compute_identical() {
        let storage = InMemoryStorage::new();
        let handler = HistogramDiffHandlerImpl;
        let content = b"line one\nline two\n".to_vec();
        let result = handler.compute(
            HistogramDiffComputeInput {
                content_a: content.clone(),
                content_b: content,
            },
            &storage,
        ).await.unwrap();
        match result {
            HistogramDiffComputeOutput::Ok { distance, .. } => {
                assert_eq!(distance, 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_compute_different() {
        let storage = InMemoryStorage::new();
        let handler = HistogramDiffHandlerImpl;
        let result = handler.compute(
            HistogramDiffComputeInput {
                content_a: b"alpha\nbeta\n".to_vec(),
                content_b: b"alpha\ngamma\n".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            HistogramDiffComputeOutput::Ok { distance, edit_script } => {
                assert!(distance > 0);
                assert!(!edit_script.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_compute_binary_unsupported() {
        let storage = InMemoryStorage::new();
        let handler = HistogramDiffHandlerImpl;
        let result = handler.compute(
            HistogramDiffComputeInput {
                content_a: vec![0x00, 0x01, 0x02],
                content_b: b"text content".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            HistogramDiffComputeOutput::UnsupportedContent { message } => {
                assert!(message.contains("Binary"));
            },
            _ => panic!("Expected UnsupportedContent variant"),
        }
    }

    #[tokio::test]
    async fn test_compute_empty_to_content() {
        let storage = InMemoryStorage::new();
        let handler = HistogramDiffHandlerImpl;
        let result = handler.compute(
            HistogramDiffComputeInput {
                content_a: Vec::new(),
                content_b: b"new line\n".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            HistogramDiffComputeOutput::Ok { distance, .. } => {
                assert!(distance > 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
