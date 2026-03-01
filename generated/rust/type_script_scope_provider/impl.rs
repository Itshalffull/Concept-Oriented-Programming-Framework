// TypeScriptScopeProvider Handler Implementation
//
// Scope resolution provider for TypeScript and JavaScript files.
// Models module scopes, hoisting, closures, and ES module
// import/export edges.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TypeScriptScopeProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("type-script-scope-provider-{}", n)
}

pub struct TypeScriptScopeProviderHandlerImpl;

#[async_trait]
impl TypeScriptScopeProviderHandler for TypeScriptScopeProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: TypeScriptScopeProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptScopeProviderInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        match storage.put("type-script-scope-provider", &id, json!({
            "id": id,
            "providerRef": "type-script-scope-provider",
            "handledLanguages": "typescript,javascript"
        })).await {
            Ok(_) => Ok(TypeScriptScopeProviderInitializeOutput::Ok {
                instance: id,
            }),
            Err(e) => Ok(TypeScriptScopeProviderInitializeOutput::LoadError {
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
        let handler = TypeScriptScopeProviderHandlerImpl;
        let result = handler.initialize(
            TypeScriptScopeProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            TypeScriptScopeProviderInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("type-script-scope-provider"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = TypeScriptScopeProviderHandlerImpl;
        let r1 = handler.initialize(TypeScriptScopeProviderInitializeInput {}, &storage).await.unwrap();
        let r2 = handler.initialize(TypeScriptScopeProviderInitializeInput {}, &storage).await.unwrap();
        match (r1, r2) {
            (TypeScriptScopeProviderInitializeOutput::Ok { instance: id1 },
             TypeScriptScopeProviderInitializeOutput::Ok { instance: id2 }) => {
                assert_ne!(id1, id2);
            },
            _ => panic!("Expected Ok variants"),
        }
    }
}
