// Secret concept implementation
// Coordination concept for secret management. Resolves secrets through
// provider backends, caches results, tracks rotation history, and
// supports cache invalidation for secret refresh.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SecretHandler;
use serde_json::json;

pub struct SecretHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("sec-{}-{}", t.as_secs(), t.subsec_nanos())
}

const RELATION: &str = "secret";

#[async_trait]
impl SecretHandler for SecretHandlerImpl {
    async fn resolve(
        &self,
        input: SecretResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SecretResolveOutput, Box<dyn std::error::Error>> {
        // Check cache first
        let cached = storage.find(RELATION, Some(&json!({
            "name": input.name,
            "provider": input.provider,
        }))).await?;

        if !cached.is_empty() {
            let rec = &cached[0];
            let secret = rec.get("secret").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let version = rec.get("version").and_then(|v| v.as_str()).unwrap_or("v1").to_string();
            return Ok(SecretResolveOutput::Ok { secret, version });
        }

        let secret_id = next_id();
        let version = "v1".to_string();
        let now = chrono::Utc::now().to_rfc3339();

        storage.put(RELATION, &secret_id, json!({
            "secret": secret_id,
            "name": input.name,
            "provider": input.provider,
            "version": version,
            "resolvedAt": now,
            "audit": serde_json::to_string(&vec![json!({
                "action": "resolve",
                "timestamp": now,
            })]).unwrap_or_default(),
        })).await?;

        Ok(SecretResolveOutput::Ok {
            secret: secret_id,
            version,
        })
    }

    async fn exists(
        &self,
        input: SecretExistsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SecretExistsOutput, Box<dyn std::error::Error>> {
        let matches = storage.find(RELATION, Some(&json!({
            "name": input.name,
            "provider": input.provider,
        }))).await?;

        Ok(SecretExistsOutput::Ok {
            name: input.name,
            exists: !matches.is_empty(),
        })
    }

    async fn rotate(
        &self,
        input: SecretRotateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SecretRotateOutput, Box<dyn std::error::Error>> {
        let matches = storage.find(RELATION, Some(&json!({
            "name": input.name,
            "provider": input.provider,
        }))).await?;

        let now = chrono::Utc::now().to_rfc3339();
        let new_version = format!("v{}", chrono::Utc::now().timestamp());

        if matches.is_empty() {
            // No existing secret -- resolve first, then consider it rotated
            let secret_id = next_id();
            storage.put(RELATION, &secret_id, json!({
                "secret": secret_id,
                "name": input.name,
                "provider": input.provider,
                "version": new_version,
                "resolvedAt": now,
                "audit": serde_json::to_string(&vec![json!({
                    "action": "rotate",
                    "timestamp": now,
                })]).unwrap_or_default(),
            })).await?;

            return Ok(SecretRotateOutput::Ok {
                secret: secret_id,
                new_version,
            });
        }

        let record = &matches[0];
        let secret_key = record.get("secret").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let audit_str = record.get("audit").and_then(|v| v.as_str()).unwrap_or("[]").to_string();
        let mut audit: Vec<serde_json::Value> = serde_json::from_str(&audit_str).unwrap_or_default();
        audit.push(json!({
            "action": "rotate",
            "timestamp": now,
        }));

        let mut updated = record.clone();
        updated["version"] = json!(new_version);
        updated["resolvedAt"] = json!(now);
        updated["audit"] = json!(serde_json::to_string(&audit).unwrap_or_default());

        storage.put(RELATION, &secret_key, updated).await?;

        Ok(SecretRotateOutput::Ok {
            secret: secret_key,
            new_version,
        })
    }

    async fn invalidate_cache(
        &self,
        input: SecretInvalidateCacheInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SecretInvalidateCacheOutput, Box<dyn std::error::Error>> {
        let matches = storage.find(RELATION, Some(&json!({"name": input.name}))).await?;

        let secret_id = if !matches.is_empty() {
            matches[0].get("secret").and_then(|v| v.as_str()).unwrap_or(&input.name).to_string()
        } else {
            input.name.clone()
        };

        for rec in &matches {
            if let Some(key) = rec.get("secret").and_then(|v| v.as_str()) {
                storage.del(RELATION, key).await?;
            }
        }

        Ok(SecretInvalidateCacheOutput::Ok {
            secret: secret_id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_resolve_creates_new() {
        let storage = InMemoryStorage::new();
        let handler = SecretHandlerImpl;
        let result = handler.resolve(
            SecretResolveInput { name: "db-password".to_string(), provider: "vault".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SecretResolveOutput::Ok { secret, version } => {
                assert!(secret.starts_with("sec-"));
                assert_eq!(version, "v1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_exists_false() {
        let storage = InMemoryStorage::new();
        let handler = SecretHandlerImpl;
        let result = handler.exists(
            SecretExistsInput { name: "missing".to_string(), provider: "vault".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SecretExistsOutput::Ok { exists, .. } => {
                assert!(!exists);
            },
        }
    }

    #[tokio::test]
    async fn test_rotate_new_secret() {
        let storage = InMemoryStorage::new();
        let handler = SecretHandlerImpl;
        let result = handler.rotate(
            SecretRotateInput { name: "api-key".to_string(), provider: "vault".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SecretRotateOutput::Ok { secret, new_version } => {
                assert!(secret.starts_with("sec-"));
                assert!(new_version.starts_with("v"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_invalidate_cache() {
        let storage = InMemoryStorage::new();
        let handler = SecretHandlerImpl;
        let result = handler.invalidate_cache(
            SecretInvalidateCacheInput { name: "db-password".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SecretInvalidateCacheOutput::Ok { secret } => {
                assert_eq!(secret, "db-password");
            },
        }
    }
}
