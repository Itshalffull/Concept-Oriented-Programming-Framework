// Symbol index provider: initializes a symbol-aware search index
// for fast symbol resolution and lookup by name, kind, and namespace.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SymbolIndexProviderHandler;
use serde_json::json;

pub struct SymbolIndexProviderHandlerImpl;

static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    format!("symbol-index-{}", n)
}

#[async_trait]
impl SymbolIndexProviderHandler for SymbolIndexProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: SymbolIndexProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolIndexProviderInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        storage.put("symbol-index", &id, json!({
            "id": &id,
            "providerRef": &id,
            "indexType": "symbol-aware",
        })).await?;

        Ok(SymbolIndexProviderInitializeOutput::Ok {
            instance: id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize() {
        let storage = InMemoryStorage::new();
        let handler = SymbolIndexProviderHandlerImpl;
        let result = handler.initialize(
            SymbolIndexProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            SymbolIndexProviderInitializeOutput::Ok { instance } => {
                assert!(instance.starts_with("symbol-index-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = SymbolIndexProviderHandlerImpl;
        let r1 = handler.initialize(SymbolIndexProviderInitializeInput {}, &storage).await.unwrap();
        let r2 = handler.initialize(SymbolIndexProviderInitializeInput {}, &storage).await.unwrap();
        let id1 = match r1 { SymbolIndexProviderInitializeOutput::Ok { instance } => instance, _ => panic!("Expected Ok") };
        let id2 = match r2 { SymbolIndexProviderInitializeOutput::Ok { instance } => instance, _ => panic!("Expected Ok") };
        assert_ne!(id1, id2);
    }
}
