// Token concept implementation
// Replace typed placeholders in text using chain-traversal patterns like [node:author:mail]
// for dynamic content substitution.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TokenHandler;
use serde_json::json;
use std::collections::HashMap;

/// Scan text for all token placeholders [type:chain:path] and return their paths.
fn scan_tokens(text: &str) -> Vec<String> {
    let re = regex::Regex::new(r"\[([a-zA-Z_][a-zA-Z_0-9]*(?::[a-zA-Z_][a-zA-Z_0-9]*)*)\]").unwrap();
    re.captures_iter(text)
        .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
        .collect()
}

/// Built-in token resolution for well-known token paths.
fn resolve_builtin_token(token_path: &str) -> Option<&'static str> {
    let builtins: HashMap<&str, &str> = [
        ("user:mail", "user@example.com"),
        ("user:name", "Example User"),
        ("site:name", "Example Site"),
        ("site:url", "https://example.com"),
    ].iter().cloned().collect();
    builtins.get(token_path).copied()
}

pub struct TokenHandlerImpl;

#[async_trait]
impl TokenHandler for TokenHandlerImpl {
    async fn replace(
        &self,
        input: TokenReplaceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TokenReplaceOutput, Box<dyn std::error::Error>> {
        let tokens = scan_tokens(&input.text);
        let mut result = input.text.clone();

        for token_path in &tokens {
            let parts: Vec<&str> = token_path.split(':').collect();
            let token_type = parts[0];

            // Try to look up the provider by token type
            let mut provider = storage.get("tokenProvider", token_type).await?;

            // If not found, search all providers
            if provider.is_none() {
                let all_providers = storage.find("tokenProvider", None).await?;
                for p in &all_providers {
                    let contexts = p["contexts"].as_str().unwrap_or("");
                    let p_type = p["tokenType"].as_str().unwrap_or("");
                    if contexts.contains(token_type) || p_type == token_type {
                        provider = Some(p.clone());
                        break;
                    }
                }
            }

            let placeholder = format!("[{}]", token_path);

            if let Some(ref prov) = provider {
                let resolved_key = if parts.len() > 1 {
                    format!("{}:{}", token_type, parts[1..].join(":"))
                } else {
                    token_type.to_string()
                };

                let resolution = storage.get("tokenValue", &resolved_key).await?;
                if let Some(res) = resolution {
                    let value = res["value"].as_str().unwrap_or("");
                    result = result.replace(&placeholder, value);
                } else if let Some(builtin) = resolve_builtin_token(token_path) {
                    result = result.replace(&placeholder, builtin);
                } else {
                    let provider_data = prov["provider"].as_str().unwrap_or("");
                    let value = format!("{}:{}", provider_data, parts[1..].join(":"));
                    result = result.replace(&placeholder, &value);
                }
            } else if let Some(builtin) = resolve_builtin_token(token_path) {
                result = result.replace(&placeholder, builtin);
            }
            // Unrecognized tokens without providers are left in place
        }

        Ok(TokenReplaceOutput::Ok { result })
    }

    async fn get_available_tokens(
        &self,
        input: TokenGetAvailableTokensInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TokenGetAvailableTokensOutput, Box<dyn std::error::Error>> {
        let all_providers = storage.find("tokenProvider", None).await?;
        let mut tokens: Vec<String> = Vec::new();

        for provider in &all_providers {
            let token_type = provider["tokenType"].as_str().unwrap_or("");
            let contexts = provider["contexts"].as_str().unwrap_or("");
            if input.context.is_empty()
                || token_type == input.context
                || contexts.contains(&input.context)
            {
                tokens.push(token_type.to_string());
            }
        }

        Ok(TokenGetAvailableTokensOutput::Ok {
            tokens: serde_json::to_string(&tokens)?,
        })
    }

    async fn scan(
        &self,
        input: TokenScanInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<TokenScanOutput, Box<dyn std::error::Error>> {
        let found = scan_tokens(&input.text);
        Ok(TokenScanOutput::Ok {
            found: serde_json::to_string(&found)?,
        })
    }

    async fn register_provider(
        &self,
        input: TokenRegisterProviderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TokenRegisterProviderOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("tokenProvider", &input.token).await?;
        if existing.is_some() {
            return Ok(TokenRegisterProviderOutput::Exists);
        }

        storage.put("tokenProvider", &input.token, json!({
            "tokenType": input.token,
            "provider": input.provider,
            "contexts": input.token,
            "createdAt": chrono::Utc::now().to_rfc3339()
        })).await?;

        Ok(TokenRegisterProviderOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_replace_no_tokens() {
        let storage = InMemoryStorage::new();
        let handler = TokenHandlerImpl;
        let result = handler.replace(
            TokenReplaceInput {
                text: "Hello plain text".to_string(),
                context: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TokenReplaceOutput::Ok { result } => {
                assert_eq!(result, "Hello plain text");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_replace_builtin_tokens() {
        let storage = InMemoryStorage::new();
        let handler = TokenHandlerImpl;
        let result = handler.replace(
            TokenReplaceInput {
                text: "Contact: [user:mail]".to_string(),
                context: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TokenReplaceOutput::Ok { result } => {
                assert!(result.contains("user@example.com"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_scan_finds_tokens() {
        let storage = InMemoryStorage::new();
        let handler = TokenHandlerImpl;
        let result = handler.scan(
            TokenScanInput {
                text: "Hello [user:name], welcome to [site:name]!".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TokenScanOutput::Ok { found } => {
                assert!(found.contains("user:name"));
                assert!(found.contains("site:name"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_scan_no_tokens() {
        let storage = InMemoryStorage::new();
        let handler = TokenHandlerImpl;
        let result = handler.scan(
            TokenScanInput {
                text: "No tokens here".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TokenScanOutput::Ok { found } => {
                assert_eq!(found, "[]");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_provider_success() {
        let storage = InMemoryStorage::new();
        let handler = TokenHandlerImpl;
        let result = handler.register_provider(
            TokenRegisterProviderInput {
                token: "custom".to_string(),
                provider: "my-provider".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TokenRegisterProviderOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_provider_exists() {
        let storage = InMemoryStorage::new();
        let handler = TokenHandlerImpl;
        handler.register_provider(
            TokenRegisterProviderInput {
                token: "custom".to_string(),
                provider: "provider-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register_provider(
            TokenRegisterProviderInput {
                token: "custom".to_string(),
                provider: "provider-2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TokenRegisterProviderOutput::Exists => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_get_available_tokens_empty() {
        let storage = InMemoryStorage::new();
        let handler = TokenHandlerImpl;
        let result = handler.get_available_tokens(
            TokenGetAvailableTokensInput { context: "".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TokenGetAvailableTokensOutput::Ok { tokens } => {
                assert_eq!(tokens, "[]");
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
