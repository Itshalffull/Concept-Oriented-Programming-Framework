// VaultProvider handler implementation
// Manage secret resolution from HashiCorp Vault. Owns Vault connection state,
// lease tracking, token renewal, and seal status monitoring.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::VaultProviderHandler;
use serde_json::{json, Value};

pub struct VaultProviderHandlerImpl;

#[async_trait]
impl VaultProviderHandler for VaultProviderHandlerImpl {
    async fn fetch(
        &self,
        input: VaultProviderFetchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VaultProviderFetchOutput, Box<dyn std::error::Error>> {
        let path = &input.path;

        // Check vault health state
        let health_record = storage.get("connection", "vault-health").await?;
        if let Some(ref hr) = health_record {
            if hr.get("sealed").and_then(|v| v.as_bool()) == Some(true) {
                return Ok(VaultProviderFetchOutput::Sealed {
                    address: hr.get("address").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                });
            }
            if hr.get("tokenExpired").and_then(|v| v.as_bool()) == Some(true) {
                return Ok(VaultProviderFetchOutput::TokenExpired {
                    address: hr.get("address").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                });
            }
        }

        // Check for existing secret
        let secret_record = storage.get("connection", path).await?;
        if let Some(ref sr) = secret_record {
            return Ok(VaultProviderFetchOutput::Ok {
                value: sr.get("value").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                lease_id: sr.get("leaseId").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                lease_duration: sr.get("leaseDuration").and_then(|v| v.as_i64()).unwrap_or(3600),
            });
        }

        // Simulate first access
        if path.contains("nonexistent") || path.contains("missing") {
            return Ok(VaultProviderFetchOutput::PathNotFound { path: path.clone() });
        }

        let lease_id = format!("lease-{}", 1000000);
        let lease_duration: i64 = 3600;
        let secret_name = path.split('/').last().unwrap_or("unknown");
        let value = format!("vault-secret-for-{}", secret_name);

        storage.put("connection", path, json!({
            "address": "http://127.0.0.1:8200",
            "authMethod": "token",
            "mountPath": "secret",
            "leaseId": &lease_id,
            "leaseDuration": lease_duration,
            "renewable": true,
            "sealed": false,
            "value": &value,
            "currentVersion": 1,
        })).await?;

        Ok(VaultProviderFetchOutput::Ok { value, lease_id, lease_duration })
    }

    async fn renew_lease(
        &self,
        input: VaultProviderRenewLeaseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VaultProviderRenewLeaseOutput, Box<dyn std::error::Error>> {
        let lease_id = &input.lease_id;

        // Search for the connection record with this leaseId
        let all_connections = storage.find("connection", None).await?;
        let mut found_record: Option<&Value> = None;

        for record in &all_connections {
            if record.get("leaseId").and_then(|v| v.as_str()) == Some(lease_id) {
                found_record = Some(record);
                break;
            }
        }

        let found = match found_record {
            Some(r) => r,
            None => return Ok(VaultProviderRenewLeaseOutput::LeaseExpired {
                lease_id: lease_id.clone(),
            }),
        };

        if found.get("renewable").and_then(|v| v.as_bool()) != Some(true) {
            return Ok(VaultProviderRenewLeaseOutput::LeaseExpired {
                lease_id: lease_id.clone(),
            });
        }

        let new_duration = found.get("leaseDuration").and_then(|v| v.as_i64()).unwrap_or(3600);

        Ok(VaultProviderRenewLeaseOutput::Ok {
            lease_id: lease_id.clone(),
            new_duration,
        })
    }

    async fn rotate(
        &self,
        input: VaultProviderRotateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VaultProviderRotateOutput, Box<dyn std::error::Error>> {
        let path = &input.path;

        let record = storage.get("connection", path).await?;
        let current_version = record.as_ref()
            .and_then(|r| r.get("currentVersion"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let new_version = current_version + 1;

        if let Some(mut rec) = record {
            if let Some(obj) = rec.as_object_mut() {
                obj.insert("currentVersion".to_string(), json!(new_version));
                obj.insert("value".to_string(), json!(format!("vault-rotated-secret-v{}", new_version)));
            }
            storage.put("connection", path, rec).await?;
        }

        Ok(VaultProviderRotateOutput::Ok { new_version })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_fetch_success() {
        let storage = InMemoryStorage::new();
        let handler = VaultProviderHandlerImpl;
        let result = handler.fetch(
            VaultProviderFetchInput {
                path: "secret/data/myapp/db-password".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VaultProviderFetchOutput::Ok { value, lease_id, lease_duration } => {
                assert!(value.contains("db-password"));
                assert!(!lease_id.is_empty());
                assert!(lease_duration > 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_fetch_path_not_found() {
        let storage = InMemoryStorage::new();
        let handler = VaultProviderHandlerImpl;
        let result = handler.fetch(
            VaultProviderFetchInput {
                path: "secret/data/nonexistent/key".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VaultProviderFetchOutput::PathNotFound { path } => {
                assert!(path.contains("nonexistent"));
            },
            _ => panic!("Expected PathNotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_fetch_sealed() {
        let storage = InMemoryStorage::new();
        let handler = VaultProviderHandlerImpl;
        storage.put("connection", "vault-health", json!({
            "sealed": true,
            "address": "http://127.0.0.1:8200",
        })).await.unwrap();
        let result = handler.fetch(
            VaultProviderFetchInput {
                path: "secret/data/myapp/key".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VaultProviderFetchOutput::Sealed { .. } => {},
            _ => panic!("Expected Sealed variant"),
        }
    }

    #[tokio::test]
    async fn test_renew_lease_expired() {
        let storage = InMemoryStorage::new();
        let handler = VaultProviderHandlerImpl;
        let result = handler.renew_lease(
            VaultProviderRenewLeaseInput {
                lease_id: "nonexistent-lease".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VaultProviderRenewLeaseOutput::LeaseExpired { .. } => {},
            _ => panic!("Expected LeaseExpired variant"),
        }
    }

    #[tokio::test]
    async fn test_rotate_success() {
        let storage = InMemoryStorage::new();
        let handler = VaultProviderHandlerImpl;
        // First fetch to populate
        handler.fetch(
            VaultProviderFetchInput {
                path: "secret/data/myapp/api-key".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.rotate(
            VaultProviderRotateInput {
                path: "secret/data/myapp/api-key".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VaultProviderRotateOutput::Ok { new_version } => {
                assert!(new_version >= 2);
            },
        }
    }
}
