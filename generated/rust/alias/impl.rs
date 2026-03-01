// Alias concept implementation
// Map multiple names to a single entity with bidirectional resolution.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AliasHandler;
use serde_json::json;

pub struct AliasHandlerImpl;

#[async_trait]
impl AliasHandler for AliasHandlerImpl {
    async fn add_alias(
        &self,
        input: AliasAddAliasInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AliasAddAliasOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("alias", &input.entity).await?;

        let mut aliases: Vec<String> = if let Some(ref record) = existing {
            serde_json::from_str(record["aliases"].as_str().unwrap_or("[]"))?
        } else {
            Vec::new()
        };

        if aliases.contains(&input.name) {
            return Ok(AliasAddAliasOutput::Exists {
                entity: input.entity,
                name: input.name,
            });
        }

        aliases.push(input.name.clone());

        storage.put("alias", &input.entity, json!({
            "entity": input.entity,
            "aliases": serde_json::to_string(&aliases)?,
        })).await?;

        Ok(AliasAddAliasOutput::Ok {
            entity: input.entity,
            name: input.name,
        })
    }

    async fn remove_alias(
        &self,
        input: AliasRemoveAliasInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AliasRemoveAliasOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("alias", &input.entity).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(AliasRemoveAliasOutput::Notfound {
                entity: input.entity,
                name: input.name,
            }),
        };

        let mut aliases: Vec<String> = serde_json::from_str(
            existing["aliases"].as_str().unwrap_or("[]")
        )?;

        if !aliases.contains(&input.name) {
            return Ok(AliasRemoveAliasOutput::Notfound {
                entity: input.entity,
                name: input.name,
            });
        }

        aliases.retain(|a| a != &input.name);

        storage.put("alias", &input.entity, json!({
            "entity": input.entity,
            "aliases": serde_json::to_string(&aliases)?,
        })).await?;

        Ok(AliasRemoveAliasOutput::Ok {
            entity: input.entity,
            name: input.name,
        })
    }

    async fn resolve(
        &self,
        input: AliasResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AliasResolveOutput, Box<dyn std::error::Error>> {
        let all_aliases = storage.find("alias", None).await?;

        for record in &all_aliases {
            let aliases: Vec<String> = serde_json::from_str(
                record["aliases"].as_str().unwrap_or("[]")
            ).unwrap_or_default();

            if aliases.contains(&input.name) {
                return Ok(AliasResolveOutput::Ok {
                    entity: record["entity"].as_str().unwrap_or("").to_string(),
                });
            }
        }

        Ok(AliasResolveOutput::Notfound {
            name: input.name,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_add_alias_success() {
        let storage = InMemoryStorage::new();
        let handler = AliasHandlerImpl;
        let result = handler.add_alias(
            AliasAddAliasInput {
                entity: "user-1".to_string(),
                name: "admin".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AliasAddAliasOutput::Ok { entity, name } => {
                assert_eq!(entity, "user-1");
                assert_eq!(name, "admin");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_add_alias_duplicate_returns_exists() {
        let storage = InMemoryStorage::new();
        let handler = AliasHandlerImpl;
        handler.add_alias(
            AliasAddAliasInput {
                entity: "user-1".to_string(),
                name: "admin".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.add_alias(
            AliasAddAliasInput {
                entity: "user-1".to_string(),
                name: "admin".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AliasAddAliasOutput::Exists { entity, name } => {
                assert_eq!(entity, "user-1");
                assert_eq!(name, "admin");
            }
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_alias_success() {
        let storage = InMemoryStorage::new();
        let handler = AliasHandlerImpl;
        handler.add_alias(
            AliasAddAliasInput {
                entity: "user-2".to_string(),
                name: "moderator".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.remove_alias(
            AliasRemoveAliasInput {
                entity: "user-2".to_string(),
                name: "moderator".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AliasRemoveAliasOutput::Ok { entity, name } => {
                assert_eq!(entity, "user-2");
                assert_eq!(name, "moderator");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_alias_notfound() {
        let storage = InMemoryStorage::new();
        let handler = AliasHandlerImpl;
        let result = handler.remove_alias(
            AliasRemoveAliasInput {
                entity: "nonexistent".to_string(),
                name: "alias".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AliasRemoveAliasOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_finds_entity() {
        let storage = InMemoryStorage::new();
        let handler = AliasHandlerImpl;
        handler.add_alias(
            AliasAddAliasInput {
                entity: "user-3".to_string(),
                name: "superuser".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.resolve(
            AliasResolveInput { name: "superuser".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AliasResolveOutput::Ok { entity } => {
                assert_eq!(entity, "user-3");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_notfound() {
        let storage = InMemoryStorage::new();
        let handler = AliasHandlerImpl;
        let result = handler.resolve(
            AliasResolveInput { name: "unknown".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AliasResolveOutput::Notfound { name } => {
                assert_eq!(name, "unknown");
            }
            _ => panic!("Expected Notfound variant"),
        }
    }
}
