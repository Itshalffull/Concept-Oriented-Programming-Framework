// Theme concept implementation
// Named themes with inheritance, activation priority, and token resolution.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ThemeHandler;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("H-{}", id)
}

pub struct ThemeHandlerImpl;

#[async_trait]
impl ThemeHandler for ThemeHandlerImpl {
    async fn create(
        &self,
        input: ThemeCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeCreateOutput, Box<dyn std::error::Error>> {
        let id = if input.theme.is_empty() { next_id() } else { input.theme };

        let existing = storage.get("theme", &id).await?;
        if existing.is_some() {
            return Ok(ThemeCreateOutput::Duplicate {
                message: format!("Theme \"{}\" already exists", id),
            });
        }

        let overrides = if input.overrides.is_empty() {
            "{}".to_string()
        } else {
            input.overrides
        };

        storage.put("theme", &id, json!({
            "name": input.name,
            "base": "",
            "overrides": overrides,
            "active": false,
            "priority": 0
        })).await?;

        Ok(ThemeCreateOutput::Ok { theme: id })
    }

    async fn extend(
        &self,
        input: ThemeExtendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeExtendOutput, Box<dyn std::error::Error>> {
        let base_theme = storage.get("theme", &input.base).await?;
        if base_theme.is_none() {
            return Ok(ThemeExtendOutput::Notfound {
                message: format!("Base theme \"{}\" not found", input.base),
            });
        }

        let base_record = base_theme.unwrap();
        let id = if input.theme.is_empty() { next_id() } else { input.theme };

        // Merge base overrides with new overrides
        let base_overrides_str = base_record["overrides"].as_str().unwrap_or("{}");
        let base_overrides: HashMap<String, serde_json::Value> =
            serde_json::from_str(base_overrides_str).unwrap_or_default();
        let new_overrides: HashMap<String, serde_json::Value> = if input.overrides.is_empty() {
            HashMap::new()
        } else {
            serde_json::from_str(&input.overrides).unwrap_or_default()
        };

        let mut merged = base_overrides;
        merged.extend(new_overrides);

        let base_name = base_record["name"].as_str().unwrap_or("");

        storage.put("theme", &id, json!({
            "name": format!("{}-extended", base_name),
            "base": input.base,
            "overrides": serde_json::to_string(&merged)?,
            "active": false,
            "priority": 0
        })).await?;

        Ok(ThemeExtendOutput::Ok { theme: id })
    }

    async fn activate(
        &self,
        input: ThemeActivateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeActivateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("theme", &input.theme).await?;
        if existing.is_none() {
            return Ok(ThemeActivateOutput::Notfound {
                message: format!("Theme \"{}\" not found", input.theme),
            });
        }

        let mut record = existing.unwrap();
        record["active"] = json!(true);
        record["priority"] = json!(input.priority);
        storage.put("theme", &input.theme, record).await?;

        Ok(ThemeActivateOutput::Ok { theme: input.theme })
    }

    async fn deactivate(
        &self,
        input: ThemeDeactivateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeDeactivateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("theme", &input.theme).await?;
        if existing.is_none() {
            return Ok(ThemeDeactivateOutput::Notfound {
                message: format!("Theme \"{}\" not found", input.theme),
            });
        }

        let mut record = existing.unwrap();
        record["active"] = json!(false);
        storage.put("theme", &input.theme, record).await?;

        Ok(ThemeDeactivateOutput::Ok { theme: input.theme })
    }

    async fn resolve(
        &self,
        input: ThemeResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeResolveOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("theme", &input.theme).await?;
        if existing.is_none() {
            return Ok(ThemeResolveOutput::Notfound {
                message: format!("Theme \"{}\" not found", input.theme),
            });
        }

        // Collect tokens by walking the inheritance chain
        let mut all_tokens: HashMap<String, serde_json::Value> = HashMap::new();
        let mut current: Option<String> = Some(input.theme);
        let mut visited = HashSet::new();

        while let Some(ref theme_id) = current {
            if visited.contains(theme_id) { break; }
            visited.insert(theme_id.clone());

            let theme_record = storage.get("theme", theme_id).await?;
            if theme_record.is_none() { break; }
            let record = theme_record.unwrap();

            let overrides_str = record["overrides"].as_str().unwrap_or("{}");
            let overrides: HashMap<String, serde_json::Value> =
                serde_json::from_str(overrides_str).unwrap_or_default();

            // Base tokens are applied first, child overrides win
            for (key, value) in overrides {
                all_tokens.entry(key).or_insert(value);
            }

            let base = record["base"].as_str().unwrap_or("");
            current = if base.is_empty() { None } else { Some(base.to_string()) };
        }

        Ok(ThemeResolveOutput::Ok {
            tokens: serde_json::to_string(&all_tokens)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_success() {
        let storage = InMemoryStorage::new();
        let handler = ThemeHandlerImpl;
        let result = handler.create(
            ThemeCreateInput {
                theme: "dark".to_string(),
                name: "Dark Theme".to_string(),
                overrides: r#"{"primary":"#000"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeCreateOutput::Ok { theme } => {
                assert_eq!(theme, "dark");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = ThemeHandlerImpl;
        handler.create(
            ThemeCreateInput {
                theme: "dark".to_string(),
                name: "Dark Theme".to_string(),
                overrides: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.create(
            ThemeCreateInput {
                theme: "dark".to_string(),
                name: "Dark Theme 2".to_string(),
                overrides: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeCreateOutput::Duplicate { .. } => {},
            _ => panic!("Expected Duplicate variant"),
        }
    }

    #[tokio::test]
    async fn test_extend_base_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ThemeHandlerImpl;
        let result = handler.extend(
            ThemeExtendInput {
                theme: "child".to_string(),
                base: "nonexistent".to_string(),
                overrides: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeExtendOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_activate_notfound() {
        let storage = InMemoryStorage::new();
        let handler = ThemeHandlerImpl;
        let result = handler.activate(
            ThemeActivateInput {
                theme: "nonexistent".to_string(),
                priority: 1,
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeActivateOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_deactivate_notfound() {
        let storage = InMemoryStorage::new();
        let handler = ThemeHandlerImpl;
        let result = handler.deactivate(
            ThemeDeactivateInput {
                theme: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeDeactivateOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_notfound() {
        let storage = InMemoryStorage::new();
        let handler = ThemeHandlerImpl;
        let result = handler.resolve(
            ThemeResolveInput {
                theme: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeResolveOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_returns_tokens() {
        let storage = InMemoryStorage::new();
        let handler = ThemeHandlerImpl;
        handler.create(
            ThemeCreateInput {
                theme: "light".to_string(),
                name: "Light Theme".to_string(),
                overrides: r#"{"primary":"#fff","secondary":"#eee"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.resolve(
            ThemeResolveInput { theme: "light".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ThemeResolveOutput::Ok { tokens } => {
                assert!(tokens.contains("primary"));
                assert!(tokens.contains("#fff"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
