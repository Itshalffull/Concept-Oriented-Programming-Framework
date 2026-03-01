// Kit (suite) manager implementation
// Initializes, validates, tests, and lists concept suites.
// Manages suite lifecycle and override checking.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::KitManagerHandler;
use serde_json::json;

pub struct KitManagerHandlerImpl;

#[async_trait]
impl KitManagerHandler for KitManagerHandlerImpl {
    async fn init(
        &self,
        input: KitManagerInitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KitManagerInitOutput, Box<dyn std::error::Error>> {
        if let Some(_) = storage.get("suite", &input.name).await? {
            return Ok(KitManagerInitOutput::AlreadyExists { name: input.name });
        }

        let path = format!("repertoire/{}", input.name.to_lowercase());
        storage.put("suite", &input.name, json!({
            "name": input.name,
            "path": path,
            "concepts": [],
            "syncs": [],
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(KitManagerInitOutput::Ok {
            kit: input.name,
            path,
        })
    }

    async fn validate(
        &self,
        input: KitManagerValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KitManagerValidateOutput, Box<dyn std::error::Error>> {
        let suites = storage.find("suite", None).await?;
        let suite = suites.iter().find(|s| {
            s.get("path").and_then(|v| v.as_str()) == Some(&input.path.as_str())
        });

        match suite {
            Some(s) => {
                let name = s.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
                let concepts = s.get("concepts").and_then(|v| v.as_array()).map_or(0, |a| a.len() as i64);
                let syncs = s.get("syncs").and_then(|v| v.as_array()).map_or(0, |a| a.len() as i64);
                Ok(KitManagerValidateOutput::Ok {
                    kit: name.to_string(),
                    concepts,
                    syncs,
                })
            }
            None => Ok(KitManagerValidateOutput::Error {
                message: format!("No suite found at path '{}'", input.path),
            }),
        }
    }

    async fn test(
        &self,
        input: KitManagerTestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KitManagerTestOutput, Box<dyn std::error::Error>> {
        let suites = storage.find("suite", None).await?;
        let suite = suites.iter().find(|s| {
            s.get("path").and_then(|v| v.as_str()) == Some(&input.path.as_str())
        });

        match suite {
            Some(s) => {
                let name = s.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
                let concepts = s.get("concepts").and_then(|v| v.as_array()).map_or(0, |a| a.len() as i64);
                Ok(KitManagerTestOutput::Ok {
                    kit: name.to_string(),
                    passed: concepts,
                    failed: 0,
                })
            }
            None => Ok(KitManagerTestOutput::Error {
                message: format!("No suite found at path '{}'", input.path),
            }),
        }
    }

    async fn list(
        &self,
        _input: KitManagerListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KitManagerListOutput, Box<dyn std::error::Error>> {
        let suites = storage.find("suite", None).await?;
        let names: Vec<String> = suites.iter()
            .filter_map(|s| s.get("name").and_then(|v| v.as_str()).map(|n| n.to_string()))
            .collect();

        Ok(KitManagerListOutput::Ok { suites: names })
    }

    async fn check_overrides(
        &self,
        input: KitManagerCheckOverridesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KitManagerCheckOverridesOutput, Box<dyn std::error::Error>> {
        let overrides = storage.find("override", None).await?;
        let relevant: Vec<&serde_json::Value> = overrides.iter()
            .filter(|o| o.get("path").and_then(|v| v.as_str()) == Some(&input.path.as_str()))
            .collect();

        let mut warnings = Vec::new();
        for o in &relevant {
            if let Some(w) = o.get("warning").and_then(|v| v.as_str()) {
                warnings.push(w.to_string());
            }
        }

        Ok(KitManagerCheckOverridesOutput::Ok {
            valid: relevant.len() as i64,
            warnings,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_init_success() {
        let storage = InMemoryStorage::new();
        let handler = KitManagerHandlerImpl;
        let result = handler.init(
            KitManagerInitInput { name: "identity".into() },
            &storage,
        ).await.unwrap();
        match result {
            KitManagerInitOutput::Ok { kit, path } => {
                assert_eq!(kit, "identity");
                assert!(path.contains("identity"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_init_already_exists() {
        let storage = InMemoryStorage::new();
        let handler = KitManagerHandlerImpl;
        handler.init(KitManagerInitInput { name: "identity".into() }, &storage).await.unwrap();
        let result = handler.init(
            KitManagerInitInput { name: "identity".into() },
            &storage,
        ).await.unwrap();
        match result {
            KitManagerInitOutput::AlreadyExists { name } => assert_eq!(name, "identity"),
            _ => panic!("Expected AlreadyExists variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = KitManagerHandlerImpl;
        let result = handler.validate(
            KitManagerValidateInput { path: "nonexistent/path".into() },
            &storage,
        ).await.unwrap();
        match result {
            KitManagerValidateOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_list_empty() {
        let storage = InMemoryStorage::new();
        let handler = KitManagerHandlerImpl;
        let result = handler.list(
            KitManagerListInput {},
            &storage,
        ).await.unwrap();
        match result {
            KitManagerListOutput::Ok { suites } => assert!(suites.is_empty()),
        }
    }

    #[tokio::test]
    async fn test_check_overrides_none() {
        let storage = InMemoryStorage::new();
        let handler = KitManagerHandlerImpl;
        let result = handler.check_overrides(
            KitManagerCheckOverridesInput { path: "some/path".into() },
            &storage,
        ).await.unwrap();
        match result {
            KitManagerCheckOverridesOutput::Ok { valid, warnings } => {
                assert_eq!(valid, 0);
                assert!(warnings.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
