// Middleware implementation
// Maps abstract interface traits to concrete middleware implementations
// per target. Manages trait definitions, per-target implementations,
// composition ordering, and compatibility rules.
// See architecture doc: Clef Bind, Section 1.8

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::MiddlewareHandler;
use serde_json::json;
use std::collections::HashMap;

pub struct MiddlewareHandlerImpl;

fn position_order(position: &str) -> i64 {
    match position {
        "before-auth" => 0,
        "auth" => 1,
        "after-auth" => 2,
        "validation" => 3,
        "business-logic" => 4,
        "serialization" => 5,
        _ => 999,
    }
}

#[async_trait]
impl MiddlewareHandler for MiddlewareHandlerImpl {
    async fn resolve(
        &self,
        input: MiddlewareResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MiddlewareResolveOutput, Box<dyn std::error::Error>> {
        let mut entries: Vec<(String, i64)> = Vec::new();

        for trait_name in &input.traits {
            let composite_key = format!("{}:{}", trait_name, input.target);
            let record = storage.get("middleware", &composite_key).await?;

            match record {
                Some(r) => {
                    let implementation = r.get("implementation")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let order = r.get("positionOrder")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(999);
                    entries.push((implementation, order));
                }
                None => {
                    return Ok(MiddlewareResolveOutput::MissingImplementation {
                        r#trait: trait_name.clone(),
                        target: input.target,
                    });
                }
            }
        }

        // Check pairwise incompatibility rules
        for i in 0..input.traits.len() {
            for j in (i + 1)..input.traits.len() {
                let rule_key1 = format!("{}:{}", input.traits[i], input.traits[j]);
                let rule_key2 = format!("{}:{}", input.traits[j], input.traits[i]);

                let rule = storage.get("incompatibility", &rule_key1).await?
                    .or(storage.get("incompatibility", &rule_key2).await?);

                if let Some(r) = rule {
                    let reason = r.get("reason")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Incompatible traits")
                        .to_string();
                    return Ok(MiddlewareResolveOutput::IncompatibleTraits {
                        trait1: input.traits[i].clone(),
                        trait2: input.traits[j].clone(),
                        reason,
                    });
                }
            }
        }

        // Sort by position order
        entries.sort_by_key(|e| e.1);

        let middlewares: Vec<String> = entries.iter().map(|e| e.0.clone()).collect();
        let order: Vec<i64> = entries.iter().map(|e| e.1).collect();

        Ok(MiddlewareResolveOutput::Ok { middlewares, order })
    }

    async fn inject(
        &self,
        input: MiddlewareInjectInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<MiddlewareInjectOutput, Box<dyn std::error::Error>> {
        let mut result = input.output;
        let mut injected_count = 0i64;

        for mw in &input.middlewares {
            result = format!(
                "/* middleware:{} target:{} */\n{}\n{}\n/* end middleware:{} */",
                mw, input.target, mw, result, mw
            );
            injected_count += 1;
        }

        Ok(MiddlewareInjectOutput::Ok {
            output: result,
            injected_count,
        })
    }

    async fn register(
        &self,
        input: MiddlewareRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MiddlewareRegisterOutput, Box<dyn std::error::Error>> {
        let composite_key = format!("{}:{}", input.r#trait, input.target);

        if let Some(_) = storage.get("middleware", &composite_key).await? {
            return Ok(MiddlewareRegisterOutput::DuplicateRegistration {
                r#trait: input.r#trait,
                target: input.target,
            });
        }

        let middleware_id = format!("mw-{}-{}-{}", input.r#trait, input.target, chrono::Utc::now().timestamp_millis());

        storage.put("middleware", &composite_key, json!({
            "id": middleware_id,
            "trait": input.r#trait,
            "target": input.target,
            "implementation": input.implementation,
            "position": input.position,
            "positionOrder": position_order(&input.position),
        })).await?;

        Ok(MiddlewareRegisterOutput::Ok {
            middleware: middleware_id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_middleware() {
        let storage = InMemoryStorage::new();
        let handler = MiddlewareHandlerImpl;
        let result = handler.register(
            MiddlewareRegisterInput {
                r#trait: "auth".into(),
                target: "rest".into(),
                implementation: "JwtAuthMiddleware".into(),
                position: "auth".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            MiddlewareRegisterOutput::Ok { middleware } => {
                assert!(middleware.contains("mw-auth-rest"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = MiddlewareHandlerImpl;
        handler.register(
            MiddlewareRegisterInput {
                r#trait: "auth".into(), target: "rest".into(),
                implementation: "JwtAuth".into(), position: "auth".into(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register(
            MiddlewareRegisterInput {
                r#trait: "auth".into(), target: "rest".into(),
                implementation: "JwtAuth".into(), position: "auth".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            MiddlewareRegisterOutput::DuplicateRegistration { .. } => {}
            _ => panic!("Expected DuplicateRegistration variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_missing_implementation() {
        let storage = InMemoryStorage::new();
        let handler = MiddlewareHandlerImpl;
        let result = handler.resolve(
            MiddlewareResolveInput { traits: vec!["missing-trait".into()], target: "rest".into() },
            &storage,
        ).await.unwrap();
        match result {
            MiddlewareResolveOutput::MissingImplementation { .. } => {}
            _ => panic!("Expected MissingImplementation variant"),
        }
    }

    #[tokio::test]
    async fn test_inject() {
        let storage = InMemoryStorage::new();
        let handler = MiddlewareHandlerImpl;
        let result = handler.inject(
            MiddlewareInjectInput {
                output: "const handler = {};".into(),
                middlewares: vec!["AuthMw".into(), "LogMw".into()],
                target: "rest".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            MiddlewareInjectOutput::Ok { output, injected_count } => {
                assert_eq!(injected_count, 2);
                assert!(output.contains("AuthMw"));
                assert!(output.contains("LogMw"));
            }
        }
    }
}
