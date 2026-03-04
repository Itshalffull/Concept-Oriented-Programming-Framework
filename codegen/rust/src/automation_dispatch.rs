// AutomationDispatch Concept Implementation (Rust)
//
// Automation providers suite — dispatches automation actions to registered
// providers and lists available providers. Acts as the central routing
// point between automation rules and their concrete providers.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

// ── Dispatch ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DispatchInput {
    pub rule_ref: String,
    pub provider_name: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DispatchOutput {
    #[serde(rename = "ok")]
    Ok { dispatch: String, result: String },
    #[serde(rename = "no_provider")]
    NoProvider { provider_name: String },
    #[serde(rename = "provider_error")]
    ProviderError {
        provider_name: String,
        message: String,
    },
}

// ── ListProviders ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ListProvidersInput {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ListProvidersOutput {
    #[serde(rename = "ok")]
    Ok { providers: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct AutomationDispatchHandler {
    counter: AtomicU64,
}

impl AutomationDispatchHandler {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(0),
        }
    }

    pub async fn dispatch(
        &self,
        input: DispatchInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DispatchOutput> {
        // Look up the provider by name
        let providers = storage
            .find(
                "automation_provider",
                Some(&json!({ "provider_name": input.provider_name })),
            )
            .await?;

        if providers.is_empty() {
            return Ok(DispatchOutput::NoProvider {
                provider_name: input.provider_name,
            });
        }

        let provider = &providers[0];
        let status = provider["status"].as_str().unwrap_or("unknown");

        if status != "active" {
            return Ok(DispatchOutput::ProviderError {
                provider_name: input.provider_name,
                message: format!("provider is not active (status: {})", status),
            });
        }

        let id = self.counter.fetch_add(1, Ordering::SeqCst);
        let dispatch_id = format!("dispatch-{}", id);

        // Record the dispatch
        storage
            .put(
                "automation_dispatch",
                &dispatch_id,
                json!({
                    "dispatch": dispatch_id,
                    "ruleRef": input.rule_ref,
                    "providerName": input.provider_name,
                    "context": input.context,
                    "result": "dispatched",
                }),
            )
            .await?;

        Ok(DispatchOutput::Ok {
            dispatch: dispatch_id,
            result: "dispatched".to_string(),
        })
    }

    pub async fn list_providers(
        &self,
        _input: ListProvidersInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ListProvidersOutput> {
        let providers = storage.find("automation_provider", None).await?;
        let providers_json = serde_json::to_string(&providers)?;
        Ok(ListProvidersOutput::Ok {
            providers: providers_json,
        })
    }
}

// ── Tests ─────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    async fn register_provider(storage: &InMemoryStorage, name: &str, status: &str) {
        storage
            .put(
                "automation_provider",
                name,
                json!({
                    "provider_name": name,
                    "status": status,
                }),
            )
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn dispatch_routes_to_active_provider() {
        let storage = InMemoryStorage::new();
        let handler = AutomationDispatchHandler::new();

        register_provider(&storage, "manifest", "active").await;

        let result = handler
            .dispatch(
                DispatchInput {
                    rule_ref: "rule-1".into(),
                    provider_name: "manifest".into(),
                    context: r#"{"action":"build"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            DispatchOutput::Ok { dispatch, result } => {
                assert!(dispatch.starts_with("dispatch-"));
                assert_eq!(result, "dispatched");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn dispatch_returns_no_provider_when_missing() {
        let storage = InMemoryStorage::new();
        let handler = AutomationDispatchHandler::new();

        let result = handler
            .dispatch(
                DispatchInput {
                    rule_ref: "rule-1".into(),
                    provider_name: "nonexistent".into(),
                    context: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            DispatchOutput::NoProvider { provider_name } => {
                assert_eq!(provider_name, "nonexistent");
            }
            _ => panic!("expected NoProvider variant"),
        }
    }

    #[tokio::test]
    async fn dispatch_returns_provider_error_when_inactive() {
        let storage = InMemoryStorage::new();
        let handler = AutomationDispatchHandler::new();

        register_provider(&storage, "sync", "suspended").await;

        let result = handler
            .dispatch(
                DispatchInput {
                    rule_ref: "rule-2".into(),
                    provider_name: "sync".into(),
                    context: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            DispatchOutput::ProviderError {
                provider_name,
                message,
            } => {
                assert_eq!(provider_name, "sync");
                assert!(message.contains("not active"));
            }
            _ => panic!("expected ProviderError variant"),
        }
    }

    #[tokio::test]
    async fn dispatch_stores_dispatch_record() {
        let storage = InMemoryStorage::new();
        let handler = AutomationDispatchHandler::new();

        register_provider(&storage, "manifest", "active").await;

        let result = handler
            .dispatch(
                DispatchInput {
                    rule_ref: "rule-3".into(),
                    provider_name: "manifest".into(),
                    context: r#"{"key":"val"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        if let DispatchOutput::Ok { dispatch, .. } = result {
            let rec = storage
                .get("automation_dispatch", &dispatch)
                .await
                .unwrap()
                .unwrap();
            assert_eq!(rec["ruleRef"].as_str().unwrap(), "rule-3");
            assert_eq!(rec["providerName"].as_str().unwrap(), "manifest");
        } else {
            panic!("expected Ok variant");
        }
    }

    #[tokio::test]
    async fn list_providers_returns_all_registered() {
        let storage = InMemoryStorage::new();
        let handler = AutomationDispatchHandler::new();

        register_provider(&storage, "manifest", "active").await;
        register_provider(&storage, "sync", "active").await;

        let result = handler
            .list_providers(ListProvidersInput {}, &storage)
            .await
            .unwrap();

        match result {
            ListProvidersOutput::Ok { providers } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&providers).unwrap();
                assert_eq!(parsed.len(), 2);
            }
        }
    }
}
