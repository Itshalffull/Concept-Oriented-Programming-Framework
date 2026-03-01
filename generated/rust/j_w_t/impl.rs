// JWT concept implementation
// Simplified JWT using base64 encoding with HMAC-SHA256 signature.
// Generates tokens with user claims and verifies token integrity.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::JWTHandler;
use serde_json::json;

pub struct JWTHandlerImpl;

/// Base64url encode without padding
fn base64url_encode(data: &[u8]) -> String {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    URL_SAFE_NO_PAD.encode(data)
}

/// Base64url decode
fn base64url_decode(data: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    Ok(URL_SAFE_NO_PAD.decode(data)?)
}

/// Compute HMAC-SHA256 signature
fn hmac_sha256(key: &[u8], message: &str) -> Vec<u8> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    type HmacSha256 = Hmac<Sha256>;

    let mut mac = HmacSha256::new_from_slice(key)
        .expect("HMAC can accept any key length");
    mac.update(message.as_bytes());
    mac.finalize().into_bytes().to_vec()
}

/// Static secret key (in production, this would be configurable)
const JWT_SECRET: &[u8] = b"clef-jwt-secret-key-for-concept-handler";

fn sign_token(user: &str) -> String {
    let header = base64url_encode(br#"{"alg":"HS256","typ":"JWT"}"#);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let payload_json = format!(r#"{{"user":"{}","iat":{}}}"#, user, now);
    let body = base64url_encode(payload_json.as_bytes());
    let message = format!("{}.{}", header, body);
    let signature = base64url_encode(&hmac_sha256(JWT_SECRET, &message));
    format!("{}.{}.{}", header, body, signature)
}

fn verify_token(token: &str) -> Option<String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return None;
    }

    let message = format!("{}.{}", parts[0], parts[1]);
    let expected = base64url_encode(&hmac_sha256(JWT_SECRET, &message));

    if parts[2] != expected {
        return None;
    }

    let body_bytes = base64url_decode(parts[1]).ok()?;
    let body_str = String::from_utf8(body_bytes).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&body_str).ok()?;

    parsed.get("user")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

#[async_trait]
impl JWTHandler for JWTHandlerImpl {
    async fn generate(
        &self,
        input: JWTGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<JWTGenerateOutput, Box<dyn std::error::Error>> {
        let token = sign_token(&input.user);

        storage.put("tokens", &input.user, json!({
            "user": input.user,
            "token": token,
        })).await?;

        Ok(JWTGenerateOutput::Ok { token })
    }

    async fn verify(
        &self,
        input: JWTVerifyInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<JWTVerifyOutput, Box<dyn std::error::Error>> {
        match verify_token(&input.token) {
            Some(user) => Ok(JWTVerifyOutput::Ok { user }),
            None => Ok(JWTVerifyOutput::Error {
                message: "Invalid or expired token".into(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_token() {
        let storage = InMemoryStorage::new();
        let handler = JWTHandlerImpl;
        let result = handler.generate(
            JWTGenerateInput { user: "alice".into() },
            &storage,
        ).await.unwrap();
        match result {
            JWTGenerateOutput::Ok { token } => {
                assert!(!token.is_empty());
                assert_eq!(token.split('.').count(), 3);
            }
        }
    }

    #[tokio::test]
    async fn test_verify_valid_token() {
        let storage = InMemoryStorage::new();
        let handler = JWTHandlerImpl;
        let gen_result = handler.generate(
            JWTGenerateInput { user: "bob".into() },
            &storage,
        ).await.unwrap();
        let token = match gen_result {
            JWTGenerateOutput::Ok { token } => token,
        };

        let verify_result = handler.verify(
            JWTVerifyInput { token },
            &storage,
        ).await.unwrap();
        match verify_result {
            JWTVerifyOutput::Ok { user } => assert_eq!(user, "bob"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_verify_invalid_token() {
        let storage = InMemoryStorage::new();
        let handler = JWTHandlerImpl;
        let result = handler.verify(
            JWTVerifyInput { token: "invalid.token.here".into() },
            &storage,
        ).await.unwrap();
        match result {
            JWTVerifyOutput::Error { message } => {
                assert!(message.contains("Invalid"));
            }
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_verify_malformed_token() {
        let storage = InMemoryStorage::new();
        let handler = JWTHandlerImpl;
        let result = handler.verify(
            JWTVerifyInput { token: "not-a-jwt".into() },
            &storage,
        ).await.unwrap();
        match result {
            JWTVerifyOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }
}
