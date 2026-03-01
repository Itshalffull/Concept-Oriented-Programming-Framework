// RecursiveMerge concept implementation
// Three-way recursive merge strategy for structured content. Walks the content
// tree recursively, merging nodes at each level and detecting conflicts when
// both sides modify the same structural element.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RecursiveMergeHandler;
use serde_json::json;

pub struct RecursiveMergeHandlerImpl;

#[async_trait]
impl RecursiveMergeHandler for RecursiveMergeHandlerImpl {
    async fn register(
        &self,
        _input: RecursiveMergeRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RecursiveMergeRegisterOutput, Box<dyn std::error::Error>> {
        let name = "recursive-merge".to_string();
        let category = "structural".to_string();
        let content_types = vec![
            "application/json".to_string(),
            "text/yaml".to_string(),
            "text/xml".to_string(),
            "text/plain".to_string(),
        ];

        storage.put("merge-strategy", &name, json!({
            "name": name,
            "category": category,
            "contentTypes": content_types,
            "algorithm": "recursive",
        })).await?;

        Ok(RecursiveMergeRegisterOutput::Ok {
            name,
            category,
            content_types,
        })
    }

    async fn execute(
        &self,
        input: RecursiveMergeExecuteInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<RecursiveMergeExecuteOutput, Box<dyn std::error::Error>> {
        let base_str = String::from_utf8_lossy(&input.base).to_string();
        let ours_str = String::from_utf8_lossy(&input.ours).to_string();
        let theirs_str = String::from_utf8_lossy(&input.theirs).to_string();

        // Attempt to parse as JSON for structured recursive merge
        let base_json: Result<serde_json::Value, _> = serde_json::from_str(&base_str);
        let ours_json: Result<serde_json::Value, _> = serde_json::from_str(&ours_str);
        let theirs_json: Result<serde_json::Value, _> = serde_json::from_str(&theirs_str);

        match (base_json, ours_json, theirs_json) {
            (Ok(base_val), Ok(ours_val), Ok(theirs_val)) => {
                // Recursive JSON merge
                match recursive_json_merge(&base_val, &ours_val, &theirs_val) {
                    MergeResult::Clean(result) => {
                        let result_bytes = serde_json::to_vec_pretty(&result)?;
                        Ok(RecursiveMergeExecuteOutput::Clean { result: result_bytes })
                    }
                    MergeResult::Conflict(regions) => {
                        Ok(RecursiveMergeExecuteOutput::Conflicts { regions })
                    }
                }
            }
            _ => {
                // Fall back to line-based merge for plain text
                let base_lines: Vec<&str> = base_str.lines().collect();
                let ours_lines: Vec<&str> = ours_str.lines().collect();
                let theirs_lines: Vec<&str> = theirs_str.lines().collect();

                let mut result_lines = Vec::new();
                let mut conflicts = Vec::new();
                let max_len = base_lines.len().max(ours_lines.len()).max(theirs_lines.len());

                for i in 0..max_len {
                    let b = base_lines.get(i).copied().unwrap_or("");
                    let o = ours_lines.get(i).copied().unwrap_or("");
                    let t = theirs_lines.get(i).copied().unwrap_or("");

                    if o == t {
                        result_lines.push(o.to_string());
                    } else if o == b {
                        result_lines.push(t.to_string());
                    } else if t == b {
                        result_lines.push(o.to_string());
                    } else {
                        // Both sides changed from base differently
                        conflicts.push(format!(
                            "<<<<<<< ours\n{}\n=======\n{}\n>>>>>>> theirs",
                            o, t
                        ).into_bytes());
                    }
                }

                if conflicts.is_empty() {
                    Ok(RecursiveMergeExecuteOutput::Clean {
                        result: result_lines.join("\n").into_bytes(),
                    })
                } else {
                    Ok(RecursiveMergeExecuteOutput::Conflicts { regions: conflicts })
                }
            }
        }
    }
}

enum MergeResult {
    Clean(serde_json::Value),
    Conflict(Vec<Vec<u8>>),
}

fn recursive_json_merge(
    base: &serde_json::Value,
    ours: &serde_json::Value,
    theirs: &serde_json::Value,
) -> MergeResult {
    match (base, ours, theirs) {
        (serde_json::Value::Object(b), serde_json::Value::Object(o), serde_json::Value::Object(t)) => {
            let mut result = serde_json::Map::new();
            let mut all_keys: std::collections::HashSet<String> = b.keys().cloned().collect();
            for k in o.keys() { all_keys.insert(k.clone()); }
            for k in t.keys() { all_keys.insert(k.clone()); }

            for key in &all_keys {
                let bv = b.get(key).unwrap_or(&serde_json::Value::Null);
                let ov = o.get(key).unwrap_or(&serde_json::Value::Null);
                let tv = t.get(key).unwrap_or(&serde_json::Value::Null);

                if ov == tv {
                    result.insert(key.clone(), ov.clone());
                } else if ov == bv {
                    result.insert(key.clone(), tv.clone());
                } else if tv == bv {
                    result.insert(key.clone(), ov.clone());
                } else {
                    // Both sides diverged: attempt recursive merge if both are objects
                    match recursive_json_merge(bv, ov, tv) {
                        MergeResult::Clean(merged) => {
                            result.insert(key.clone(), merged);
                        }
                        MergeResult::Conflict(regions) => {
                            return MergeResult::Conflict(regions);
                        }
                    }
                }
            }

            MergeResult::Clean(serde_json::Value::Object(result))
        }
        _ => {
            // Scalar or array conflict
            if ours == theirs {
                MergeResult::Clean(ours.clone())
            } else if ours == base {
                MergeResult::Clean(theirs.clone())
            } else if theirs == base {
                MergeResult::Clean(ours.clone())
            } else {
                let conflict = format!(
                    "<<<<<<< ours\n{}\n=======\n{}\n>>>>>>> theirs",
                    serde_json::to_string_pretty(ours).unwrap_or_default(),
                    serde_json::to_string_pretty(theirs).unwrap_or_default(),
                );
                MergeResult::Conflict(vec![conflict.into_bytes()])
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = RecursiveMergeHandlerImpl;
        let result = handler.register(
            RecursiveMergeRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            RecursiveMergeRegisterOutput::Ok { name, category, content_types } => {
                assert_eq!(name, "recursive-merge");
                assert_eq!(category, "structural");
                assert!(!content_types.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_execute_clean_json_merge() {
        let storage = InMemoryStorage::new();
        let handler = RecursiveMergeHandlerImpl;
        let base = r#"{"a":1,"b":2}"#;
        let ours = r#"{"a":10,"b":2}"#;
        let theirs = r#"{"a":1,"b":20}"#;
        let result = handler.execute(
            RecursiveMergeExecuteInput {
                base: base.as_bytes().to_vec(),
                ours: ours.as_bytes().to_vec(),
                theirs: theirs.as_bytes().to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RecursiveMergeExecuteOutput::Clean { result } => {
                let merged: serde_json::Value = serde_json::from_slice(&result).unwrap();
                assert_eq!(merged["a"], 10);
                assert_eq!(merged["b"], 20);
            }
            _ => panic!("Expected Clean variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_conflict() {
        let storage = InMemoryStorage::new();
        let handler = RecursiveMergeHandlerImpl;
        let base = r#"{"a":1}"#;
        let ours = r#"{"a":2}"#;
        let theirs = r#"{"a":3}"#;
        let result = handler.execute(
            RecursiveMergeExecuteInput {
                base: base.as_bytes().to_vec(),
                ours: ours.as_bytes().to_vec(),
                theirs: theirs.as_bytes().to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RecursiveMergeExecuteOutput::Conflicts { regions } => {
                assert!(!regions.is_empty());
            }
            _ => panic!("Expected Conflicts variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_clean_text_merge() {
        let storage = InMemoryStorage::new();
        let handler = RecursiveMergeHandlerImpl;
        let base = b"line1\nline2\nline3";
        let ours = b"line1\nchanged\nline3";
        let theirs = b"line1\nline2\nline3";
        let result = handler.execute(
            RecursiveMergeExecuteInput {
                base: base.to_vec(),
                ours: ours.to_vec(),
                theirs: theirs.to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RecursiveMergeExecuteOutput::Clean { result } => {
                let s = String::from_utf8(result).unwrap();
                assert!(s.contains("changed"));
            }
            _ => panic!("Expected Clean variant"),
        }
    }
}
