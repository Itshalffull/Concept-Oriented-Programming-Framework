// Env Handler Implementation
//
// Environment management for deployment targets. Resolves environment
// configurations, handles promotion pipelines, and computes diffs.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::EnvHandler;
use serde_json::json;

pub struct EnvHandlerImpl;

fn generate_id(prefix: &str) -> String {
    use std::time::SystemTime;
    let ts = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let rand = ts % 0xFFFFFF;
    format!("{}-{}-{:06x}", prefix, ts, rand)
}

#[async_trait]
impl EnvHandler for EnvHandlerImpl {
    async fn resolve(
        &self,
        input: EnvResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnvResolveOutput, Box<dyn std::error::Error>> {
        let environment = &input.environment;

        if environment.is_empty() || environment.trim().is_empty() {
            return Ok(EnvResolveOutput::MissingBase {
                environment: environment.clone(),
            });
        }

        let env_id = generate_id("env");
        let tier = if environment == "production" { "production" } else { "preview" };
        let resolved = json!({
            "name": environment,
            "region": "us-east-1",
            "tier": tier,
        });
        let resolved_str = serde_json::to_string(&resolved)?;

        storage.put("env", &env_id, json!({
            "environment": env_id,
            "name": environment,
            "resolved": resolved_str,
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(EnvResolveOutput::Ok {
            environment: env_id,
            resolved: resolved_str,
        })
    }

    async fn promote(
        &self,
        input: EnvPromoteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnvPromoteOutput, Box<dyn std::error::Error>> {
        let from_record = storage.get("env", &input.from_env).await?;

        if from_record.is_none() {
            return Ok(EnvPromoteOutput::NotValidated {
                from_env: input.from_env,
                kit_name: input.kit_name,
            });
        }

        let from_record = from_record.unwrap();
        let version = "1.0.0".to_string();

        let to_id = if input.to_env.is_empty() {
            generate_id("env")
        } else {
            input.to_env.clone()
        };

        storage.put("env", &to_id, json!({
            "environment": to_id,
            "name": input.to_env,
            "resolved": from_record["resolved"],
            "promotedFrom": input.from_env,
            "promotedVersion": version,
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(EnvPromoteOutput::Ok {
            to_env: to_id,
            version,
        })
    }

    async fn diff(
        &self,
        input: EnvDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnvDiffOutput, Box<dyn std::error::Error>> {
        let record_a = storage.get("env", &input.env_a).await?;
        let record_b = storage.get("env", &input.env_b).await?;

        let mut differences = Vec::new();

        match (&record_a, &record_b) {
            (Some(a), Some(b)) => {
                let resolved_a = a["resolved"].as_str().unwrap_or("");
                let resolved_b = b["resolved"].as_str().unwrap_or("");
                if resolved_a != resolved_b {
                    differences.push(format!(
                        "config differs between {} and {}",
                        input.env_a, input.env_b
                    ));
                }
            }
            _ => {
                if record_a.is_none() {
                    differences.push(format!("{} not found", input.env_a));
                }
                if record_b.is_none() {
                    differences.push(format!("{} not found", input.env_b));
                }
            }
        }

        Ok(EnvDiffOutput::Ok { differences })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_resolve_success() {
        let storage = InMemoryStorage::new();
        let handler = EnvHandlerImpl;
        let result = handler.resolve(
            EnvResolveInput {
                environment: "staging".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EnvResolveOutput::Ok { environment, resolved } => {
                assert!(!environment.is_empty());
                assert!(resolved.contains("staging"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_empty_environment() {
        let storage = InMemoryStorage::new();
        let handler = EnvHandlerImpl;
        let result = handler.resolve(
            EnvResolveInput {
                environment: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EnvResolveOutput::MissingBase { .. } => {},
            _ => panic!("Expected MissingBase variant"),
        }
    }

    #[tokio::test]
    async fn test_promote_not_validated() {
        let storage = InMemoryStorage::new();
        let handler = EnvHandlerImpl;
        let result = handler.promote(
            EnvPromoteInput {
                from_env: "nonexistent".to_string(),
                to_env: "production".to_string(),
                kit_name: "my-kit".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EnvPromoteOutput::NotValidated { .. } => {},
            _ => panic!("Expected NotValidated variant"),
        }
    }

    #[tokio::test]
    async fn test_diff_missing_envs() {
        let storage = InMemoryStorage::new();
        let handler = EnvHandlerImpl;
        let result = handler.diff(
            EnvDiffInput {
                env_a: "env-a".to_string(),
                env_b: "env-b".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EnvDiffOutput::Ok { differences } => {
                assert!(!differences.is_empty());
            },
        }
    }
}
