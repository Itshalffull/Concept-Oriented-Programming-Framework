// Token Concept Implementation (Rust) — Computation kit
//
// Replaces token patterns like [node:field] in text, scans for
// token patterns, and manages token-type provider registrations.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Replace ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenReplaceInput {
    pub text: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TokenReplaceOutput {
    #[serde(rename = "ok")]
    Ok { result: String },
}

// ── GetAvailableTokens ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenGetAvailableTokensInput {
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TokenGetAvailableTokensOutput {
    #[serde(rename = "ok")]
    Ok { tokens: String },
}

// ── Scan ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenScanInput {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TokenScanOutput {
    #[serde(rename = "ok")]
    Ok { matches: String },
}

// ── RegisterProvider ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenRegisterProviderInput {
    pub token_type: String,
    pub resolver_config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TokenRegisterProviderOutput {
    #[serde(rename = "ok")]
    Ok { token_type: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct ComputationTokenHandler;

impl ComputationTokenHandler {
    pub async fn replace(
        &self,
        input: TokenReplaceInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TokenReplaceOutput> {
        let providers = storage.find("token_type", None).await?;
        let mut result = input.text.clone();

        // Simple token replacement: find [type:field] patterns and replace
        for provider in &providers {
            let token_type = provider["token_type"].as_str().unwrap_or("");
            let prefix = format!("[{}:", token_type);
            let mut search_start = 0;
            while search_start < result.len() {
                if let Some(rel_start) = result[search_start..].find(&prefix) {
                    let abs_start = search_start + rel_start;
                    if let Some(rel_end) = result[abs_start..].find(']') {
                        let token = result[abs_start..abs_start + rel_end + 1].to_string();
                        let replacement = format!("{{resolved:{}}}", token);
                        result = format!(
                            "{}{}{}",
                            &result[..abs_start],
                            replacement,
                            &result[abs_start + rel_end + 1..]
                        );
                        search_start = abs_start + replacement.len();
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
        }

        Ok(TokenReplaceOutput::Ok { result })
    }

    pub async fn get_available_tokens(
        &self,
        _input: TokenGetAvailableTokensInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TokenGetAvailableTokensOutput> {
        let providers = storage.find("token_type", None).await?;
        let tokens: Vec<String> = providers
            .iter()
            .filter_map(|p| p["token_type"].as_str().map(String::from))
            .collect();
        Ok(TokenGetAvailableTokensOutput::Ok {
            tokens: serde_json::to_string(&tokens)?,
        })
    }

    pub async fn scan(
        &self,
        input: TokenScanInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<TokenScanOutput> {
        let mut matches = Vec::new();
        let text = &input.text;
        let mut pos = 0;

        while pos < text.len() {
            if let Some(start) = text[pos..].find('[') {
                let abs_start = pos + start;
                if let Some(end) = text[abs_start..].find(']') {
                    let token = &text[abs_start..abs_start + end + 1];
                    // Check if it looks like a token pattern [type:field]
                    if token.contains(':') {
                        matches.push(token.to_string());
                    }
                    pos = abs_start + end + 1;
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        Ok(TokenScanOutput::Ok {
            matches: serde_json::to_string(&matches)?,
        })
    }

    pub async fn register_provider(
        &self,
        input: TokenRegisterProviderInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TokenRegisterProviderOutput> {
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "token_type",
                &input.token_type,
                json!({
                    "token_type": input.token_type,
                    "resolver_config": input.resolver_config,
                    "registered_at": now,
                }),
            )
            .await?;
        Ok(TokenRegisterProviderOutput::Ok {
            token_type: input.token_type,
        })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // --- replace ---

    #[tokio::test]
    async fn replace_returns_text_unchanged_when_no_matching_tokens() {
        let storage = InMemoryStorage::new();
        let handler = ComputationTokenHandler;

        // Register a provider for "node" type
        handler
            .register_provider(
                TokenRegisterProviderInput {
                    token_type: "node".into(),
                    resolver_config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        // Input text has no [node:...] patterns, so replace should return it unchanged
        let result = handler
            .replace(
                TokenReplaceInput {
                    text: "Title: plain text without tokens".into(),
                    context: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            TokenReplaceOutput::Ok { result } => {
                assert_eq!(result, "Title: plain text without tokens");
            }
        }
    }

    #[tokio::test]
    async fn replace_leaves_text_unchanged_when_no_providers() {
        let storage = InMemoryStorage::new();
        let handler = ComputationTokenHandler;

        let result = handler
            .replace(
                TokenReplaceInput {
                    text: "No tokens here".into(),
                    context: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            TokenReplaceOutput::Ok { result } => {
                assert_eq!(result, "No tokens here");
            }
        }
    }

    // --- get_available_tokens ---

    #[tokio::test]
    async fn get_available_tokens_returns_registered_types() {
        let storage = InMemoryStorage::new();
        let handler = ComputationTokenHandler;

        handler
            .register_provider(
                TokenRegisterProviderInput {
                    token_type: "user".into(),
                    resolver_config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .get_available_tokens(
                TokenGetAvailableTokensInput { context: "{}".into() },
                &storage,
            )
            .await
            .unwrap();

        match result {
            TokenGetAvailableTokensOutput::Ok { tokens } => {
                let parsed: Vec<String> = serde_json::from_str(&tokens).unwrap();
                assert!(parsed.contains(&"user".to_string()));
            }
        }
    }

    #[tokio::test]
    async fn get_available_tokens_empty_when_none_registered() {
        let storage = InMemoryStorage::new();
        let handler = ComputationTokenHandler;

        let result = handler
            .get_available_tokens(
                TokenGetAvailableTokensInput { context: "{}".into() },
                &storage,
            )
            .await
            .unwrap();

        match result {
            TokenGetAvailableTokensOutput::Ok { tokens } => {
                let parsed: Vec<String> = serde_json::from_str(&tokens).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }

    // --- scan ---

    #[tokio::test]
    async fn scan_finds_token_patterns() {
        let storage = InMemoryStorage::new();
        let handler = ComputationTokenHandler;

        let result = handler
            .scan(
                TokenScanInput {
                    text: "Hello [user:name], your [node:title] is ready".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            TokenScanOutput::Ok { matches } => {
                let parsed: Vec<String> = serde_json::from_str(&matches).unwrap();
                assert_eq!(parsed.len(), 2);
                assert!(parsed.contains(&"[user:name]".to_string()));
                assert!(parsed.contains(&"[node:title]".to_string()));
            }
        }
    }

    #[tokio::test]
    async fn scan_returns_empty_for_no_tokens() {
        let storage = InMemoryStorage::new();
        let handler = ComputationTokenHandler;

        let result = handler
            .scan(
                TokenScanInput {
                    text: "Plain text without tokens".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            TokenScanOutput::Ok { matches } => {
                let parsed: Vec<String> = serde_json::from_str(&matches).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }

    // --- register_provider ---

    #[tokio::test]
    async fn register_provider_stores_provider() {
        let storage = InMemoryStorage::new();
        let handler = ComputationTokenHandler;

        let result = handler
            .register_provider(
                TokenRegisterProviderInput {
                    token_type: "date".into(),
                    resolver_config: r#"{"format":"iso"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            TokenRegisterProviderOutput::Ok { token_type } => {
                assert_eq!(token_type, "date");
            }
        }

        let record = storage.get("token_type", "date").await.unwrap();
        assert!(record.is_some());
    }

    #[tokio::test]
    async fn register_provider_overwrites_existing() {
        let storage = InMemoryStorage::new();
        let handler = ComputationTokenHandler;

        handler
            .register_provider(
                TokenRegisterProviderInput {
                    token_type: "custom".into(),
                    resolver_config: "v1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .register_provider(
                TokenRegisterProviderInput {
                    token_type: "custom".into(),
                    resolver_config: "v2".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("token_type", "custom").await.unwrap().unwrap();
        assert_eq!(record["resolver_config"].as_str().unwrap(), "v2");
    }
}
