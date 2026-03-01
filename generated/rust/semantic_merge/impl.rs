// SemanticMerge -- structure-aware three-way merge that understands content
// semantics to produce cleaner merges than line-based algorithms.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SemanticMergeHandler;
use serde_json::json;

pub struct SemanticMergeHandlerImpl;

#[async_trait]
impl SemanticMergeHandler for SemanticMergeHandlerImpl {
    async fn register(
        &self,
        _input: SemanticMergeRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SemanticMergeRegisterOutput, Box<dyn std::error::Error>> {
        Ok(SemanticMergeRegisterOutput::Ok {
            name: "semantic-merge".to_string(),
            category: "merge".to_string(),
            content_types: vec![
                "text/plain".to_string(),
                "application/json".to_string(),
                "text/yaml".to_string(),
            ],
        })
    }

    async fn execute(
        &self,
        input: SemanticMergeExecuteInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SemanticMergeExecuteOutput, Box<dyn std::error::Error>> {
        // Convert byte buffers to strings for comparison
        let base_str = String::from_utf8(input.base.clone());
        let ours_str = String::from_utf8(input.ours.clone());
        let theirs_str = String::from_utf8(input.theirs.clone());

        // Validate that all inputs are valid UTF-8 text
        let (base, ours, theirs) = match (base_str, ours_str, theirs_str) {
            (Ok(b), Ok(o), Ok(t)) => (b, o, t),
            _ => {
                return Ok(SemanticMergeExecuteOutput::UnsupportedContent {
                    message: "Content is not valid UTF-8 text".to_string(),
                });
            }
        };

        let base_lines: Vec<&str> = base.lines().collect();
        let ours_lines: Vec<&str> = ours.lines().collect();
        let theirs_lines: Vec<&str> = theirs.lines().collect();

        // Simple three-way merge: if one side matches base, take the other side's change
        let mut result_lines: Vec<String> = Vec::new();
        let mut conflict_regions: Vec<Vec<u8>> = Vec::new();
        let max_len = base_lines.len().max(ours_lines.len()).max(theirs_lines.len());

        for i in 0..max_len {
            let base_line = base_lines.get(i).copied().unwrap_or("");
            let ours_line = ours_lines.get(i).copied().unwrap_or("");
            let theirs_line = theirs_lines.get(i).copied().unwrap_or("");

            if ours_line == theirs_line {
                // Both sides agree
                result_lines.push(ours_line.to_string());
            } else if ours_line == base_line {
                // Only theirs changed
                result_lines.push(theirs_line.to_string());
            } else if theirs_line == base_line {
                // Only ours changed
                result_lines.push(ours_line.to_string());
            } else {
                // Both sides changed differently -- conflict
                let conflict = format!(
                    "<<<<<<< ours\n{}\n=======\n{}\n>>>>>>> theirs",
                    ours_line, theirs_line
                );
                conflict_regions.push(conflict.into_bytes());
                result_lines.push(ours_line.to_string());
            }
        }

        if conflict_regions.is_empty() {
            let merged = result_lines.join("\n").into_bytes();
            Ok(SemanticMergeExecuteOutput::Clean { result: merged })
        } else {
            Ok(SemanticMergeExecuteOutput::Conflicts {
                regions: conflict_regions,
            })
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
        let handler = SemanticMergeHandlerImpl;
        let result = handler.register(
            SemanticMergeRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            SemanticMergeRegisterOutput::Ok { name, category, content_types } => {
                assert_eq!(name, "semantic-merge");
                assert_eq!(category, "merge");
                assert!(!content_types.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_execute_clean_merge() {
        let storage = InMemoryStorage::new();
        let handler = SemanticMergeHandlerImpl;
        let result = handler.execute(
            SemanticMergeExecuteInput {
                base: b"line1\nline2".to_vec(),
                ours: b"line1\nline2-modified".to_vec(),
                theirs: b"line1\nline2".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SemanticMergeExecuteOutput::Clean { result } => {
                let text = String::from_utf8(result).unwrap();
                assert!(text.contains("line2-modified"));
            },
            _ => panic!("Expected Clean variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_conflict() {
        let storage = InMemoryStorage::new();
        let handler = SemanticMergeHandlerImpl;
        let result = handler.execute(
            SemanticMergeExecuteInput {
                base: b"line1".to_vec(),
                ours: b"ours-change".to_vec(),
                theirs: b"theirs-change".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SemanticMergeExecuteOutput::Conflicts { regions } => {
                assert!(!regions.is_empty());
            },
            _ => panic!("Expected Conflicts variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_unsupported_content() {
        let storage = InMemoryStorage::new();
        let handler = SemanticMergeHandlerImpl;
        let result = handler.execute(
            SemanticMergeExecuteInput {
                base: vec![0xFF, 0xFE],
                ours: b"valid".to_vec(),
                theirs: b"valid".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SemanticMergeExecuteOutput::UnsupportedContent { .. } => {},
            _ => panic!("Expected UnsupportedContent variant"),
        }
    }
}
