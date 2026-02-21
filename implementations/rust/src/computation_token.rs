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
            while let Some(start) = result.find(&prefix) {
                if let Some(end) = result[start..].find(']') {
                    let token = &result[start..start + end + 1];
                    // Replace token with a context-based placeholder
                    let replacement = format!("{{resolved:{}}}", token);
                    result = result.replace(token, &replacement);
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
