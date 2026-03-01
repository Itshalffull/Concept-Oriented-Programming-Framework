// WidgetSpecSymbolExtractor Handler Implementation
//
// Symbol extraction provider for .widget spec files. Extracts
// widget name, anatomy part names, state names, transition events,
// prop names, slot names, composed widget references, and
// affordance interactor bindings as symbols in the surface/* namespace.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WidgetSpecSymbolExtractorHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("widget-spec-symbol-extractor-{}", n)
}

pub struct WidgetSpecSymbolExtractorHandlerImpl;

#[async_trait]
impl WidgetSpecSymbolExtractorHandler for WidgetSpecSymbolExtractorHandlerImpl {
    async fn initialize(
        &self,
        _input: WidgetSpecSymbolExtractorInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetSpecSymbolExtractorInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        match storage.put("widget-spec-symbol-extractor", &id, json!({
            "id": id,
            "extractorRef": "widget-spec-symbol-extractor",
            "handledExtensions": ".widget",
            "language": "widget-spec"
        })).await {
            Ok(_) => Ok(WidgetSpecSymbolExtractorInitializeOutput::Ok {
                instance: id,
            }),
            Err(e) => Ok(WidgetSpecSymbolExtractorInitializeOutput::LoadError {
                message: e.to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = WidgetSpecSymbolExtractorHandlerImpl;
        let result = handler.initialize(
            WidgetSpecSymbolExtractorInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            WidgetSpecSymbolExtractorInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("widget-spec-symbol-extractor"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
