// ContentParser Concept Implementation (Rust)
//
// Manages content format registration, parsing, and extraction of
// references and tags from content.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- RegisterFormat ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterFormatInput {
    pub format_id: String,
    pub parser_config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RegisterFormatOutput {
    #[serde(rename = "ok")]
    Ok { format_id: String },
    #[serde(rename = "already_exists")]
    AlreadyExists { format_id: String },
}

// --- Parse ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseInput {
    pub content: String,
    pub format_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ParseOutput {
    #[serde(rename = "ok")]
    Ok {
        ast: String,
        extracted_metadata: String,
    },
    #[serde(rename = "unknown_format")]
    UnknownFormat { format_id: String },
}

// --- ExtractRefs ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractRefsInput {
    pub content: String,
    pub format_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ExtractRefsOutput {
    #[serde(rename = "ok")]
    Ok { refs: String },
}

// --- ExtractTags ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractTagsInput {
    pub content: String,
    pub format_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ExtractTagsOutput {
    #[serde(rename = "ok")]
    Ok { tags: String },
}

pub struct ContentParserHandler;

impl ContentParserHandler {
    pub async fn register_format(
        &self,
        input: RegisterFormatInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RegisterFormatOutput> {
        let existing = storage.get("format", &input.format_id).await?;
        if existing.is_some() {
            return Ok(RegisterFormatOutput::AlreadyExists {
                format_id: input.format_id,
            });
        }

        storage
            .put(
                "format",
                &input.format_id,
                json!({
                    "format_id": input.format_id,
                    "parser_config": input.parser_config,
                    "registered_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(RegisterFormatOutput::Ok {
            format_id: input.format_id,
        })
    }

    pub async fn parse(
        &self,
        input: ParseInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ParseOutput> {
        let existing = storage.get("format", &input.format_id).await?;
        if existing.is_none() {
            return Ok(ParseOutput::UnknownFormat {
                format_id: input.format_id,
            });
        }

        // Produce a simple AST representation as JSON
        let ast = json!({
            "type": "document",
            "format": input.format_id,
            "content": input.content,
        });

        let extracted_metadata = json!({
            "length": input.content.len(),
            "format": input.format_id,
        });

        Ok(ParseOutput::Ok {
            ast: serde_json::to_string(&ast)?,
            extracted_metadata: serde_json::to_string(&extracted_metadata)?,
        })
    }

    pub async fn extract_refs(
        &self,
        input: ExtractRefsInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<ExtractRefsOutput> {
        // Extract references: patterns like [[ref]] or [ref](target)
        let mut refs: Vec<String> = Vec::new();

        // Match [[...]] style references
        let content = &input.content;
        let mut start = 0;
        while let Some(open) = content[start..].find("[[") {
            let abs_open = start + open + 2;
            if let Some(close) = content[abs_open..].find("]]") {
                let reference = &content[abs_open..abs_open + close];
                refs.push(reference.to_string());
                start = abs_open + close + 2;
            } else {
                break;
            }
        }

        Ok(ExtractRefsOutput::Ok {
            refs: serde_json::to_string(&refs)?,
        })
    }

    pub async fn extract_tags(
        &self,
        input: ExtractTagsInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<ExtractTagsOutput> {
        // Extract tags: patterns like #tag
        let mut tags: Vec<String> = Vec::new();

        for word in input.content.split_whitespace() {
            if word.starts_with('#') && word.len() > 1 {
                let tag = word.trim_start_matches('#');
                // Strip trailing punctuation
                let tag = tag.trim_end_matches(|c: char| !c.is_alphanumeric() && c != '_' && c != '-');
                if !tag.is_empty() {
                    tags.push(tag.to_string());
                }
            }
        }

        Ok(ExtractTagsOutput::Ok {
            tags: serde_json::to_string(&tags)?,
        })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    async fn register_markdown(handler: &ContentParserHandler, storage: &InMemoryStorage) {
        handler
            .register_format(
                RegisterFormatInput {
                    format_id: "markdown".into(),
                    parser_config: json!({ "type": "markdown" }),
                },
                storage,
            )
            .await
            .unwrap();
    }

    // --- register_format ---

    #[tokio::test]
    async fn register_format_creates_new() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandler;

        let result = handler
            .register_format(
                RegisterFormatInput {
                    format_id: "html".into(),
                    parser_config: json!({ "type": "html" }),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RegisterFormatOutput::Ok { format_id } if format_id == "html"));
    }

    #[tokio::test]
    async fn register_format_duplicate_returns_already_exists() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandler;

        register_markdown(&handler, &storage).await;

        let result = handler
            .register_format(
                RegisterFormatInput {
                    format_id: "markdown".into(),
                    parser_config: json!({}),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RegisterFormatOutput::AlreadyExists { .. }));
    }

    // --- parse ---

    #[tokio::test]
    async fn parse_returns_ast_for_known_format() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandler;

        register_markdown(&handler, &storage).await;

        let result = handler
            .parse(
                ParseInput {
                    content: "# Hello World".into(),
                    format_id: "markdown".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ParseOutput::Ok { ast, extracted_metadata } => {
                assert!(ast.contains("document"));
                assert!(extracted_metadata.contains("markdown"));
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn parse_returns_unknown_format() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandler;

        let result = handler
            .parse(
                ParseInput {
                    content: "test".into(),
                    format_id: "unknown".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ParseOutput::UnknownFormat { .. }));
    }

    // --- extract_refs ---

    #[tokio::test]
    async fn extract_refs_finds_wiki_links() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandler;

        let result = handler
            .extract_refs(
                ExtractRefsInput {
                    content: "See [[PageA]] and [[PageB]] for details".into(),
                    format_id: "markdown".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ExtractRefsOutput::Ok { refs } => {
                let parsed: Vec<String> = serde_json::from_str(&refs).unwrap();
                assert_eq!(parsed.len(), 2);
                assert!(parsed.contains(&"PageA".to_string()));
                assert!(parsed.contains(&"PageB".to_string()));
            }
        }
    }

    #[tokio::test]
    async fn extract_refs_returns_empty_for_no_refs() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandler;

        let result = handler
            .extract_refs(
                ExtractRefsInput {
                    content: "No references here".into(),
                    format_id: "markdown".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ExtractRefsOutput::Ok { refs } => {
                let parsed: Vec<String> = serde_json::from_str(&refs).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }

    // --- extract_tags ---

    #[tokio::test]
    async fn extract_tags_finds_hashtags() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandler;

        let result = handler
            .extract_tags(
                ExtractTagsInput {
                    content: "This is #important and also #urgent stuff".into(),
                    format_id: "markdown".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ExtractTagsOutput::Ok { tags } => {
                let parsed: Vec<String> = serde_json::from_str(&tags).unwrap();
                assert_eq!(parsed.len(), 2);
                assert!(parsed.contains(&"important".to_string()));
                assert!(parsed.contains(&"urgent".to_string()));
            }
        }
    }

    #[tokio::test]
    async fn extract_tags_returns_empty_for_no_tags() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandler;

        let result = handler
            .extract_tags(
                ExtractTagsInput {
                    content: "No tags in this text".into(),
                    format_id: "markdown".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ExtractTagsOutput::Ok { tags } => {
                let parsed: Vec<String> = serde_json::from_str(&tags).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }
}
