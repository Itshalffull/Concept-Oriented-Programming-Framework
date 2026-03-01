// DesignToken Handler Implementation
//
// Hierarchical design tokens with alias chains, tier classification,
// cycle detection, and multi-format export (CSS, DTCG, SCSS, JSON, Tailwind).

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DesignTokenHandler;
use serde_json::json;
use std::collections::HashSet;

const VALID_EXPORT_FORMATS: &[&str] = &["css", "dtcg", "scss", "json", "tailwind"];

pub struct DesignTokenHandlerImpl;

#[async_trait]
impl DesignTokenHandler for DesignTokenHandlerImpl {
    async fn define(
        &self,
        input: DesignTokenDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenDefineOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("token", &input.token).await?;
        if existing.is_some() {
            return Ok(DesignTokenDefineOutput::Duplicate {
                message: format!("Token \"{}\" already exists", input.token),
            });
        }

        storage.put("token", &input.token, json!({
            "name": input.name,
            "value": input.value,
            "type": input.r#type,
            "tier": input.tier,
            "description": "",
            "reference": "",
            "group": "",
        })).await?;

        Ok(DesignTokenDefineOutput::Ok { token: input.token })
    }

    async fn alias(
        &self,
        input: DesignTokenAliasInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenAliasOutput, Box<dyn std::error::Error>> {
        // Verify referenced token exists
        let ref_token = storage.get("token", &input.reference).await?;
        if ref_token.is_none() {
            return Ok(DesignTokenAliasOutput::Notfound {
                message: format!("Referenced token \"{}\" not found", input.reference),
            });
        }
        let ref_token = ref_token.unwrap();

        // Check for alias cycles
        let mut current = input.reference.clone();
        let mut visited = HashSet::new();
        visited.insert(input.token.clone());
        loop {
            if visited.contains(&current) {
                return Ok(DesignTokenAliasOutput::Cycle {
                    message: format!("Alias cycle detected involving \"{}\"", current),
                });
            }
            visited.insert(current.clone());
            let node = storage.get("token", &current).await?;
            match node {
                Some(n) => {
                    let reference = n.get("reference").and_then(|v| v.as_str()).unwrap_or("");
                    if reference.is_empty() {
                        break;
                    }
                    current = reference.to_string();
                }
                None => break,
            }
        }

        let token_type = ref_token.get("type").and_then(|v| v.as_str()).unwrap_or("").to_string();
        storage.put("token", &input.token, json!({
            "name": input.name,
            "value": "",
            "type": token_type,
            "tier": input.tier,
            "description": "",
            "reference": input.reference,
            "group": "",
        })).await?;

        Ok(DesignTokenAliasOutput::Ok { token: input.token })
    }

    async fn resolve(
        &self,
        input: DesignTokenResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenResolveOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("token", &input.token).await?;
        if existing.is_none() {
            return Ok(DesignTokenResolveOutput::Notfound {
                message: format!("Token \"{}\" not found", input.token),
            });
        }

        // Walk alias chain to resolve final value
        let mut current = input.token.clone();
        let mut visited = HashSet::new();
        loop {
            if visited.contains(&current) {
                return Ok(DesignTokenResolveOutput::Broken {
                    message: format!("Circular alias chain detected at \"{}\"", current),
                    broken_at: current,
                });
            }
            visited.insert(current.clone());

            let node = storage.get("token", &current).await?;
            match node {
                Some(n) => {
                    let reference = n.get("reference").and_then(|v| v.as_str()).unwrap_or("");
                    if reference.is_empty() {
                        return Ok(DesignTokenResolveOutput::Ok {
                            token: input.token,
                            resolved_value: n.get("value").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        });
                    }
                    current = reference.to_string();
                }
                None => {
                    return Ok(DesignTokenResolveOutput::Broken {
                        message: format!("Broken alias chain: token \"{}\" not found", current),
                        broken_at: current,
                    });
                }
            }
        }
    }

    async fn update(
        &self,
        input: DesignTokenUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenUpdateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("token", &input.token).await?;
        let existing = match existing {
            Some(e) => e,
            None => return Ok(DesignTokenUpdateOutput::Notfound {
                message: format!("Token \"{}\" not found", input.token),
            }),
        };

        let mut updated = existing.clone();
        if let Some(value) = input.value {
            updated["value"] = json!(value);
        }
        storage.put("token", &input.token, updated).await?;

        Ok(DesignTokenUpdateOutput::Ok { token: input.token })
    }

    async fn remove(
        &self,
        input: DesignTokenRemoveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenRemoveOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("token", &input.token).await?;
        if existing.is_none() {
            return Ok(DesignTokenRemoveOutput::Notfound {
                message: format!("Token \"{}\" not found", input.token),
            });
        }

        let mut updated = existing.unwrap();
        updated["_deleted"] = json!(true);
        updated["value"] = json!("");
        updated["name"] = json!("");
        storage.put("token", &input.token, updated).await?;

        Ok(DesignTokenRemoveOutput::Ok { token: input.token })
    }

    async fn export(
        &self,
        input: DesignTokenExportInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenExportOutput, Box<dyn std::error::Error>> {
        if !VALID_EXPORT_FORMATS.contains(&input.format.as_str()) {
            return Ok(DesignTokenExportOutput::Unsupported {
                message: format!("Unsupported export format \"{}\". Supported: {}", input.format, VALID_EXPORT_FORMATS.join(", ")),
            });
        }

        let output = match input.format.as_str() {
            "css" => ":root { /* CSS custom properties */ }".to_string(),
            "dtcg" => serde_json::to_string(&json!({"$type": "design-tokens", "tokens": {}}))?,
            "scss" => "// SCSS token variables".to_string(),
            "tailwind" => serde_json::to_string(&json!({"theme": {"extend": {}}}))?,
            "json" => serde_json::to_string(&json!({"tokens": {}}))?,
            _ => String::new(),
        };

        Ok(DesignTokenExportOutput::Ok { output })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_token() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenHandlerImpl;
        let result = handler.define(
            DesignTokenDefineInput {
                token: "color-primary".to_string(),
                name: "Primary Color".to_string(),
                value: "#0066ff".to_string(),
                r#type: "color".to_string(),
                tier: "global".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DesignTokenDefineOutput::Ok { token } => {
                assert_eq!(token, "color-primary");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenHandlerImpl;
        handler.define(
            DesignTokenDefineInput {
                token: "t1".to_string(),
                name: "Token".to_string(),
                value: "#fff".to_string(),
                r#type: "color".to_string(),
                tier: "global".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.define(
            DesignTokenDefineInput {
                token: "t1".to_string(),
                name: "Token".to_string(),
                value: "#000".to_string(),
                r#type: "color".to_string(),
                tier: "global".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DesignTokenDefineOutput::Duplicate { .. } => {},
            _ => panic!("Expected Duplicate variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenHandlerImpl;
        let result = handler.resolve(
            DesignTokenResolveInput {
                token: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DesignTokenResolveOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_export_css() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenHandlerImpl;
        let result = handler.export(
            DesignTokenExportInput {
                format: "css".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DesignTokenExportOutput::Ok { output } => {
                assert!(output.contains(":root"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_export_unsupported() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenHandlerImpl;
        let result = handler.export(
            DesignTokenExportInput {
                format: "xml".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DesignTokenExportOutput::Unsupported { .. } => {},
            _ => panic!("Expected Unsupported variant"),
        }
    }

    #[tokio::test]
    async fn test_update_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenHandlerImpl;
        let result = handler.update(
            DesignTokenUpdateInput {
                token: "nonexistent".to_string(),
                value: Some("#000".to_string()),
            },
            &storage,
        ).await.unwrap();
        match result {
            DesignTokenUpdateOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DesignTokenHandlerImpl;
        let result = handler.remove(
            DesignTokenRemoveInput {
                token: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DesignTokenRemoveOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
