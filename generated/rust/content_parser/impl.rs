// ContentParser Handler Implementation
//
// Pluggable content parser with format registration, extractors for
// refs ([[link]]), tags (#tag), and properties (key:: value).
// Parses text into ASTs and caches them for extraction queries.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ContentParserHandler;
use serde_json::json;
use regex::Regex;

pub struct ContentParserHandlerImpl;

#[async_trait]
impl ContentParserHandler for ContentParserHandlerImpl {
    async fn register_format(
        &self,
        input: ContentParserRegisterFormatInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserRegisterFormatOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("format", &input.name).await?;
        if existing.is_some() {
            return Ok(ContentParserRegisterFormatOutput::Exists {
                message: "already exists".to_string(),
            });
        }
        storage.put("format", &input.name, json!({
            "name": input.name,
            "grammar": input.grammar,
        })).await?;
        Ok(ContentParserRegisterFormatOutput::Ok { name: input.name })
    }

    async fn register_extractor(
        &self,
        input: ContentParserRegisterExtractorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserRegisterExtractorOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("extractor", &input.name).await?;
        if existing.is_some() {
            return Ok(ContentParserRegisterExtractorOutput::Exists {
                message: "already exists".to_string(),
            });
        }
        storage.put("extractor", &input.name, json!({
            "name": input.name,
            "pattern": input.pattern,
        })).await?;
        Ok(ContentParserRegisterExtractorOutput::Ok { name: input.name })
    }

    async fn parse(
        &self,
        input: ContentParserParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserParseOutput, Box<dyn std::error::Error>> {
        let format_record = storage.get("format", &input.format).await?;
        if format_record.is_none() {
            return Ok(ContentParserParseOutput::Error {
                message: "Format not registered".to_string(),
            });
        }

        let text = &input.text;

        // Extract [[refs]]
        let ref_re = Regex::new(r"\[\[([^\]]+)\]\]")?;
        let refs: Vec<String> = ref_re.captures_iter(text)
            .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
            .collect();

        // Extract #tags
        let tag_re = Regex::new(r"#(\w+)")?;
        let tags: Vec<String> = tag_re.captures_iter(text)
            .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
            .collect();

        // Extract properties (key:: value)
        let prop_re = Regex::new(r"(\w+)::\s*(.+)")?;
        let mut properties = serde_json::Map::new();
        for cap in prop_re.captures_iter(text) {
            if let (Some(key), Some(val)) = (cap.get(1), cap.get(2)) {
                properties.insert(
                    key.as_str().to_string(),
                    json!(val.as_str().trim()),
                );
            }
        }

        let ast = json!({
            "text": text,
            "format": input.format,
            "refs": refs,
            "tags": tags,
            "properties": properties,
        });
        let ast_str = serde_json::to_string(&ast)?;

        storage.put("ast", &input.content, json!({
            "content": input.content,
            "ast": ast_str,
            "format": input.format,
        })).await?;

        Ok(ContentParserParseOutput::Ok { ast: ast_str })
    }

    async fn extract_refs(
        &self,
        input: ContentParserExtractRefsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserExtractRefsOutput, Box<dyn std::error::Error>> {
        let ast_record = storage.get("ast", &input.content).await?;
        match ast_record {
            None => Ok(ContentParserExtractRefsOutput::Notfound {
                message: "No AST cached for this content".to_string(),
            }),
            Some(rec) => {
                let ast: serde_json::Value = serde_json::from_str(
                    rec["ast"].as_str().unwrap_or("{}")
                )?;
                Ok(ContentParserExtractRefsOutput::Ok {
                    refs: serde_json::to_string(&ast["refs"])?,
                })
            }
        }
    }

    async fn extract_tags(
        &self,
        input: ContentParserExtractTagsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserExtractTagsOutput, Box<dyn std::error::Error>> {
        let ast_record = storage.get("ast", &input.content).await?;
        match ast_record {
            None => Ok(ContentParserExtractTagsOutput::Notfound {
                message: "No AST cached for this content".to_string(),
            }),
            Some(rec) => {
                let ast: serde_json::Value = serde_json::from_str(
                    rec["ast"].as_str().unwrap_or("{}")
                )?;
                Ok(ContentParserExtractTagsOutput::Ok {
                    tags: serde_json::to_string(&ast["tags"])?,
                })
            }
        }
    }

    async fn extract_properties(
        &self,
        input: ContentParserExtractPropertiesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserExtractPropertiesOutput, Box<dyn std::error::Error>> {
        let ast_record = storage.get("ast", &input.content).await?;
        match ast_record {
            None => Ok(ContentParserExtractPropertiesOutput::Notfound {
                message: "No AST cached for this content".to_string(),
            }),
            Some(rec) => {
                let ast: serde_json::Value = serde_json::from_str(
                    rec["ast"].as_str().unwrap_or("{}")
                )?;
                Ok(ContentParserExtractPropertiesOutput::Ok {
                    properties: serde_json::to_string(&ast["properties"])?,
                })
            }
        }
    }

    async fn serialize(
        &self,
        input: ContentParserSerializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserSerializeOutput, Box<dyn std::error::Error>> {
        let ast_record = storage.get("ast", &input.content).await?;
        match ast_record {
            None => Ok(ContentParserSerializeOutput::Notfound {
                message: "No AST cached for this content".to_string(),
            }),
            Some(rec) => {
                let ast: serde_json::Value = serde_json::from_str(
                    rec["ast"].as_str().unwrap_or("{}")
                )?;
                let text = ast["text"].as_str().unwrap_or("").to_string();
                Ok(ContentParserSerializeOutput::Ok { text })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_format_success() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandlerImpl;
        let result = handler.register_format(
            ContentParserRegisterFormatInput {
                name: "markdown".to_string(),
                grammar: "md-grammar".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ContentParserRegisterFormatOutput::Ok { name } => {
                assert_eq!(name, "markdown");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_format_exists() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandlerImpl;

        handler.register_format(
            ContentParserRegisterFormatInput { name: "md".to_string(), grammar: "g".to_string() },
            &storage,
        ).await.unwrap();

        let result = handler.register_format(
            ContentParserRegisterFormatInput { name: "md".to_string(), grammar: "g".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentParserRegisterFormatOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_register_extractor_success() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandlerImpl;
        let result = handler.register_extractor(
            ContentParserRegisterExtractorInput {
                name: "ref-extractor".to_string(),
                pattern: r"\[\[.*\]\]".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ContentParserRegisterExtractorOutput::Ok { name } => {
                assert_eq!(name, "ref-extractor");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_format_not_registered() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandlerImpl;
        let result = handler.parse(
            ContentParserParseInput {
                content: "doc-1".to_string(),
                text: "Hello".to_string(),
                format: "unknown-format".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ContentParserParseOutput::Error { message } => {
                assert!(message.contains("not registered"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_with_refs_and_tags() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandlerImpl;

        handler.register_format(
            ContentParserRegisterFormatInput { name: "md".to_string(), grammar: "g".to_string() },
            &storage,
        ).await.unwrap();

        let result = handler.parse(
            ContentParserParseInput {
                content: "doc-1".to_string(),
                text: "See [[PageA]] and #important topic:: value".to_string(),
                format: "md".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ContentParserParseOutput::Ok { ast } => {
                assert!(ast.contains("PageA"));
                assert!(ast.contains("important"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_extract_refs_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandlerImpl;
        let result = handler.extract_refs(
            ContentParserExtractRefsInput { content: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentParserExtractRefsOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_extract_tags_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandlerImpl;
        let result = handler.extract_tags(
            ContentParserExtractTagsInput { content: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentParserExtractTagsOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_serialize_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentParserHandlerImpl;
        let result = handler.serialize(
            ContentParserSerializeInput { content: "nonexistent".to_string(), format: "md".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentParserSerializeOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
