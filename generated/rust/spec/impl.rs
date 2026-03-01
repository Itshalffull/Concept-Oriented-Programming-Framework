// Spec concept: emits and validates specification documents in multiple formats.
// Supports OpenAPI, AsyncAPI, JSON Schema, GraphQL Schema, and Protobuf formats.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SpecHandler;
use serde_json::json;

pub struct SpecHandlerImpl;

const KNOWN_FORMATS: &[&str] = &["openapi", "asyncapi", "jsonschema", "graphql-schema", "protobuf"];

fn generate_content(format: &str, projections: &[String], suite_name: &str, version: &str) -> String {
    match format {
        "openapi" => {
            let mut paths = serde_json::Map::new();
            for proj in projections {
                let mut methods = serde_json::Map::new();
                methods.insert("get".to_string(), json!({"summary": format!("List {}", proj), "operationId": format!("list_{}", proj)}));
                methods.insert("post".to_string(), json!({"summary": format!("Create {}", proj), "operationId": format!("create_{}", proj)}));
                paths.insert(format!("/{}", proj), serde_json::Value::Object(methods));
            }
            serde_json::to_string_pretty(&json!({
                "openapi": "3.0.3",
                "info": {"title": format!("{} API", suite_name), "version": version},
                "paths": paths,
            })).unwrap_or_default()
        }
        "asyncapi" => {
            let mut channels = serde_json::Map::new();
            for proj in projections {
                channels.insert(proj.clone(), json!({"subscribe": {"summary": format!("{} events", proj)}}));
            }
            serde_json::to_string_pretty(&json!({
                "asyncapi": "2.6.0",
                "info": {"title": format!("{} Events", suite_name), "version": version},
                "channels": channels,
            })).unwrap_or_default()
        }
        "jsonschema" => {
            let mut properties = serde_json::Map::new();
            for proj in projections {
                properties.insert(proj.clone(), json!({"type": "object"}));
            }
            serde_json::to_string_pretty(&json!({
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "title": suite_name,
                "type": "object",
                "properties": properties,
            })).unwrap_or_default()
        }
        "graphql-schema" => {
            projections.iter()
                .map(|p| format!("type {} {{\n  id: ID!\n}}", p))
                .collect::<Vec<_>>()
                .join("\n\n")
        }
        "protobuf" => {
            let messages = projections.iter()
                .map(|p| format!("message {} {{\n  string id = 1;\n}}", p))
                .collect::<Vec<_>>()
                .join("\n\n");
            format!("syntax = \"proto3\";\n\npackage {};\n\n{}", suite_name, messages)
        }
        _ => String::new(),
    }
}

#[async_trait]
impl SpecHandler for SpecHandlerImpl {
    async fn emit(
        &self,
        input: SpecEmitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SpecEmitOutput, Box<dyn std::error::Error>> {
        let projections: Vec<String> = serde_json::from_str(&input.projections.first().map(|s| s.as_str()).unwrap_or("[]"))
            .unwrap_or_else(|_| input.projections.clone());
        let format = &input.format;
        let config: serde_json::Value = serde_json::from_str(&input.config).unwrap_or(json!({}));

        if !KNOWN_FORMATS.contains(&format.as_str()) {
            return Ok(SpecEmitOutput::FormatError {
                format: format.clone(),
                reason: format!(
                    "Unknown specification format: \"{}\". Supported: {}",
                    format,
                    KNOWN_FORMATS.join(", ")
                ),
            });
        }

        let suite_name = config["kit"].as_str().unwrap_or("default");
        let version = config["version"].as_str().unwrap_or("1.0.0");
        let content = generate_content(format, &projections, suite_name, version);

        let document_id = format!("spec-{}-{}-{}", format, suite_name, chrono_stub());

        storage.put("document", &document_id, json!({
            "documentId": &document_id,
            "format": format,
            "suiteName": suite_name,
            "version": version,
            "content": &content,
        })).await?;

        Ok(SpecEmitOutput::Ok {
            document: document_id,
            content,
        })
    }

    async fn validate(
        &self,
        input: SpecValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SpecValidateOutput, Box<dyn std::error::Error>> {
        let document = &input.document;

        let existing = storage.get("document", document).await?;
        let existing = match existing {
            Some(v) => v,
            None => {
                return Ok(SpecValidateOutput::Invalid {
                    document: document.clone(),
                    errors: vec!["Document not found".to_string()],
                });
            }
        };

        let format = existing["format"].as_str().unwrap_or("");
        let content = existing["content"].as_str().unwrap_or("");
        let mut errors = Vec::new();

        match format {
            "openapi" | "asyncapi" | "jsonschema" => {
                match serde_json::from_str::<serde_json::Value>(content) {
                    Ok(parsed) => {
                        if format == "openapi" && parsed.get("openapi").is_none() {
                            errors.push("Missing required \"openapi\" version field".to_string());
                        }
                        if format == "openapi" && parsed.get("info").is_none() {
                            errors.push("Missing required \"info\" field".to_string());
                        }
                        if format == "asyncapi" && parsed.get("asyncapi").is_none() {
                            errors.push("Missing required \"asyncapi\" version field".to_string());
                        }
                        if format == "jsonschema" && parsed.get("$schema").is_none() {
                            errors.push("Missing required \"$schema\" field".to_string());
                        }
                    }
                    Err(_) => {
                        errors.push("Invalid JSON structure".to_string());
                    }
                }
            }
            "protobuf" => {
                if !content.contains("syntax") {
                    errors.push("Missing syntax declaration".to_string());
                }
            }
            _ => {}
        }

        if !errors.is_empty() {
            return Ok(SpecValidateOutput::Invalid {
                document: document.clone(),
                errors,
            });
        }

        Ok(SpecValidateOutput::Ok {
            document: document.clone(),
        })
    }
}

fn chrono_stub() -> u64 {
    // Monotonic timestamp stub for document ID generation
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_emit_openapi() {
        let storage = InMemoryStorage::new();
        let handler = SpecHandlerImpl;
        let result = handler.emit(
            SpecEmitInput {
                projections: vec!["users".to_string(), "posts".to_string()],
                format: "openapi".to_string(),
                config: r#"{"kit":"test-kit","version":"1.0.0"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SpecEmitOutput::Ok { document, content } => {
                assert!(!document.is_empty());
                assert!(content.contains("openapi"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_emit_unknown_format() {
        let storage = InMemoryStorage::new();
        let handler = SpecHandlerImpl;
        let result = handler.emit(
            SpecEmitInput {
                projections: vec!["users".to_string()],
                format: "unknown-format".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SpecEmitOutput::FormatError { format, reason } => {
                assert_eq!(format, "unknown-format");
                assert!(reason.contains("Unknown specification format"));
            },
            _ => panic!("Expected FormatError variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_existing_document() {
        let storage = InMemoryStorage::new();
        let handler = SpecHandlerImpl;
        // First emit a document
        let emit_result = handler.emit(
            SpecEmitInput {
                projections: vec!["users".to_string()],
                format: "openapi".to_string(),
                config: r#"{"kit":"test"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let doc_id = match emit_result {
            SpecEmitOutput::Ok { document, .. } => document,
            _ => panic!("Expected Ok from emit"),
        };
        // Now validate it
        let result = handler.validate(
            SpecValidateInput { document: doc_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            SpecValidateOutput::Ok { document } => {
                assert_eq!(document, doc_id);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_missing_document() {
        let storage = InMemoryStorage::new();
        let handler = SpecHandlerImpl;
        let result = handler.validate(
            SpecValidateInput { document: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SpecValidateOutput::Invalid { errors, .. } => {
                assert!(errors.iter().any(|e| e.contains("not found")));
            },
            _ => panic!("Expected Invalid variant"),
        }
    }
}
