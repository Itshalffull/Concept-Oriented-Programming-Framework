// TreeSitterWidgetSpec Handler Implementation
//
// Grammar provider for Clef Surface widget spec files.
// Registers the widget spec parser for .widget file extensions
// with LanguageGrammar.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TreeSitterWidgetSpecHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("tree-sitter-widget-spec-{}", n)
}

pub struct TreeSitterWidgetSpecHandlerImpl;

#[async_trait]
impl TreeSitterWidgetSpecHandler for TreeSitterWidgetSpecHandlerImpl {
    async fn initialize(
        &self,
        _input: TreeSitterWidgetSpecInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TreeSitterWidgetSpecInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();
        storage.put("tree-sitter-widget-spec", &id, json!({
            "id": id,
            "providerRef": id,
            "grammarRef": "tree-sitter-widget-spec",
            "wasmPath": "tree-sitter-widget-spec.wasm",
            "language": "widget-spec",
            "extensions": "[\".widget\"]"
        })).await?;

        Ok(TreeSitterWidgetSpecInitializeOutput::Ok { instance: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterWidgetSpecHandlerImpl;
        let result = handler.initialize(
            TreeSitterWidgetSpecInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            TreeSitterWidgetSpecInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("tree-sitter-widget-spec"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = TreeSitterWidgetSpecHandlerImpl;
        let r1 = handler.initialize(TreeSitterWidgetSpecInitializeInput {}, &storage).await.unwrap();
        let r2 = handler.initialize(TreeSitterWidgetSpecInitializeInput {}, &storage).await.unwrap();
        match (r1, r2) {
            (TreeSitterWidgetSpecInitializeOutput::Ok { instance: id1 },
             TreeSitterWidgetSpecInitializeOutput::Ok { instance: id2 }) => {
                assert_ne!(id1, id2);
            },
            _ => panic!("Expected Ok variants"),
        }
    }
}
