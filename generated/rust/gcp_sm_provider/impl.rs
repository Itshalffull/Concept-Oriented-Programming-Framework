// GcpSmProvider concept implementation
// GCP Secret Manager provider: fetch secrets by ID/version, rotate to new versions.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::GcpSmProviderHandler;
use serde_json::json;
use chrono::Utc;

pub struct GcpSmProviderHandlerImpl;

#[async_trait]
impl GcpSmProviderHandler for GcpSmProviderHandlerImpl {
    async fn fetch(
        &self,
        input: GcpSmProviderFetchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcpSmProviderFetchOutput, Box<dyn std::error::Error>> {
        let record = storage.get("secret", &input.secret_id).await?;

        let Some(secret) = record else {
            return Ok(GcpSmProviderFetchOutput::SecretNotFound {
                secret_id: input.secret_id,
                project_id: "unknown".to_string(),
            });
        };

        let project_id = secret.get("projectId")
            .and_then(|v| v.as_str())
            .unwrap_or("default-project")
            .to_string();

        // Check IAM binding
        let has_iam = secret.get("iamBinding")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        if !has_iam {
            return Ok(GcpSmProviderFetchOutput::IamBindingMissing {
                secret_id: input.secret_id,
                principal: secret.get("principal")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string(),
            });
        }

        // Resolve version: "latest" maps to the highest version number
        let version_str = if input.version == "latest" {
            secret.get("latestVersion")
                .and_then(|v| v.as_str())
                .unwrap_or("1")
                .to_string()
        } else {
            input.version.clone()
        };

        // Check if version is disabled
        let disabled_versions: Vec<String> = secret.get("disabledVersions")
            .and_then(|v| v.as_str())
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        if disabled_versions.contains(&version_str) {
            return Ok(GcpSmProviderFetchOutput::VersionDisabled {
                secret_id: input.secret_id,
                version: version_str,
            });
        }

        let value = secret.get("value")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        Ok(GcpSmProviderFetchOutput::Ok {
            value,
            version_id: version_str,
            project_id,
        })
    }

    async fn rotate(
        &self,
        input: GcpSmProviderRotateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcpSmProviderRotateOutput, Box<dyn std::error::Error>> {
        let record = storage.get("secret", &input.secret_id).await?;

        let current_version = record
            .as_ref()
            .and_then(|r| r.get("latestVersion").and_then(|v| v.as_str()))
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(0);

        let new_version = current_version + 1;
        let new_version_id = new_version.to_string();

        if let Some(mut secret) = record {
            secret["latestVersion"] = json!(new_version_id);
            secret["rotatedAt"] = json!(Utc::now().to_rfc3339());
            storage.put("secret", &input.secret_id, secret).await?;
        } else {
            storage.put("secret", &input.secret_id, json!({
                "secretId": input.secret_id,
                "latestVersion": new_version_id,
                "rotatedAt": Utc::now().to_rfc3339(),
                "iamBinding": true,
                "disabledVersions": "[]",
            })).await?;
        }

        Ok(GcpSmProviderRotateOutput::Ok {
            secret_id: input.secret_id,
            new_version_id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_fetch_secret_not_found() {
        let storage = InMemoryStorage::new();
        let handler = GcpSmProviderHandlerImpl;
        let result = handler.fetch(
            GcpSmProviderFetchInput {
                secret_id: "nonexistent".to_string(),
                version: "latest".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GcpSmProviderFetchOutput::SecretNotFound { secret_id, .. } => {
                assert_eq!(secret_id, "nonexistent");
            },
            _ => panic!("Expected SecretNotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_rotate_creates_new_version() {
        let storage = InMemoryStorage::new();
        let handler = GcpSmProviderHandlerImpl;
        let result = handler.rotate(
            GcpSmProviderRotateInput { secret_id: "db-password".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GcpSmProviderRotateOutput::Ok { secret_id, new_version_id } => {
                assert_eq!(secret_id, "db-password");
                assert_eq!(new_version_id, "1");
            },
        }
    }

    #[tokio::test]
    async fn test_rotate_increments_version() {
        let storage = InMemoryStorage::new();
        let handler = GcpSmProviderHandlerImpl;
        handler.rotate(
            GcpSmProviderRotateInput { secret_id: "api-key".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.rotate(
            GcpSmProviderRotateInput { secret_id: "api-key".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GcpSmProviderRotateOutput::Ok { new_version_id, .. } => {
                assert_eq!(new_version_id, "2");
            },
        }
    }

    #[tokio::test]
    async fn test_fetch_after_rotate() {
        let storage = InMemoryStorage::new();
        let handler = GcpSmProviderHandlerImpl;
        handler.rotate(
            GcpSmProviderRotateInput { secret_id: "token".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.fetch(
            GcpSmProviderFetchInput {
                secret_id: "token".to_string(),
                version: "latest".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GcpSmProviderFetchOutput::Ok { version_id, .. } => {
                assert_eq!(version_id, "1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
