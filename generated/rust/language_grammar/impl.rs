// Language grammar implementation
// Manages tree-sitter grammar registrations for source languages.
// Resolves grammars by file extension or MIME type, stores parser
// WASM paths and node type definitions.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::LanguageGrammarHandler;
use serde_json::json;

pub struct LanguageGrammarHandlerImpl;

#[async_trait]
impl LanguageGrammarHandler for LanguageGrammarHandlerImpl {
    async fn register(
        &self,
        input: LanguageGrammarRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LanguageGrammarRegisterOutput, Box<dyn std::error::Error>> {
        if let Some(_) = storage.get("grammar", &input.name).await? {
            return Ok(LanguageGrammarRegisterOutput::AlreadyRegistered {
                existing: input.name,
            });
        }

        // Parse extensions as comma-separated list and store mappings
        let extensions: Vec<&str> = input.extensions.split(',').map(|s| s.trim()).collect();

        storage.put("grammar", &input.name, json!({
            "name": input.name,
            "extensions": input.extensions,
            "parserWasmPath": input.parser_wasm_path,
            "nodeTypes": input.node_types,
        })).await?;

        // Register extension -> grammar mappings
        for ext in &extensions {
            let ext_clean = ext.trim_start_matches('.');
            storage.put("ext-grammar", ext_clean, json!({
                "grammar": input.name,
                "extension": ext_clean,
            })).await?;
        }

        Ok(LanguageGrammarRegisterOutput::Ok {
            grammar: input.name,
        })
    }

    async fn resolve(
        &self,
        input: LanguageGrammarResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LanguageGrammarResolveOutput, Box<dyn std::error::Error>> {
        let ext = input.file_extension.trim_start_matches('.');

        match storage.get("ext-grammar", ext).await? {
            Some(mapping) => {
                let grammar = mapping.get("grammar")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                Ok(LanguageGrammarResolveOutput::Ok { grammar })
            }
            None => Ok(LanguageGrammarResolveOutput::NoGrammar {
                extension: input.file_extension,
            }),
        }
    }

    async fn resolve_by_mime(
        &self,
        input: LanguageGrammarResolveByMimeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LanguageGrammarResolveByMimeOutput, Box<dyn std::error::Error>> {
        // Map common MIME types to file extensions
        let ext = match input.mime_type.as_str() {
            "text/javascript" | "application/javascript" => "js",
            "text/typescript" | "application/typescript" => "ts",
            "text/x-python" | "application/x-python" => "py",
            "text/x-rust" => "rs",
            "text/x-go" => "go",
            "text/x-java" => "java",
            "text/x-c" => "c",
            "text/x-c++" => "cpp",
            "text/html" => "html",
            "text/css" => "css",
            "application/json" => "json",
            "text/yaml" | "application/yaml" => "yaml",
            "text/markdown" => "md",
            _ => "",
        };

        if ext.is_empty() {
            return Ok(LanguageGrammarResolveByMimeOutput::NoGrammar {
                mime_type: input.mime_type,
            });
        }

        match storage.get("ext-grammar", ext).await? {
            Some(mapping) => {
                let grammar = mapping.get("grammar")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                Ok(LanguageGrammarResolveByMimeOutput::Ok { grammar })
            }
            None => Ok(LanguageGrammarResolveByMimeOutput::NoGrammar {
                mime_type: input.mime_type,
            }),
        }
    }

    async fn get(
        &self,
        input: LanguageGrammarGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LanguageGrammarGetOutput, Box<dyn std::error::Error>> {
        match storage.get("grammar", &input.grammar).await? {
            Some(record) => Ok(LanguageGrammarGetOutput::Ok {
                grammar: input.grammar,
                name: record.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                extensions: record.get("extensions").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                parser_wasm_path: record.get("parserWasmPath").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            }),
            None => Ok(LanguageGrammarGetOutput::Notfound {
                message: format!("Grammar '{}' not found", input.grammar),
            }),
        }
    }

    async fn list(
        &self,
        _input: LanguageGrammarListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LanguageGrammarListOutput, Box<dyn std::error::Error>> {
        let grammars = storage.find("grammar", None).await?;
        let grammar_list: Vec<String> = grammars.iter()
            .filter_map(|g| g.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .collect();

        Ok(LanguageGrammarListOutput::Ok {
            grammars: serde_json::to_string(&grammar_list)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_grammar() {
        let storage = InMemoryStorage::new();
        let handler = LanguageGrammarHandlerImpl;
        let result = handler.register(
            LanguageGrammarRegisterInput {
                name: "typescript".into(),
                extensions: ".ts,.tsx".into(),
                parser_wasm_path: "/parsers/typescript.wasm".into(),
                node_types: "{}".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            LanguageGrammarRegisterOutput::Ok { grammar } => assert_eq!(grammar, "typescript"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = LanguageGrammarHandlerImpl;
        handler.register(
            LanguageGrammarRegisterInput {
                name: "rust".into(),
                extensions: ".rs".into(),
                parser_wasm_path: "/parsers/rust.wasm".into(),
                node_types: "{}".into(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register(
            LanguageGrammarRegisterInput {
                name: "rust".into(),
                extensions: ".rs".into(),
                parser_wasm_path: "/parsers/rust.wasm".into(),
                node_types: "{}".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            LanguageGrammarRegisterOutput::AlreadyRegistered { existing } => assert_eq!(existing, "rust"),
            _ => panic!("Expected AlreadyRegistered variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_by_extension() {
        let storage = InMemoryStorage::new();
        let handler = LanguageGrammarHandlerImpl;
        handler.register(
            LanguageGrammarRegisterInput {
                name: "python".into(),
                extensions: ".py".into(),
                parser_wasm_path: "/parsers/python.wasm".into(),
                node_types: "{}".into(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.resolve(
            LanguageGrammarResolveInput { file_extension: ".py".into() },
            &storage,
        ).await.unwrap();
        match result {
            LanguageGrammarResolveOutput::Ok { grammar } => assert_eq!(grammar, "python"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_no_grammar() {
        let storage = InMemoryStorage::new();
        let handler = LanguageGrammarHandlerImpl;
        let result = handler.resolve(
            LanguageGrammarResolveInput { file_extension: ".xyz".into() },
            &storage,
        ).await.unwrap();
        match result {
            LanguageGrammarResolveOutput::NoGrammar { .. } => {}
            _ => panic!("Expected NoGrammar variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_by_mime_no_grammar() {
        let storage = InMemoryStorage::new();
        let handler = LanguageGrammarHandlerImpl;
        let result = handler.resolve_by_mime(
            LanguageGrammarResolveByMimeInput { mime_type: "application/octet-stream".into() },
            &storage,
        ).await.unwrap();
        match result {
            LanguageGrammarResolveByMimeOutput::NoGrammar { .. } => {}
            _ => panic!("Expected NoGrammar variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = LanguageGrammarHandlerImpl;
        let result = handler.get(
            LanguageGrammarGetInput { grammar: "nonexistent".into() },
            &storage,
        ).await.unwrap();
        match result {
            LanguageGrammarGetOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_list_empty() {
        let storage = InMemoryStorage::new();
        let handler = LanguageGrammarHandlerImpl;
        let result = handler.list(
            LanguageGrammarListInput {},
            &storage,
        ).await.unwrap();
        match result {
            LanguageGrammarListOutput::Ok { grammars } => {
                assert_eq!(grammars, "[]");
            }
        }
    }
}
