// Pathauto concept implementation
// Automatic URL path alias generation from patterns and entity names.
// Includes slugification, bulk generation, and string cleaning.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::PathautoHandler;
use serde_json::json;

pub struct PathautoHandlerImpl;

/// Convert a string to a URL-safe slug
fn slugify(input: &str) -> String {
    input
        .to_lowercase()
        .trim()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == ' ' || c == '_' {
                c
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join("-")
        .replace('_', "-")
        .trim_matches('-')
        .to_string()
}

#[async_trait]
impl PathautoHandler for PathautoHandlerImpl {
    async fn generate_alias(
        &self,
        input: PathautoGenerateAliasInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PathautoGenerateAliasOutput, Box<dyn std::error::Error>> {
        let pattern_entry = storage.get("pattern", &input.pattern).await?;

        let raw_alias = if let Some(entry) = pattern_entry {
            let template = entry["template"].as_str().unwrap_or("[entity]");
            template.replace("[entity]", &input.entity)
        } else {
            input.entity.clone()
        };

        let alias = slugify(&raw_alias);

        storage.put("alias", &format!("{}:{}", input.pattern, input.entity), json!({
            "pattern": input.pattern,
            "entity": input.entity,
            "alias": alias
        })).await?;

        Ok(PathautoGenerateAliasOutput::Ok { alias })
    }

    async fn bulk_generate(
        &self,
        input: PathautoBulkGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PathautoBulkGenerateOutput, Box<dyn std::error::Error>> {
        let pattern_entry = match storage.get("pattern", &input.pattern).await? {
            Some(r) => r,
            None => return Ok(PathautoBulkGenerateOutput::Notfound),
        };

        let template = pattern_entry["template"].as_str().unwrap_or("[entity]");
        let entity_list: Vec<String> = serde_json::from_str(&input.entities).unwrap_or_default();
        let mut aliases = serde_json::Map::new();

        for entity in &entity_list {
            let raw = template.replace("[entity]", entity);
            let alias = slugify(&raw);

            storage.put("alias", &format!("{}:{}", input.pattern, entity), json!({
                "pattern": input.pattern,
                "entity": entity,
                "alias": alias
            })).await?;

            aliases.insert(entity.clone(), json!(alias));
        }

        Ok(PathautoBulkGenerateOutput::Ok {
            aliases: serde_json::to_string(&aliases)?,
        })
    }

    async fn clean_string(
        &self,
        input: PathautoCleanStringInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<PathautoCleanStringOutput, Box<dyn std::error::Error>> {
        let cleaned = slugify(&input.input);
        Ok(PathautoCleanStringOutput::Ok { cleaned })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_alias_without_pattern() {
        let storage = InMemoryStorage::new();
        let handler = PathautoHandlerImpl;
        let result = handler.generate_alias(
            PathautoGenerateAliasInput {
                pattern: "default".to_string(),
                entity: "My Article Title".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PathautoGenerateAliasOutput::Ok { alias } => {
                assert_eq!(alias, "my-article-title");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_bulk_generate_pattern_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PathautoHandlerImpl;
        let result = handler.bulk_generate(
            PathautoBulkGenerateInput {
                pattern: "nonexistent".to_string(),
                entities: r#"["Entity1","Entity2"]"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PathautoBulkGenerateOutput::Notfound => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_clean_string() {
        let storage = InMemoryStorage::new();
        let handler = PathautoHandlerImpl;
        let result = handler.clean_string(
            PathautoCleanStringInput { input: "Hello World! @#$".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PathautoCleanStringOutput::Ok { cleaned } => {
                assert_eq!(cleaned, "hello-world");
            }
        }
    }
}
