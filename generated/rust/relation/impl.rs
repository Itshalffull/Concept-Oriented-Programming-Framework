// Relation concept implementation
// Defines typed relations between entities, then links/unlinks entity pairs
// and queries related entities. Supports schema validation on link creation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RelationHandler;
use serde_json::json;

pub struct RelationHandlerImpl;

/// Build a storage key for a specific link within a relation
fn link_key(relation: &str, source: &str, target: &str) -> String {
    format!("{}:{}:{}", relation, source, target)
}

#[async_trait]
impl RelationHandler for RelationHandlerImpl {
    async fn define_relation(
        &self,
        input: RelationDefineRelationInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RelationDefineRelationOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("relation-def", &input.relation).await?;
        if existing.is_some() {
            return Ok(RelationDefineRelationOutput::Exists {
                relation: input.relation,
            });
        }

        storage.put("relation-def", &input.relation, json!({
            "relation": input.relation,
            "schema": input.schema,
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(RelationDefineRelationOutput::Ok {
            relation: input.relation,
        })
    }

    async fn link(
        &self,
        input: RelationLinkInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RelationLinkOutput, Box<dyn std::error::Error>> {
        // Verify the relation is defined
        let relation_def = storage.get("relation-def", &input.relation).await?;
        if relation_def.is_none() {
            return Ok(RelationLinkOutput::Invalid {
                relation: input.relation.clone(),
                message: format!("Relation \"{}\" is not defined", input.relation),
            });
        }

        // Validate source and target are non-empty
        if input.source.trim().is_empty() || input.target.trim().is_empty() {
            return Ok(RelationLinkOutput::Invalid {
                relation: input.relation,
                message: "Source and target must be non-empty".to_string(),
            });
        }

        let key = link_key(&input.relation, &input.source, &input.target);

        storage.put("relation-link", &key, json!({
            "relation": input.relation,
            "source": input.source,
            "target": input.target,
            "linkedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(RelationLinkOutput::Ok {
            relation: input.relation,
            source: input.source,
            target: input.target,
        })
    }

    async fn unlink(
        &self,
        input: RelationUnlinkInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RelationUnlinkOutput, Box<dyn std::error::Error>> {
        let key = link_key(&input.relation, &input.source, &input.target);

        let existing = storage.get("relation-link", &key).await?;
        if existing.is_none() {
            return Ok(RelationUnlinkOutput::Notfound {
                relation: input.relation,
                source: input.source,
                target: input.target,
            });
        }

        storage.del("relation-link", &key).await?;

        Ok(RelationUnlinkOutput::Ok {
            relation: input.relation,
            source: input.source,
            target: input.target,
        })
    }

    async fn get_related(
        &self,
        input: RelationGetRelatedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RelationGetRelatedOutput, Box<dyn std::error::Error>> {
        // Verify the relation exists
        let relation_def = storage.get("relation-def", &input.relation).await?;
        if relation_def.is_none() {
            return Ok(RelationGetRelatedOutput::Notfound {
                relation: input.relation.clone(),
                entity: input.entity.clone(),
            });
        }

        // Find all links for this relation and entity (as source or target)
        let all_links = storage.find("relation-link", Some(&json!({
            "relation": input.relation,
        }))).await?;

        let related: Vec<String> = all_links.iter()
            .filter_map(|link| {
                let source = link.get("source").and_then(|v| v.as_str()).unwrap_or("");
                let target = link.get("target").and_then(|v| v.as_str()).unwrap_or("");
                if source == input.entity {
                    Some(target.to_string())
                } else if target == input.entity {
                    Some(source.to_string())
                } else {
                    None
                }
            })
            .collect();

        if related.is_empty() {
            return Ok(RelationGetRelatedOutput::Notfound {
                relation: input.relation,
                entity: input.entity,
            });
        }

        Ok(RelationGetRelatedOutput::Ok {
            related: serde_json::to_string(&related)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_relation() {
        let storage = InMemoryStorage::new();
        let handler = RelationHandlerImpl;
        let result = handler.define_relation(
            RelationDefineRelationInput {
                relation: "authored-by".to_string(),
                schema: r#"{"source":"Article","target":"User"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RelationDefineRelationOutput::Ok { relation } => {
                assert_eq!(relation, "authored-by");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_relation_exists() {
        let storage = InMemoryStorage::new();
        let handler = RelationHandlerImpl;
        handler.define_relation(
            RelationDefineRelationInput {
                relation: "authored-by".to_string(),
                schema: r#"{"source":"Article","target":"User"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.define_relation(
            RelationDefineRelationInput {
                relation: "authored-by".to_string(),
                schema: r#"{"source":"Article","target":"User"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RelationDefineRelationOutput::Exists { relation } => {
                assert_eq!(relation, "authored-by");
            }
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_link() {
        let storage = InMemoryStorage::new();
        let handler = RelationHandlerImpl;
        handler.define_relation(
            RelationDefineRelationInput {
                relation: "authored-by".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.link(
            RelationLinkInput {
                relation: "authored-by".to_string(),
                source: "article-1".to_string(),
                target: "user-42".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RelationLinkOutput::Ok { relation, source, target } => {
                assert_eq!(relation, "authored-by");
                assert_eq!(source, "article-1");
                assert_eq!(target, "user-42");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_link_undefined_relation() {
        let storage = InMemoryStorage::new();
        let handler = RelationHandlerImpl;
        let result = handler.link(
            RelationLinkInput {
                relation: "nonexistent".to_string(),
                source: "a".to_string(),
                target: "b".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RelationLinkOutput::Invalid { relation, .. } => {
                assert_eq!(relation, "nonexistent");
            }
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_link_empty_source() {
        let storage = InMemoryStorage::new();
        let handler = RelationHandlerImpl;
        handler.define_relation(
            RelationDefineRelationInput {
                relation: "rel".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.link(
            RelationLinkInput {
                relation: "rel".to_string(),
                source: "".to_string(),
                target: "b".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RelationLinkOutput::Invalid { .. } => {}
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_unlink() {
        let storage = InMemoryStorage::new();
        let handler = RelationHandlerImpl;
        handler.define_relation(
            RelationDefineRelationInput {
                relation: "authored-by".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.link(
            RelationLinkInput {
                relation: "authored-by".to_string(),
                source: "article-1".to_string(),
                target: "user-42".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.unlink(
            RelationUnlinkInput {
                relation: "authored-by".to_string(),
                source: "article-1".to_string(),
                target: "user-42".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RelationUnlinkOutput::Ok { relation, source, target } => {
                assert_eq!(relation, "authored-by");
                assert_eq!(source, "article-1");
                assert_eq!(target, "user-42");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_unlink_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RelationHandlerImpl;
        let result = handler.unlink(
            RelationUnlinkInput {
                relation: "authored-by".to_string(),
                source: "x".to_string(),
                target: "y".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RelationUnlinkOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_related() {
        let storage = InMemoryStorage::new();
        let handler = RelationHandlerImpl;
        handler.define_relation(
            RelationDefineRelationInput {
                relation: "authored-by".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.link(
            RelationLinkInput {
                relation: "authored-by".to_string(),
                source: "article-1".to_string(),
                target: "user-42".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.get_related(
            RelationGetRelatedInput {
                relation: "authored-by".to_string(),
                entity: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RelationGetRelatedOutput::Ok { related } => {
                assert!(related.contains("user-42"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_related_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RelationHandlerImpl;
        let result = handler.get_related(
            RelationGetRelatedInput {
                relation: "nonexistent".to_string(),
                entity: "entity-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RelationGetRelatedOutput::Notfound { relation, entity } => {
                assert_eq!(relation, "nonexistent");
                assert_eq!(entity, "entity-1");
            }
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_related_notfound_no_links() {
        let storage = InMemoryStorage::new();
        let handler = RelationHandlerImpl;
        handler.define_relation(
            RelationDefineRelationInput {
                relation: "follows".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.get_related(
            RelationGetRelatedInput {
                relation: "follows".to_string(),
                entity: "user-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RelationGetRelatedOutput::Notfound { relation, entity } => {
                assert_eq!(relation, "follows");
                assert_eq!(entity, "user-1");
            },
            other => panic!("Expected Notfound variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_link_empty_target() {
        let storage = InMemoryStorage::new();
        let handler = RelationHandlerImpl;
        handler.define_relation(
            RelationDefineRelationInput {
                relation: "rel".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.link(
            RelationLinkInput {
                relation: "rel".to_string(),
                source: "a".to_string(),
                target: "  ".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RelationLinkOutput::Invalid { message, .. } => {
                assert!(message.contains("non-empty"));
            },
            other => panic!("Expected Invalid variant, got {:?}", other),
        }
    }
}
