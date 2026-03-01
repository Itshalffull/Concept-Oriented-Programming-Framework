// AwsSmProvider concept implementation
// Manage secret resolution from AWS Secrets Manager. Owns IAM session state,
// KMS key accessibility, and rotation schedule tracking.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AwsSmProviderHandler;
use serde_json::json;

pub struct AwsSmProviderHandlerImpl;

#[async_trait]
impl AwsSmProviderHandler for AwsSmProviderHandlerImpl {
    async fn fetch(
        &self,
        input: AwsSmProviderFetchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AwsSmProviderFetchOutput, Box<dyn std::error::Error>> {
        let record = storage.get("secret", &input.secret_id).await?;

        if record.is_none() {
            // Simulate creating and storing a new secret entry
            let now = chrono::Utc::now();
            let version_id = format!("ver-{}", now.timestamp_millis());
            let arn = format!("arn:aws:secretsmanager:us-east-1:123456789012:secret:{}", input.secret_id);
            let value = format!("resolved-value-for-{}", input.secret_id);

            storage.put("secret", &input.secret_id, json!({
                "secretId": input.secret_id,
                "versionStage": input.version_stage,
                "versionId": version_id,
                "arn": arn,
                "value": value,
                "region": "us-east-1",
                "kmsKeyId": null,
                "scheduleEnabled": false,
                "lastRotatedAt": null,
                "nextRotationAt": null,
                "createdAt": now.to_rfc3339(),
            })).await?;

            return Ok(AwsSmProviderFetchOutput::Ok {
                value,
                version_id,
                arn,
            });
        }

        let record = record.unwrap();

        // Check KMS key accessibility
        if let Some(kms_key_id) = record["kmsKeyId"].as_str() {
            if kms_key_id.starts_with("inaccessible:") {
                return Ok(AwsSmProviderFetchOutput::KmsKeyInaccessible {
                    secret_id: input.secret_id,
                    kms_key_id: kms_key_id.to_string(),
                });
            }
        }

        Ok(AwsSmProviderFetchOutput::Ok {
            value: record["value"].as_str().unwrap_or("").to_string(),
            version_id: record["versionId"].as_str().unwrap_or("").to_string(),
            arn: record["arn"].as_str().unwrap_or("").to_string(),
        })
    }

    async fn rotate(
        &self,
        input: AwsSmProviderRotateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AwsSmProviderRotateOutput, Box<dyn std::error::Error>> {
        let record = storage.get("secret", &input.secret_id).await?;

        if let Some(ref r) = record {
            if r["rotationInProgress"].as_bool().unwrap_or(false) {
                return Ok(AwsSmProviderRotateOutput::RotationInProgress {
                    secret_id: input.secret_id,
                });
            }
        }

        let now = chrono::Utc::now();
        let new_version_id = format!("ver-{}", now.timestamp_millis());

        if let Some(r) = record {
            let mut updated = r.clone();
            updated["versionId"] = json!(new_version_id);
            updated["lastRotatedAt"] = json!(now.to_rfc3339());
            updated["value"] = json!(format!("rotated-value-{}", new_version_id));
            storage.put("secret", &input.secret_id, updated).await?;
        }

        Ok(AwsSmProviderRotateOutput::Ok {
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
    async fn test_fetch_creates_new_secret() {
        let storage = InMemoryStorage::new();
        let handler = AwsSmProviderHandlerImpl;
        let result = handler.fetch(
            AwsSmProviderFetchInput {
                secret_id: "my-secret".to_string(),
                version_stage: "AWSCURRENT".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AwsSmProviderFetchOutput::Ok { value, version_id, arn } => {
                assert!(value.contains("my-secret"));
                assert!(version_id.starts_with("ver-"));
                assert!(arn.contains("my-secret"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_fetch_existing_secret() {
        let storage = InMemoryStorage::new();
        let handler = AwsSmProviderHandlerImpl;
        // First fetch creates it
        handler.fetch(
            AwsSmProviderFetchInput {
                secret_id: "existing-secret".to_string(),
                version_stage: "AWSCURRENT".to_string(),
            },
            &storage,
        ).await.unwrap();
        // Second fetch retrieves it
        let result = handler.fetch(
            AwsSmProviderFetchInput {
                secret_id: "existing-secret".to_string(),
                version_stage: "AWSCURRENT".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AwsSmProviderFetchOutput::Ok { value, .. } => {
                assert!(!value.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_fetch_kms_key_inaccessible() {
        let storage = InMemoryStorage::new();
        let handler = AwsSmProviderHandlerImpl;
        storage.put("secret", "locked-secret", json!({
            "secretId": "locked-secret",
            "value": "secret-val",
            "versionId": "ver-1",
            "arn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:locked-secret",
            "kmsKeyId": "inaccessible:key-123",
        })).await.unwrap();
        let result = handler.fetch(
            AwsSmProviderFetchInput {
                secret_id: "locked-secret".to_string(),
                version_stage: "AWSCURRENT".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AwsSmProviderFetchOutput::KmsKeyInaccessible { secret_id, kms_key_id } => {
                assert_eq!(secret_id, "locked-secret");
                assert!(kms_key_id.starts_with("inaccessible:"));
            }
            _ => panic!("Expected KmsKeyInaccessible variant"),
        }
    }

    #[tokio::test]
    async fn test_rotate_success() {
        let storage = InMemoryStorage::new();
        let handler = AwsSmProviderHandlerImpl;
        handler.fetch(
            AwsSmProviderFetchInput {
                secret_id: "rotate-secret".to_string(),
                version_stage: "AWSCURRENT".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.rotate(
            AwsSmProviderRotateInput { secret_id: "rotate-secret".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AwsSmProviderRotateOutput::Ok { secret_id, new_version_id } => {
                assert_eq!(secret_id, "rotate-secret");
                assert!(new_version_id.starts_with("ver-"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
