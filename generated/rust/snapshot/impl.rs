// Snapshot concept implementation
// Manages snapshot-based testing and approval workflows for generated output.
// Compares current content against approved baselines, tracks diffs, and manages approvals.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SnapshotHandler;
use serde_json::json;

pub struct SnapshotHandlerImpl;

fn content_hash(content: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}Z", t.as_secs())
}

fn compute_line_diff(old: &str, new: &str) -> (String, i64, i64) {
    let old_lines: Vec<&str> = old.lines().collect();
    let new_lines: Vec<&str> = new.lines().collect();

    let mut added = 0i64;
    let mut removed = 0i64;
    let mut diff_parts = Vec::new();

    // Simple line-by-line comparison
    let max_len = old_lines.len().max(new_lines.len());
    for i in 0..max_len {
        match (old_lines.get(i), new_lines.get(i)) {
            (Some(old_line), Some(new_line)) => {
                if old_line != new_line {
                    diff_parts.push(format!("-{}", old_line));
                    diff_parts.push(format!("+{}", new_line));
                    added += 1;
                    removed += 1;
                } else {
                    diff_parts.push(format!(" {}", old_line));
                }
            }
            (Some(old_line), None) => {
                diff_parts.push(format!("-{}", old_line));
                removed += 1;
            }
            (None, Some(new_line)) => {
                diff_parts.push(format!("+{}", new_line));
                added += 1;
            }
            (None, None) => {}
        }
    }

    (diff_parts.join("\n"), added, removed)
}

#[async_trait]
impl SnapshotHandler for SnapshotHandlerImpl {
    async fn compare(
        &self,
        input: SnapshotCompareInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotCompareOutput, Box<dyn std::error::Error>> {
        let baseline = storage.get("snapshot", &input.output_path).await?;

        match baseline {
            Some(existing) => {
                let approved_content = existing.get("content")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                if approved_content == input.current_content {
                    Ok(SnapshotCompareOutput::Unchanged {
                        snapshot: input.output_path.clone(),
                    })
                } else {
                    let (diff, lines_added, lines_removed) =
                        compute_line_diff(approved_content, &input.current_content);

                    // Store the pending snapshot
                    storage.put("snapshot_pending", &input.output_path, json!({
                        "path": &input.output_path,
                        "content": &input.current_content,
                        "contentHash": content_hash(&input.current_content),
                        "status": "changed",
                        "diff": &diff,
                        "linesAdded": lines_added,
                        "linesRemoved": lines_removed,
                    })).await?;

                    Ok(SnapshotCompareOutput::Changed {
                        snapshot: input.output_path.clone(),
                        diff,
                        lines_added,
                        lines_removed,
                    })
                }
            }
            None => {
                let hash = content_hash(&input.current_content);

                storage.put("snapshot_pending", &input.output_path, json!({
                    "path": &input.output_path,
                    "content": &input.current_content,
                    "contentHash": &hash,
                    "status": "new",
                })).await?;

                Ok(SnapshotCompareOutput::New {
                    path: input.output_path.clone(),
                    content_hash: hash,
                })
            }
        }
    }

    async fn approve(
        &self,
        input: SnapshotApproveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotApproveOutput, Box<dyn std::error::Error>> {
        let pending = storage.get("snapshot_pending", &input.path).await?;

        match pending {
            Some(p) => {
                let content = p.get("content")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                storage.put("snapshot", &input.path, json!({
                    "path": &input.path,
                    "content": &content,
                    "contentHash": content_hash(&content),
                    "approvedAt": current_timestamp(),
                    "approver": input.approver.as_deref().unwrap_or("system"),
                })).await?;

                storage.del("snapshot_pending", &input.path).await?;

                Ok(SnapshotApproveOutput::Ok {
                    snapshot: input.path.clone(),
                })
            }
            None => {
                Ok(SnapshotApproveOutput::NoChange {
                    snapshot: input.path.clone(),
                })
            }
        }
    }

    async fn approve_all(
        &self,
        input: SnapshotApproveAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotApproveAllOutput, Box<dyn std::error::Error>> {
        let all_pending = storage.find("snapshot_pending", None).await?;
        let mut approved = 0i64;

        for p in &all_pending {
            let path = p.get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            // If paths filter is specified, only approve matching paths
            if let Some(ref paths) = input.paths {
                if !paths.contains(&path) {
                    continue;
                }
            }

            let content = p.get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            storage.put("snapshot", &path, json!({
                "path": &path,
                "content": &content,
                "contentHash": content_hash(&content),
                "approvedAt": current_timestamp(),
                "approver": "bulk-approve",
            })).await?;

            storage.del("snapshot_pending", &path).await?;
            approved += 1;
        }

        Ok(SnapshotApproveAllOutput::Ok { approved })
    }

    async fn reject(
        &self,
        input: SnapshotRejectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotRejectOutput, Box<dyn std::error::Error>> {
        let pending = storage.get("snapshot_pending", &input.path).await?;

        match pending {
            Some(_) => {
                storage.del("snapshot_pending", &input.path).await?;
                Ok(SnapshotRejectOutput::Ok {
                    snapshot: input.path.clone(),
                })
            }
            None => {
                Ok(SnapshotRejectOutput::NoChange {
                    snapshot: input.path.clone(),
                })
            }
        }
    }

    async fn status(
        &self,
        input: SnapshotStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotStatusOutput, Box<dyn std::error::Error>> {
        let approved = storage.find("snapshot", None).await?;
        let pending = storage.find("snapshot_pending", None).await?;

        let mut results = Vec::new();

        for s in &approved {
            let path = s.get("path").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if let Some(ref paths) = input.paths {
                if !paths.contains(&path) {
                    continue;
                }
            }
            results.push(json!({
                "path": path,
                "status": "approved",
                "linesChanged": null,
                "approvedAt": s.get("approvedAt").and_then(|v| v.as_str()).unwrap_or(""),
            }));
        }

        for p in &pending {
            let path = p.get("path").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if let Some(ref paths) = input.paths {
                if !paths.contains(&path) {
                    continue;
                }
            }
            let status = p.get("status").and_then(|v| v.as_str()).unwrap_or("pending").to_string();
            let lines_changed = p.get("linesAdded").and_then(|v| v.as_i64()).unwrap_or(0)
                + p.get("linesRemoved").and_then(|v| v.as_i64()).unwrap_or(0);
            results.push(json!({
                "path": path,
                "status": status,
                "linesChanged": lines_changed,
                "approvedAt": null,
            }));
        }

        // Return as a serialized JSON array since the types use inline struct
        Ok(SnapshotStatusOutput::Ok {
            results: results.into_iter().map(|r| {
                let path = r.get("path").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let status = r.get("status").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let lines_changed = r.get("linesChanged").and_then(|v| v.as_i64());
                let approved_at = None; // chrono DateTime<Utc> not easily constructed from string here
                SnapshotStatusResult { path, status, lines_changed, approved_at }
            }).collect(),
        })
    }

    async fn diff(
        &self,
        input: SnapshotDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotDiffOutput, Box<dyn std::error::Error>> {
        let pending = storage.get("snapshot_pending", &input.path).await?;
        let baseline = storage.get("snapshot", &input.path).await?;

        match (pending, baseline) {
            (Some(p), Some(b)) => {
                let new_content = p.get("content").and_then(|v| v.as_str()).unwrap_or("");
                let old_content = b.get("content").and_then(|v| v.as_str()).unwrap_or("");
                let (diff, lines_added, lines_removed) = compute_line_diff(old_content, new_content);
                Ok(SnapshotDiffOutput::Ok { diff, lines_added, lines_removed })
            }
            (Some(p), None) => {
                let new_content = p.get("content").and_then(|v| v.as_str()).unwrap_or("");
                let lines_added = new_content.lines().count() as i64;
                let diff = new_content.lines()
                    .map(|l| format!("+{}", l))
                    .collect::<Vec<_>>()
                    .join("\n");
                Ok(SnapshotDiffOutput::Ok { diff, lines_added, lines_removed: 0 })
            }
            (None, Some(_)) => {
                Ok(SnapshotDiffOutput::Unchanged { path: input.path })
            }
            (None, None) => {
                Ok(SnapshotDiffOutput::NoBaseline { path: input.path })
            }
        }
    }

    async fn clean(
        &self,
        input: SnapshotCleanInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SnapshotCleanOutput, Box<dyn std::error::Error>> {
        let all_snapshots = storage.find("snapshot", None).await?;
        let mut removed = Vec::new();

        for s in &all_snapshots {
            let path = s.get("path").and_then(|v| v.as_str()).unwrap_or("");
            if path.starts_with(&input.output_dir) {
                storage.del("snapshot", path).await?;
                removed.push(path.to_string());
            }
        }

        let all_pending = storage.find("snapshot_pending", None).await?;
        for p in &all_pending {
            let path = p.get("path").and_then(|v| v.as_str()).unwrap_or("");
            if path.starts_with(&input.output_dir) {
                storage.del("snapshot_pending", path).await?;
                if !removed.contains(&path.to_string()) {
                    removed.push(path.to_string());
                }
            }
        }

        Ok(SnapshotCleanOutput::Ok { removed })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_compare_new_snapshot() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        let result = handler.compare(
            SnapshotCompareInput {
                output_path: "gen/user.rs".to_string(),
                current_content: "fn main() {}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotCompareOutput::New { path, content_hash } => {
                assert_eq!(path, "gen/user.rs");
                assert!(!content_hash.is_empty());
            },
            _ => panic!("Expected New variant"),
        }
    }

    #[tokio::test]
    async fn test_approve_no_change() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        let result = handler.approve(
            SnapshotApproveInput { path: "missing.rs".to_string(), approver: None },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotApproveOutput::NoChange { .. } => {},
            _ => panic!("Expected NoChange variant"),
        }
    }

    #[tokio::test]
    async fn test_approve_after_compare() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        handler.compare(
            SnapshotCompareInput {
                output_path: "gen/test.rs".to_string(),
                current_content: "content".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.approve(
            SnapshotApproveInput { path: "gen/test.rs".to_string(), approver: Some("dev".to_string()) },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotApproveOutput::Ok { snapshot } => {
                assert_eq!(snapshot, "gen/test.rs");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_reject_no_change() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        let result = handler.reject(
            SnapshotRejectInput { path: "missing.rs".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotRejectOutput::NoChange { .. } => {},
            _ => panic!("Expected NoChange variant"),
        }
    }

    #[tokio::test]
    async fn test_diff_no_baseline() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        let result = handler.diff(
            SnapshotDiffInput { path: "missing.rs".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotDiffOutput::NoBaseline { .. } => {},
            _ => panic!("Expected NoBaseline variant"),
        }
    }

    #[tokio::test]
    async fn test_clean_empty() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        let result = handler.clean(
            SnapshotCleanInput { output_dir: "gen/".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotCleanOutput::Ok { removed } => {
                assert!(removed.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_approve_all_empty() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        let result = handler.approve_all(
            SnapshotApproveAllInput { paths: None },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotApproveAllOutput::Ok { approved } => {
                assert_eq!(approved, 0);
            },
        }
    }

    #[tokio::test]
    async fn test_compare_unchanged() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        let content = "fn main() {}";
        storage.put("snapshot", "unchanged.rs", json!({
            "path": "unchanged.rs",
            "content": content,
        })).await.unwrap();
        let result = handler.compare(
            SnapshotCompareInput {
                output_path: "unchanged.rs".to_string(),
                current_content: content.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotCompareOutput::Unchanged { snapshot } => {
                assert_eq!(snapshot, "unchanged.rs");
            },
            other => panic!("Expected Unchanged variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_compare_changed() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        storage.put("snapshot", "changed.rs", json!({
            "path": "changed.rs",
            "content": "old content",
        })).await.unwrap();
        let result = handler.compare(
            SnapshotCompareInput {
                output_path: "changed.rs".to_string(),
                current_content: "new content".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotCompareOutput::Changed { snapshot, diff, lines_added, lines_removed } => {
                assert_eq!(snapshot, "changed.rs");
                assert!(!diff.is_empty());
                assert!(lines_added > 0 || lines_removed > 0);
            },
            other => panic!("Expected Changed variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_reject_ok() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        handler.compare(
            SnapshotCompareInput {
                output_path: "reject-me.rs".to_string(),
                current_content: "content".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.reject(
            SnapshotRejectInput { path: "reject-me.rs".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotRejectOutput::Ok { snapshot } => {
                assert_eq!(snapshot, "reject-me.rs");
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_approve_all_multiple() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        handler.compare(
            SnapshotCompareInput {
                output_path: "a.rs".to_string(),
                current_content: "content a".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.compare(
            SnapshotCompareInput {
                output_path: "b.rs".to_string(),
                current_content: "content b".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.approve_all(
            SnapshotApproveAllInput { paths: None },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotApproveAllOutput::Ok { approved } => {
                assert_eq!(approved, 2);
            },
        }
    }

    #[tokio::test]
    async fn test_approve_all_filtered() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        handler.compare(
            SnapshotCompareInput {
                output_path: "keep.rs".to_string(),
                current_content: "keep".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.compare(
            SnapshotCompareInput {
                output_path: "skip.rs".to_string(),
                current_content: "skip".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.approve_all(
            SnapshotApproveAllInput {
                paths: Some(vec!["keep.rs".to_string()]),
            },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotApproveAllOutput::Ok { approved } => {
                assert_eq!(approved, 1);
            },
        }
    }

    #[tokio::test]
    async fn test_status_with_data() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        handler.compare(
            SnapshotCompareInput {
                output_path: "stat.rs".to_string(),
                current_content: "stat content".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.approve(
            SnapshotApproveInput {
                path: "stat.rs".to_string(),
                approver: None,
            },
            &storage,
        ).await.unwrap();
        handler.compare(
            SnapshotCompareInput {
                output_path: "pending.rs".to_string(),
                current_content: "pending content".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.status(
            SnapshotStatusInput { paths: None },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotStatusOutput::Ok { results } => {
                assert_eq!(results.len(), 2);
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_diff_ok_with_changes() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        storage.put("snapshot", "diff.rs", json!({
            "path": "diff.rs",
            "content": "old line",
        })).await.unwrap();
        storage.put("snapshot_pending", "diff.rs", json!({
            "path": "diff.rs",
            "content": "new line",
        })).await.unwrap();
        let result = handler.diff(
            SnapshotDiffInput { path: "diff.rs".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotDiffOutput::Ok { diff, lines_added, lines_removed } => {
                assert!(!diff.is_empty());
                assert!(lines_added > 0 || lines_removed > 0);
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_diff_unchanged() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        storage.put("snapshot", "unch.rs", json!({
            "path": "unch.rs",
            "content": "content",
        })).await.unwrap();
        let result = handler.diff(
            SnapshotDiffInput { path: "unch.rs".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotDiffOutput::Unchanged { path } => {
                assert_eq!(path, "unch.rs");
            },
            other => panic!("Expected Unchanged variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_diff_new_only_pending() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        storage.put("snapshot_pending", "new.rs", json!({
            "path": "new.rs",
            "content": "line one\nline two",
        })).await.unwrap();
        let result = handler.diff(
            SnapshotDiffInput { path: "new.rs".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotDiffOutput::Ok { diff, lines_added, lines_removed } => {
                assert!(diff.contains("+line one"));
                assert_eq!(lines_added, 2);
                assert_eq!(lines_removed, 0);
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_clean_removes_matching() {
        let storage = InMemoryStorage::new();
        let handler = SnapshotHandlerImpl;
        storage.put("snapshot", "gen/a.rs", json!({
            "path": "gen/a.rs",
            "content": "a",
        })).await.unwrap();
        storage.put("snapshot", "other/b.rs", json!({
            "path": "other/b.rs",
            "content": "b",
        })).await.unwrap();
        let result = handler.clean(
            SnapshotCleanInput { output_dir: "gen/".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SnapshotCleanOutput::Ok { removed } => {
                assert_eq!(removed.len(), 1);
                assert!(removed.contains(&"gen/a.rs".to_string()));
            },
        }
    }
}
