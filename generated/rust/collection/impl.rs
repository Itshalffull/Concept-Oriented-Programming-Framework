// Collection -- organize content into queryable sets
// Supports concrete (manually curated) and virtual (computed from query) collections.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CollectionHandler;
use serde_json::json;

pub struct CollectionHandlerImpl;

#[async_trait]
impl CollectionHandler for CollectionHandlerImpl {
    async fn create(
        &self,
        input: CollectionCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CollectionCreateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("collection", &input.collection).await?;
        if existing.is_some() {
            return Ok(CollectionCreateOutput::Exists);
        }

        storage.put("collection", &input.collection, json!({
            "collection": input.collection,
            "type": input.r#type,
            "schema": input.schema,
            "members": "[]",
        })).await?;

        Ok(CollectionCreateOutput::Ok)
    }

    async fn add_member(
        &self,
        input: CollectionAddMemberInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CollectionAddMemberOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("collection", &input.collection).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(CollectionAddMemberOutput::Notfound),
        };

        let members_str = record["members"].as_str().unwrap_or("[]");
        let mut members: Vec<String> = serde_json::from_str(members_str).unwrap_or_default();

        if !members.contains(&input.member) {
            members.push(input.member);
        }

        let mut updated = record.clone();
        updated["members"] = json!(serde_json::to_string(&members)?);
        storage.put("collection", &input.collection, updated).await?;

        Ok(CollectionAddMemberOutput::Ok)
    }

    async fn remove_member(
        &self,
        input: CollectionRemoveMemberInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CollectionRemoveMemberOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("collection", &input.collection).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(CollectionRemoveMemberOutput::Notfound),
        };

        let members_str = record["members"].as_str().unwrap_or("[]");
        let members: Vec<String> = serde_json::from_str(members_str).unwrap_or_default();
        let filtered: Vec<String> = members.into_iter().filter(|m| m != &input.member).collect();

        let mut updated = record.clone();
        updated["members"] = json!(serde_json::to_string(&filtered)?);
        storage.put("collection", &input.collection, updated).await?;

        Ok(CollectionRemoveMemberOutput::Ok)
    }

    async fn get_members(
        &self,
        input: CollectionGetMembersInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CollectionGetMembersOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("collection", &input.collection).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(CollectionGetMembersOutput::Notfound),
        };

        let members_str = record["members"].as_str().unwrap_or("[]");
        let members: Vec<String> = serde_json::from_str(members_str).unwrap_or_default();

        let members_value = if members.len() == 1 {
            members[0].clone()
        } else {
            members.join(",")
        };

        Ok(CollectionGetMembersOutput::Ok {
            members: members_value,
        })
    }

    async fn set_schema(
        &self,
        input: CollectionSetSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CollectionSetSchemaOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("collection", &input.collection).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(CollectionSetSchemaOutput::Notfound),
        };

        let mut updated = record.clone();
        updated["schema"] = json!(input.schema);
        storage.put("collection", &input.collection, updated).await?;

        Ok(CollectionSetSchemaOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_success() {
        let storage = InMemoryStorage::new();
        let handler = CollectionHandlerImpl;
        let result = handler.create(
            CollectionCreateInput {
                collection: "my-collection".to_string(),
                r#type: "concrete".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CollectionCreateOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_exists() {
        let storage = InMemoryStorage::new();
        let handler = CollectionHandlerImpl;

        handler.create(
            CollectionCreateInput {
                collection: "my-collection".to_string(),
                r#type: "concrete".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.create(
            CollectionCreateInput {
                collection: "my-collection".to_string(),
                r#type: "concrete".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CollectionCreateOutput::Exists => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_add_member_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CollectionHandlerImpl;
        let result = handler.add_member(
            CollectionAddMemberInput {
                collection: "nonexistent".to_string(),
                member: "item-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CollectionAddMemberOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_add_and_get_members() {
        let storage = InMemoryStorage::new();
        let handler = CollectionHandlerImpl;

        handler.create(
            CollectionCreateInput {
                collection: "test-col".to_string(),
                r#type: "concrete".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();

        handler.add_member(
            CollectionAddMemberInput {
                collection: "test-col".to_string(),
                member: "item-1".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.get_members(
            CollectionGetMembersInput {
                collection: "test-col".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CollectionGetMembersOutput::Ok { members } => {
                assert!(members.contains("item-1"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_member_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CollectionHandlerImpl;
        let result = handler.remove_member(
            CollectionRemoveMemberInput {
                collection: "nonexistent".to_string(),
                member: "item-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CollectionRemoveMemberOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_set_schema_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CollectionHandlerImpl;
        let result = handler.set_schema(
            CollectionSetSchemaInput {
                collection: "nonexistent".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CollectionSetSchemaOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
