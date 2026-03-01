// ThreeWayMerge concept implementation
// Merge two divergent text files relative to a common base using classic three-way merge.
// Standard algorithm used in Git, POSIX merge, and most version control systems.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ThreeWayMergeHandler;

pub struct ThreeWayMergeHandlerImpl;

/// Classic three-way merge algorithm. Compares ours and theirs against a common base.
/// Non-conflicting changes are merged automatically. Conflicting changes produce conflict markers.
fn three_way_merge(base_str: &str, ours_str: &str, theirs_str: &str) -> (Option<String>, Vec<Vec<u8>>) {
    let base_lines: Vec<&str> = base_str.split('\n').collect();
    let our_lines: Vec<&str> = ours_str.split('\n').collect();
    let their_lines: Vec<&str> = theirs_str.split('\n').collect();

    let mut result_lines: Vec<String> = Vec::new();
    let mut conflict_regions: Vec<Vec<u8>> = Vec::new();
    let mut has_conflicts = false;

    let max_base = base_lines.len();
    let mut base_idx = 0;
    let mut ours_idx = 0;
    let mut theirs_idx = 0;

    while base_idx < max_base || ours_idx < our_lines.len() || theirs_idx < their_lines.len() {
        if base_idx >= max_base {
            let ours_remaining: Vec<&str> = our_lines[ours_idx..].to_vec();
            let theirs_remaining: Vec<&str> = their_lines[theirs_idx..].to_vec();

            if ours_remaining == theirs_remaining {
                result_lines.extend(ours_remaining.iter().map(|s| s.to_string()));
            } else if ours_idx >= our_lines.len() {
                result_lines.extend(theirs_remaining.iter().map(|s| s.to_string()));
            } else if theirs_idx >= their_lines.len() {
                result_lines.extend(ours_remaining.iter().map(|s| s.to_string()));
            } else {
                has_conflicts = true;
                let marker = format!(
                    "<<<<<<< ours\n{}\n=======\n{}\n>>>>>>> theirs",
                    ours_remaining.join("\n"),
                    theirs_remaining.join("\n")
                );
                conflict_regions.push(marker.as_bytes().to_vec());
                result_lines.push(marker);
            }
            break;
        }

        let base_line = base_lines[base_idx];
        let our_line = our_lines.get(ours_idx).copied();
        let their_line = their_lines.get(theirs_idx).copied();

        if our_line == their_line {
            if let Some(line) = our_line {
                result_lines.push(line.to_string());
            }
            base_idx += 1;
            ours_idx += 1;
            theirs_idx += 1;
        } else if our_line == Some(base_line) && their_line != Some(base_line) {
            if let Some(line) = their_line {
                result_lines.push(line.to_string());
            }
            base_idx += 1;
            ours_idx += 1;
            theirs_idx += 1;
        } else if their_line == Some(base_line) && our_line != Some(base_line) {
            if let Some(line) = our_line {
                result_lines.push(line.to_string());
            }
            base_idx += 1;
            ours_idx += 1;
            theirs_idx += 1;
        } else {
            has_conflicts = true;
            let marker = format!(
                "<<<<<<< ours\n{}\n=======\n{}\n>>>>>>> theirs",
                our_line.unwrap_or(""),
                their_line.unwrap_or("")
            );
            conflict_regions.push(marker.as_bytes().to_vec());
            result_lines.push(marker);
            base_idx += 1;
            ours_idx += 1;
            theirs_idx += 1;
        }
    }

    if has_conflicts {
        (None, conflict_regions)
    } else {
        (Some(result_lines.join("\n")), vec![])
    }
}

#[async_trait]
impl ThreeWayMergeHandler for ThreeWayMergeHandlerImpl {
    async fn register(
        &self,
        _input: ThreeWayMergeRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<ThreeWayMergeRegisterOutput, Box<dyn std::error::Error>> {
        Ok(ThreeWayMergeRegisterOutput::Ok {
            name: "three-way".to_string(),
            category: "merge".to_string(),
            content_types: vec![
                "text/plain".to_string(),
                "text/*".to_string(),
            ],
        })
    }

    async fn execute(
        &self,
        input: ThreeWayMergeExecuteInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<ThreeWayMergeExecuteOutput, Box<dyn std::error::Error>> {
        let base = match String::from_utf8(input.base.clone()) {
            Ok(s) => s,
            Err(_) => return Ok(ThreeWayMergeExecuteOutput::UnsupportedContent {
                message: "Content must be valid UTF-8 text".to_string(),
            }),
        };
        let ours = match String::from_utf8(input.ours.clone()) {
            Ok(s) => s,
            Err(_) => return Ok(ThreeWayMergeExecuteOutput::UnsupportedContent {
                message: "Content must be valid UTF-8 text".to_string(),
            }),
        };
        let theirs = match String::from_utf8(input.theirs.clone()) {
            Ok(s) => s,
            Err(_) => return Ok(ThreeWayMergeExecuteOutput::UnsupportedContent {
                message: "Content must be valid UTF-8 text".to_string(),
            }),
        };

        // Trivial cases
        if ours == theirs {
            return Ok(ThreeWayMergeExecuteOutput::Clean { result: ours.into_bytes() });
        }
        if ours == base {
            return Ok(ThreeWayMergeExecuteOutput::Clean { result: theirs.into_bytes() });
        }
        if theirs == base {
            return Ok(ThreeWayMergeExecuteOutput::Clean { result: ours.into_bytes() });
        }

        let (result, conflicts) = three_way_merge(&base, &ours, &theirs);

        match result {
            Some(merged) => Ok(ThreeWayMergeExecuteOutput::Clean { result: merged.into_bytes() }),
            None => Ok(ThreeWayMergeExecuteOutput::Conflicts { regions: conflicts }),
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
        let handler = ThreeWayMergeHandlerImpl;
        let result = handler.register(
            ThreeWayMergeRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            ThreeWayMergeRegisterOutput::Ok { name, category, content_types } => {
                assert_eq!(name, "three-way");
                assert_eq!(category, "merge");
                assert!(!content_types.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_identical_sides() {
        let storage = InMemoryStorage::new();
        let handler = ThreeWayMergeHandlerImpl;
        let result = handler.execute(
            ThreeWayMergeExecuteInput {
                base: b"line1\nline2".to_vec(),
                ours: b"line1\nline2\nline3".to_vec(),
                theirs: b"line1\nline2\nline3".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThreeWayMergeExecuteOutput::Clean { result } => {
                let text = String::from_utf8(result).unwrap();
                assert!(text.contains("line3"));
            },
            _ => panic!("Expected Clean variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_ours_only_change() {
        let storage = InMemoryStorage::new();
        let handler = ThreeWayMergeHandlerImpl;
        let result = handler.execute(
            ThreeWayMergeExecuteInput {
                base: b"hello".to_vec(),
                ours: b"hello world".to_vec(),
                theirs: b"hello".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThreeWayMergeExecuteOutput::Clean { result } => {
                let text = String::from_utf8(result).unwrap();
                assert_eq!(text, "hello world");
            },
            _ => panic!("Expected Clean variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_theirs_only_change() {
        let storage = InMemoryStorage::new();
        let handler = ThreeWayMergeHandlerImpl;
        let result = handler.execute(
            ThreeWayMergeExecuteInput {
                base: b"hello".to_vec(),
                ours: b"hello".to_vec(),
                theirs: b"hello world".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThreeWayMergeExecuteOutput::Clean { result } => {
                let text = String::from_utf8(result).unwrap();
                assert_eq!(text, "hello world");
            },
            _ => panic!("Expected Clean variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_conflict() {
        let storage = InMemoryStorage::new();
        let handler = ThreeWayMergeHandlerImpl;
        let result = handler.execute(
            ThreeWayMergeExecuteInput {
                base: b"line".to_vec(),
                ours: b"our change".to_vec(),
                theirs: b"their change".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThreeWayMergeExecuteOutput::Conflicts { regions } => {
                assert!(!regions.is_empty());
                let text = String::from_utf8(regions[0].clone()).unwrap();
                assert!(text.contains("<<<<<<<"));
            },
            _ => panic!("Expected Conflicts variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_unsupported_content() {
        let storage = InMemoryStorage::new();
        let handler = ThreeWayMergeHandlerImpl;
        let result = handler.execute(
            ThreeWayMergeExecuteInput {
                base: vec![0xFF, 0xFE],
                ours: b"valid".to_vec(),
                theirs: b"valid".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThreeWayMergeExecuteOutput::UnsupportedContent { .. } => {},
            _ => panic!("Expected UnsupportedContent variant"),
        }
    }
}
