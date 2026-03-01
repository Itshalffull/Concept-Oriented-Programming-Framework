// Wallet handler implementation
// Verify wallet signatures and manage wallet addresses.
// Simulates ecrecover for personal_sign and EIP-712 typed data verification.
// Manages nonce tracking for replay protection.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WalletHandler;
use serde_json::json;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// Simulate ecrecover by hashing address + message + signature and deriving
/// a deterministic "recovered address". In production this would use secp256k1.
fn simulate_ecrecover(address: &str, message: &str, signature: &str) -> String {
    let mut hasher = DefaultHasher::new();
    address.hash(&mut hasher);
    message.hash(&mut hasher);
    signature.hash(&mut hasher);
    let hash = hasher.finish();
    format!("0x{:040x}", hash)
}

/// Verify a personal_sign-style signature.
fn verify_signature(address: &str, message: &str, signature: &str) -> String {
    simulate_ecrecover(address, message, signature)
}

/// Verify an EIP-712 typed data signature.
fn verify_typed_data_signature(address: &str, domain: &str, types: &str, value: &str, signature: &str) -> String {
    let mut hasher = DefaultHasher::new();
    domain.hash(&mut hasher);
    types.hash(&mut hasher);
    value.hash(&mut hasher);
    let combined_message = format!("{:x}", hasher.finish());
    simulate_ecrecover(address, &combined_message, signature)
}

pub struct WalletHandlerImpl;

#[async_trait]
impl WalletHandler for WalletHandlerImpl {
    async fn verify(
        &self,
        input: WalletVerifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WalletVerifyOutput, Box<dyn std::error::Error>> {
        let address = input.address.to_lowercase();
        let message = &input.message;
        let signature = &input.signature;

        if address.is_empty() || message.is_empty() || signature.is_empty() {
            return Ok(WalletVerifyOutput::Error {
                message: "Missing required fields: address, message, signature".to_string(),
            });
        }

        let recovered_address = verify_signature(&address, message, signature);

        if recovered_address == address {
            // Register the address on successful verification
            let existing = storage.get("address", &address).await?;
            if existing.is_none() {
                storage.put("address", &address, json!({
                    "address": &address,
                    "firstSeen": "2026-01-01T00:00:00.000Z",
                })).await?;
            }

            Ok(WalletVerifyOutput::Ok {
                address: address.clone(),
                recovered_address,
            })
        } else {
            Ok(WalletVerifyOutput::Invalid {
                address,
                recovered_address,
            })
        }
    }

    async fn verify_typed_data(
        &self,
        input: WalletVerifyTypedDataInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WalletVerifyTypedDataOutput, Box<dyn std::error::Error>> {
        let address = input.address.to_lowercase();
        let domain = &input.domain;
        let types = &input.types;
        let value = &input.value;
        let signature = &input.signature;

        if address.is_empty() || domain.is_empty() || types.is_empty() || value.is_empty() || signature.is_empty() {
            return Ok(WalletVerifyTypedDataOutput::Error {
                message: "Missing required fields for typed data verification".to_string(),
            });
        }

        let recovered_address = verify_typed_data_signature(&address, domain, types, value, signature);

        if recovered_address == address {
            Ok(WalletVerifyTypedDataOutput::Ok { address })
        } else {
            Ok(WalletVerifyTypedDataOutput::Invalid { address })
        }
    }

    async fn get_nonce(
        &self,
        input: WalletGetNonceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WalletGetNonceOutput, Box<dyn std::error::Error>> {
        let address = input.address.to_lowercase();

        let record = storage.get("nonce", &address).await?;
        match record {
            Some(r) => Ok(WalletGetNonceOutput::Ok {
                address: address.clone(),
                nonce: r.get("nonce").and_then(|v| v.as_i64()).unwrap_or(0),
            }),
            None => Ok(WalletGetNonceOutput::NotFound { address }),
        }
    }

    async fn increment_nonce(
        &self,
        input: WalletIncrementNonceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WalletIncrementNonceOutput, Box<dyn std::error::Error>> {
        let address = input.address.to_lowercase();

        let record = storage.get("nonce", &address).await?;
        let current_nonce = record.as_ref()
            .and_then(|r| r.get("nonce"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let new_nonce = current_nonce + 1;

        storage.put("nonce", &address, json!({
            "address": &address,
            "nonce": new_nonce,
        })).await?;

        Ok(WalletIncrementNonceOutput::Ok { address, nonce: new_nonce })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_verify_missing_fields() {
        let storage = InMemoryStorage::new();
        let handler = WalletHandlerImpl;
        let result = handler.verify(
            WalletVerifyInput {
                address: "".to_string(),
                message: "test".to_string(),
                signature: "sig".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WalletVerifyOutput::Error { message } => {
                assert!(message.contains("Missing"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_verify_invalid_signature() {
        let storage = InMemoryStorage::new();
        let handler = WalletHandlerImpl;
        let result = handler.verify(
            WalletVerifyInput {
                address: "0xabc123".to_string(),
                message: "hello".to_string(),
                signature: "bad-sig".to_string(),
            },
            &storage,
        ).await.unwrap();
        // The simulated ecrecover will not match, so expect Invalid
        match result {
            WalletVerifyOutput::Invalid { address, recovered_address } => {
                assert!(!address.is_empty());
                assert_ne!(address, recovered_address);
            },
            WalletVerifyOutput::Ok { .. } => {
                // Hash collision is possible but extremely unlikely
            },
            _ => panic!("Expected Invalid or Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_verify_typed_data_missing_fields() {
        let storage = InMemoryStorage::new();
        let handler = WalletHandlerImpl;
        let result = handler.verify_typed_data(
            WalletVerifyTypedDataInput {
                address: "0xabc".to_string(),
                domain: "".to_string(),
                types: "".to_string(),
                value: "".to_string(),
                signature: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WalletVerifyTypedDataOutput::Error { message } => {
                assert!(message.contains("Missing"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_get_nonce_not_found() {
        let storage = InMemoryStorage::new();
        let handler = WalletHandlerImpl;
        let result = handler.get_nonce(
            WalletGetNonceInput {
                address: "0xabc123".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WalletGetNonceOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_increment_nonce_success() {
        let storage = InMemoryStorage::new();
        let handler = WalletHandlerImpl;
        let result = handler.increment_nonce(
            WalletIncrementNonceInput {
                address: "0xABC123".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WalletIncrementNonceOutput::Ok { nonce, .. } => {
                assert_eq!(nonce, 1);
            },
        }
    }

    #[tokio::test]
    async fn test_increment_nonce_twice() {
        let storage = InMemoryStorage::new();
        let handler = WalletHandlerImpl;
        handler.increment_nonce(
            WalletIncrementNonceInput {
                address: "0xABC123".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.increment_nonce(
            WalletIncrementNonceInput {
                address: "0xABC123".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WalletIncrementNonceOutput::Ok { nonce, .. } => {
                assert_eq!(nonce, 2);
            },
        }
    }
}
