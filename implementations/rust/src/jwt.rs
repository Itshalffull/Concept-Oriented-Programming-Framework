// JWT Concept Implementation (Rust)
//
// Mirrors the TypeScript jwt.impl.ts — generate and verify actions.
// Simplified JWT using HMAC-SHA256 signatures with base64url encoding.

use crate::storage::{ConceptStorage, StorageResult};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::Sha256;
use std::sync::LazyLock;

type HmacSha256 = Hmac<Sha256>;

/// Static secret key for HMAC signing (generated once at startup).
static JWT_SECRET: LazyLock<[u8; 32]> = LazyLock::new(|| {
    use rand::RngCore;
    let mut key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);
    key
});

// ── Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JwtGenerateInput {
    pub user: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum JwtGenerateOutput {
    #[serde(rename = "ok")]
    Ok { token: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JwtVerifyInput {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum JwtVerifyOutput {
    #[serde(rename = "ok")]
    Ok { user: String },
    #[serde(rename = "error")]
    Error { message: String },
}

// ── Internal helpers ───────────────────────────────────────

fn sign_token(payload: &serde_json::Value) -> String {
    let header = json!({"alg": "HS256", "typ": "JWT"});
    let header_b64 = URL_SAFE_NO_PAD.encode(header.to_string().as_bytes());
    let body_b64 = URL_SAFE_NO_PAD.encode(payload.to_string().as_bytes());

    let signing_input = format!("{}.{}", header_b64, body_b64);

    let mut mac =
        HmacSha256::new_from_slice(&*JWT_SECRET).expect("HMAC can take key of any size");
    mac.update(signing_input.as_bytes());
    let signature = mac.finalize().into_bytes();
    let sig_b64 = URL_SAFE_NO_PAD.encode(signature);

    format!("{}.{}.{}", header_b64, body_b64, sig_b64)
}

fn verify_token(token: &str) -> Option<serde_json::Value> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return None;
    }

    let (header, body, signature) = (parts[0], parts[1], parts[2]);
    let signing_input = format!("{}.{}", header, body);

    let mut mac =
        HmacSha256::new_from_slice(&*JWT_SECRET).expect("HMAC can take key of any size");
    mac.update(signing_input.as_bytes());
    let expected = mac.finalize().into_bytes();
    let expected_b64 = URL_SAFE_NO_PAD.encode(expected);

    if signature != expected_b64 {
        return None;
    }

    let body_bytes = URL_SAFE_NO_PAD.decode(body).ok()?;
    let payload: serde_json::Value = serde_json::from_slice(&body_bytes).ok()?;
    Some(payload)
}

// ── Handler ────────────────────────────────────────────────

pub struct JwtHandler;

impl JwtHandler {
    pub async fn generate(
        &self,
        input: JwtGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<JwtGenerateOutput> {
        let now = chrono::Utc::now().timestamp_millis();
        let payload = json!({ "user": input.user, "iat": now });
        let token = sign_token(&payload);

        storage
            .put(
                "tokens",
                &input.user,
                json!({ "user": input.user, "token": token }),
            )
            .await?;

        Ok(JwtGenerateOutput::Ok { token })
    }

    pub async fn verify(
        &self,
        input: JwtVerifyInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<JwtVerifyOutput> {
        let payload = verify_token(&input.token);

        match payload {
            Some(p) if p.get("user").and_then(|v| v.as_str()).is_some() => {
                let user = p["user"].as_str().unwrap().to_string();
                Ok(JwtVerifyOutput::Ok { user })
            }
            _ => Ok(JwtVerifyOutput::Error {
                message: "Invalid or expired token".to_string(),
            }),
        }
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn generate_and_verify() {
        let storage = InMemoryStorage::new();
        let handler = JwtHandler;

        let gen_result = handler
            .generate(
                JwtGenerateInput {
                    user: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let token = match &gen_result {
            JwtGenerateOutput::Ok { token } => token.clone(),
        };

        // Token should have 3 parts
        assert_eq!(token.split('.').count(), 3);

        let verify_result = handler
            .verify(JwtVerifyInput { token }, &storage)
            .await
            .unwrap();

        assert!(matches!(verify_result, JwtVerifyOutput::Ok { user } if user == "alice"));
    }

    #[tokio::test]
    async fn verify_invalid_token() {
        let storage = InMemoryStorage::new();
        let handler = JwtHandler;

        let result = handler
            .verify(
                JwtVerifyInput {
                    token: "invalid.token.here".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, JwtVerifyOutput::Error { .. }));
    }

    #[tokio::test]
    async fn verify_tampered_token() {
        let storage = InMemoryStorage::new();
        let handler = JwtHandler;

        let gen_result = handler
            .generate(
                JwtGenerateInput {
                    user: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let token = match &gen_result {
            JwtGenerateOutput::Ok { token } => token.clone(),
        };

        // Tamper with the payload
        let parts: Vec<&str> = token.split('.').collect();
        let tampered_payload =
            URL_SAFE_NO_PAD.encode(json!({"user": "evil", "iat": 0}).to_string().as_bytes());
        let tampered_token = format!("{}.{}.{}", parts[0], tampered_payload, parts[2]);

        let result = handler
            .verify(
                JwtVerifyInput {
                    token: tampered_token,
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, JwtVerifyOutput::Error { .. }));
    }
}
