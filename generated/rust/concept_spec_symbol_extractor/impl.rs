// Concept Spec Symbol Extractor -- extract symbol definitions from .concept files
// Initializes a symbol extractor that parses concept specifications to extract
// type names, action names, state fields, and variant names for the symbol index.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ConceptSpecSymbolExtractorHandler;
use serde_json::json;

pub struct ConceptSpecSymbolExtractorHandlerImpl;

#[async_trait]
impl ConceptSpecSymbolExtractorHandler for ConceptSpecSymbolExtractorHandlerImpl {
    async fn initialize(
        &self,
        _input: ConceptSpecSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptSpecSymbolExtractorInitializeOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("symbol_extractor", "concept_spec").await?;
        if let Some(record) = existing {
            if record.get("status").and_then(|v| v.as_str()) == Some("ready") {
                return Ok(ConceptSpecSymbolExtractorInitializeOutput::Ok {
                    instance: record["instance"].as_str().unwrap_or("concept-spec-0").to_string(),
                });
            }
        }

        let instance_id = "concept-spec-symbol-extractor-v1";

        storage.put("symbol_extractor", "concept_spec", json!({
            "instance": instance_id,
            "kind": "concept_spec",
            "status": "ready",
            "supportedExtensions": [".concept"],
            "extractedSymbolKinds": ["type", "action", "state_field", "variant", "type_param"],
            "description": "Extracts symbols from .concept specification files",
        })).await?;

        Ok(ConceptSpecSymbolExtractorInitializeOutput::Ok {
            instance: instance_id.to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = ConceptSpecSymbolExtractorHandlerImpl;
        let result = handler.initialize(
            ConceptSpecSymbolExtractorInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            ConceptSpecSymbolExtractorInitializeOutput::Ok { instance } => {
                assert_eq!(instance, "concept-spec-symbol-extractor-v1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = ConceptSpecSymbolExtractorHandlerImpl;

        handler.initialize(ConceptSpecSymbolExtractorInitializeInput {}, &storage).await.unwrap();
        let result = handler.initialize(ConceptSpecSymbolExtractorInitializeInput {}, &storage).await.unwrap();

        match result {
            ConceptSpecSymbolExtractorInitializeOutput::Ok { instance } => {
                assert_eq!(instance, "concept-spec-symbol-extractor-v1");
            },
            _ => panic!("Expected Ok variant on second call"),
        }
    }
}
