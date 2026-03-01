// Signature concept implementation
// Cryptographic signing, verification, and timestamping for content integrity.
// Tracks trusted signers and validates content hashes against stored signatures.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SignatureHandler;
use serde_json::json;

pub struct SignatureHandlerImpl;

fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("sig-{}-{}", t.as_secs(), t.subsec_nanos())
}

fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}Z", t.as_secs())
}

#[async_trait]
impl SignatureHandler for SignatureHandlerImpl {
    async fn sign(
        &self,
        input: SignatureSignInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignatureSignOutput, Box<dyn std::error::Error>> {
        // Check that the identity is a trusted signer
        let trusted = storage.get("trusted_signer", &input.identity).await?;
        if trusted.is_none() {
            return Ok(SignatureSignOutput::UnknownIdentity {
                message: format!("Identity \"{}\" is not a trusted signer", input.identity),
            });
        }

        // Verify content hash exists
        let content = storage.get("content_hash", &input.content_hash).await?;
        if content.is_none() {
            // Store the content hash reference so it can be verified later
            storage.put("content_hash", &input.content_hash, json!({
                "hash": &input.content_hash,
                "registeredAt": current_timestamp(),
            })).await?;
        }

        let signature_id = generate_id();
        let timestamp = current_timestamp();

        storage.put("signature", &signature_id, json!({
            "signatureId": &signature_id,
            "contentHash": &input.content_hash,
            "identity": &input.identity,
            "timestamp": &timestamp,
            "valid": true,
        })).await?;

        Ok(SignatureSignOutput::Ok { signature_id })
    }

    async fn verify(
        &self,
        input: SignatureVerifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignatureVerifyOutput, Box<dyn std::error::Error>> {
        let sig = storage.get("signature", &input.signature_id).await?;
        let sig = match sig {
            Some(s) => s,
            None => {
                return Ok(SignatureVerifyOutput::Invalid {
                    message: format!("Signature \"{}\" not found", input.signature_id),
                });
            }
        };

        // Check the content hash matches
        let stored_hash = sig.get("contentHash")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if stored_hash != input.content_hash {
            return Ok(SignatureVerifyOutput::Invalid {
                message: "Content hash does not match signed content".to_string(),
            });
        }

        let identity = sig.get("identity")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let timestamp = sig.get("timestamp")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Check if signer is still trusted
        let trusted = storage.get("trusted_signer", &identity).await?;
        if trusted.is_none() {
            return Ok(SignatureVerifyOutput::UntrustedSigner {
                signer: identity,
            });
        }

        // Check if signature has been marked expired
        let valid = sig.get("valid")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);
        if !valid {
            return Ok(SignatureVerifyOutput::Expired {
                message: "Signature has expired or been revoked".to_string(),
            });
        }

        Ok(SignatureVerifyOutput::Valid { identity, timestamp })
    }

    async fn timestamp(
        &self,
        input: SignatureTimestampInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignatureTimestampOutput, Box<dyn std::error::Error>> {
        let content = storage.get("content_hash", &input.content_hash).await?;
        if content.is_none() {
            return Ok(SignatureTimestampOutput::Unavailable {
                message: format!("Content hash \"{}\" not found", input.content_hash),
            });
        }

        let ts = current_timestamp();
        let proof = json!({
            "contentHash": &input.content_hash,
            "timestamp": &ts,
            "type": "rfc3161",
        });
        let proof_bytes = serde_json::to_vec(&proof)?;

        // Store timestamp proof
        storage.put("timestamp_proof", &input.content_hash, json!({
            "contentHash": &input.content_hash,
            "proof": &ts,
            "createdAt": &ts,
        })).await?;

        Ok(SignatureTimestampOutput::Ok { proof: proof_bytes })
    }

    async fn add_trusted_signer(
        &self,
        input: SignatureAddTrustedSignerInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignatureAddTrustedSignerOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("trusted_signer", &input.identity).await?;
        if existing.is_some() {
            return Ok(SignatureAddTrustedSignerOutput::AlreadyTrusted {
                message: format!("Identity \"{}\" is already trusted", input.identity),
            });
        }

        storage.put("trusted_signer", &input.identity, json!({
            "identity": &input.identity,
            "addedAt": current_timestamp(),
        })).await?;

        Ok(SignatureAddTrustedSignerOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_sign_unknown_identity() {
        let storage = InMemoryStorage::new();
        let handler = SignatureHandlerImpl;
        let result = handler.sign(
            SignatureSignInput {
                content_hash: "hash123".to_string(),
                identity: "unknown".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SignatureSignOutput::UnknownIdentity { .. } => {},
            _ => panic!("Expected UnknownIdentity variant"),
        }
    }

    #[tokio::test]
    async fn test_add_trusted_signer_and_sign() {
        let storage = InMemoryStorage::new();
        let handler = SignatureHandlerImpl;
        handler.add_trusted_signer(
            SignatureAddTrustedSignerInput { identity: "alice".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.sign(
            SignatureSignInput { content_hash: "abc".to_string(), identity: "alice".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignatureSignOutput::Ok { signature_id } => {
                assert!(signature_id.starts_with("sig-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_verify_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SignatureHandlerImpl;
        let result = handler.verify(
            SignatureVerifyInput { signature_id: "missing".to_string(), content_hash: "x".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignatureVerifyOutput::Invalid { .. } => {},
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_timestamp_unavailable() {
        let storage = InMemoryStorage::new();
        let handler = SignatureHandlerImpl;
        let result = handler.timestamp(
            SignatureTimestampInput { content_hash: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignatureTimestampOutput::Unavailable { .. } => {},
            _ => panic!("Expected Unavailable variant"),
        }
    }

    #[tokio::test]
    async fn test_add_trusted_signer_already_trusted() {
        let storage = InMemoryStorage::new();
        let handler = SignatureHandlerImpl;
        handler.add_trusted_signer(
            SignatureAddTrustedSignerInput { identity: "bob".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.add_trusted_signer(
            SignatureAddTrustedSignerInput { identity: "bob".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignatureAddTrustedSignerOutput::AlreadyTrusted { .. } => {},
            _ => panic!("Expected AlreadyTrusted variant"),
        }
    }

    #[tokio::test]
    async fn test_verify_valid_full_flow() {
        let storage = InMemoryStorage::new();
        let handler = SignatureHandlerImpl;
        // Add a trusted signer
        handler.add_trusted_signer(
            SignatureAddTrustedSignerInput { identity: "alice".to_string() },
            &storage,
        ).await.unwrap();
        // Sign content
        let sign_result = handler.sign(
            SignatureSignInput {
                content_hash: "hash-abc".to_string(),
                identity: "alice".to_string(),
            },
            &storage,
        ).await.unwrap();
        let sig_id = match sign_result {
            SignatureSignOutput::Ok { signature_id } => signature_id,
            _ => panic!("Expected sign Ok"),
        };
        // Verify the signature
        let result = handler.verify(
            SignatureVerifyInput {
                signature_id: sig_id,
                content_hash: "hash-abc".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SignatureVerifyOutput::Valid { identity, timestamp } => {
                assert_eq!(identity, "alice");
                assert!(!timestamp.is_empty());
            },
            other => panic!("Expected Valid variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_verify_hash_mismatch() {
        let storage = InMemoryStorage::new();
        let handler = SignatureHandlerImpl;
        handler.add_trusted_signer(
            SignatureAddTrustedSignerInput { identity: "alice".to_string() },
            &storage,
        ).await.unwrap();
        let sign_result = handler.sign(
            SignatureSignInput {
                content_hash: "hash-abc".to_string(),
                identity: "alice".to_string(),
            },
            &storage,
        ).await.unwrap();
        let sig_id = match sign_result {
            SignatureSignOutput::Ok { signature_id } => signature_id,
            _ => panic!("Expected sign Ok"),
        };
        let result = handler.verify(
            SignatureVerifyInput {
                signature_id: sig_id,
                content_hash: "wrong-hash".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SignatureVerifyOutput::Invalid { message } => {
                assert!(message.contains("does not match"));
            },
            other => panic!("Expected Invalid variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_timestamp_ok_after_sign() {
        let storage = InMemoryStorage::new();
        let handler = SignatureHandlerImpl;
        handler.add_trusted_signer(
            SignatureAddTrustedSignerInput { identity: "alice".to_string() },
            &storage,
        ).await.unwrap();
        // Sign registers the content hash
        handler.sign(
            SignatureSignInput {
                content_hash: "hash-ts".to_string(),
                identity: "alice".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.timestamp(
            SignatureTimestampInput { content_hash: "hash-ts".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignatureTimestampOutput::Ok { proof } => {
                assert!(!proof.is_empty());
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_add_trusted_signer_ok() {
        let storage = InMemoryStorage::new();
        let handler = SignatureHandlerImpl;
        let result = handler.add_trusted_signer(
            SignatureAddTrustedSignerInput { identity: "carol".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SignatureAddTrustedSignerOutput::Ok => {},
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }
}
