// Navigator -- client-side navigation with route registration, history stack,
// forward/back traversal, route replacement, and navigation guards.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::NavigatorHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id(prefix: &str) -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("{}-{}", prefix, n)
}

#[async_trait]
impl NavigatorHandler for NavigatorHandlerImpl {
    async fn register(
        &self,
        input: NavigatorRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorRegisterOutput, Box<dyn std::error::Error>> {
        let id = if input.nav.is_empty() {
            next_id("N")
        } else {
            input.nav
        };

        let existing = storage.get("navigator", &id).await?;

        if let Some(record) = existing {
            // Check for duplicate destination name
            let destinations_str = record.get("destinations")
                .and_then(|v| v.as_str())
                .unwrap_or("[]");
            let mut destinations: Vec<serde_json::Value> = serde_json::from_str(destinations_str)?;

            if destinations.iter().any(|d| d.get("name").and_then(|v| v.as_str()) == Some(&input.name)) {
                return Ok(NavigatorRegisterOutput::Duplicate {
                    message: format!("Destination \"{}\" already registered", input.name),
                });
            }

            destinations.push(json!({
                "name": input.name,
                "targetConcept": input.target_concept,
                "targetView": input.target_view,
                "paramsSchema": input.params_schema.as_deref().unwrap_or(""),
                "meta": input.meta.as_deref().unwrap_or(""),
            }));

            let mut updated = record.clone();
            updated["destinations"] = json!(serde_json::to_string(&destinations)?);
            storage.put("navigator", &id, updated).await?;
        } else {
            let destinations = vec![json!({
                "name": input.name,
                "targetConcept": input.target_concept,
                "targetView": input.target_view,
                "paramsSchema": input.params_schema.as_deref().unwrap_or(""),
                "meta": input.meta.as_deref().unwrap_or(""),
            })];

            storage.put("navigator", &id, json!({
                "destinations": serde_json::to_string(&destinations)?,
                "name": input.name,
                "targetConcept": input.target_concept,
                "targetView": input.target_view,
                "paramsSchema": input.params_schema.as_deref().unwrap_or(""),
                "meta": input.meta.as_deref().unwrap_or(""),
                "current": "",
                "history": "[]",
                "forwardStack": "[]",
                "guards": "[]",
            })).await?;
        }

        Ok(NavigatorRegisterOutput::Ok { nav: id })
    }

    async fn go(
        &self,
        input: NavigatorGoInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorGoOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("navigator", &input.nav).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(NavigatorGoOutput::Notfound {
                    message: format!("Navigator \"{}\" not found", input.nav),
                });
            }
        };

        let params = input.params.as_deref().unwrap_or("");

        // Parse destination from params if possible
        let parsed_params: serde_json::Value = serde_json::from_str(params)
            .unwrap_or_else(|_| json!({ "destination": params }));

        let destination_name = parsed_params.get("destination")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if !destination_name.is_empty() {
            let destinations_str = record.get("destinations")
                .and_then(|v| v.as_str())
                .unwrap_or("[]");
            let destinations: Vec<serde_json::Value> = serde_json::from_str(destinations_str)?;

            if !destinations.iter().any(|d| d.get("name").and_then(|v| v.as_str()) == Some(destination_name)) {
                return Ok(NavigatorGoOutput::Notfound {
                    message: format!("Destination \"{}\" not found", destination_name),
                });
            }
        }

        // Check guards
        let guards_str = record.get("guards").and_then(|v| v.as_str()).unwrap_or("[]");
        let guards: Vec<String> = serde_json::from_str(guards_str)?;

        for guard in &guards {
            if guard == "block-all" {
                return Ok(NavigatorGoOutput::Blocked {
                    nav: input.nav,
                    reason: format!("Navigation blocked by guard \"{}\"", guard),
                });
            }
        }

        let previous = record.get("current").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let mut history: Vec<String> = serde_json::from_str(
            record.get("history").and_then(|v| v.as_str()).unwrap_or("[]")
        )?;

        if !previous.is_empty() {
            history.push(previous.clone());
        }

        let mut updated = record.clone();
        updated["current"] = json!(params);
        updated["history"] = json!(serde_json::to_string(&history)?);
        updated["forwardStack"] = json!("[]"); // Clear forward stack on new navigation
        storage.put("navigator", &input.nav, updated).await?;

        Ok(NavigatorGoOutput::Ok {
            nav: input.nav,
            previous: if previous.is_empty() { None } else { Some(previous) },
        })
    }

    async fn back(
        &self,
        input: NavigatorBackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorBackOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("navigator", &input.nav).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(NavigatorBackOutput::Empty {
                    message: format!("Navigator \"{}\" not found", input.nav),
                });
            }
        };

        let mut history: Vec<String> = serde_json::from_str(
            record.get("history").and_then(|v| v.as_str()).unwrap_or("[]")
        )?;

        if history.is_empty() {
            return Ok(NavigatorBackOutput::Empty {
                message: "No history to go back to".to_string(),
            });
        }

        let previous = record.get("current").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let destination = history.pop().unwrap();

        let mut forward_stack: Vec<String> = serde_json::from_str(
            record.get("forwardStack").and_then(|v| v.as_str()).unwrap_or("[]")
        )?;

        if !previous.is_empty() {
            forward_stack.push(previous.clone());
        }

        let mut updated = record.clone();
        updated["current"] = json!(destination);
        updated["history"] = json!(serde_json::to_string(&history)?);
        updated["forwardStack"] = json!(serde_json::to_string(&forward_stack)?);
        storage.put("navigator", &input.nav, updated).await?;

        Ok(NavigatorBackOutput::Ok {
            nav: input.nav,
            previous,
        })
    }

    async fn forward(
        &self,
        input: NavigatorForwardInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorForwardOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("navigator", &input.nav).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(NavigatorForwardOutput::Empty {
                    message: format!("Navigator \"{}\" not found", input.nav),
                });
            }
        };

        let mut forward_stack: Vec<String> = serde_json::from_str(
            record.get("forwardStack").and_then(|v| v.as_str()).unwrap_or("[]")
        )?;

        if forward_stack.is_empty() {
            return Ok(NavigatorForwardOutput::Empty {
                message: "No forward history".to_string(),
            });
        }

        let previous = record.get("current").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let destination = forward_stack.pop().unwrap();

        let mut history: Vec<String> = serde_json::from_str(
            record.get("history").and_then(|v| v.as_str()).unwrap_or("[]")
        )?;

        if !previous.is_empty() {
            history.push(previous.clone());
        }

        let mut updated = record.clone();
        updated["current"] = json!(destination);
        updated["history"] = json!(serde_json::to_string(&history)?);
        updated["forwardStack"] = json!(serde_json::to_string(&forward_stack)?);
        storage.put("navigator", &input.nav, updated).await?;

        Ok(NavigatorForwardOutput::Ok {
            nav: input.nav,
            previous,
        })
    }

    async fn replace(
        &self,
        input: NavigatorReplaceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorReplaceOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("navigator", &input.nav).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(NavigatorReplaceOutput::Notfound {
                    message: format!("Navigator \"{}\" not found", input.nav),
                });
            }
        };

        let previous = record.get("current").and_then(|v| v.as_str()).unwrap_or("").to_string();

        let mut updated = record.clone();
        updated["current"] = json!(input.params.as_deref().unwrap_or(""));
        storage.put("navigator", &input.nav, updated).await?;

        Ok(NavigatorReplaceOutput::Ok {
            nav: input.nav,
            previous: if previous.is_empty() { None } else { Some(previous) },
        })
    }

    async fn add_guard(
        &self,
        input: NavigatorAddGuardInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorAddGuardOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("navigator", &input.nav).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(NavigatorAddGuardOutput::Invalid {
                    message: format!("Navigator \"{}\" not found", input.nav),
                });
            }
        };

        if input.guard.is_empty() {
            return Ok(NavigatorAddGuardOutput::Invalid {
                message: "Guard identifier is required".to_string(),
            });
        }

        let mut guards: Vec<String> = serde_json::from_str(
            record.get("guards").and_then(|v| v.as_str()).unwrap_or("[]")
        )?;

        if !guards.contains(&input.guard) {
            guards.push(input.guard);
        }

        let mut updated = record.clone();
        updated["guards"] = json!(serde_json::to_string(&guards)?);
        storage.put("navigator", &input.nav, updated).await?;

        Ok(NavigatorAddGuardOutput::Ok { nav: input.nav })
    }

    async fn remove_guard(
        &self,
        input: NavigatorRemoveGuardInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorRemoveGuardOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("navigator", &input.nav).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(NavigatorRemoveGuardOutput::Notfound {
                    message: format!("Navigator \"{}\" not found", input.nav),
                });
            }
        };

        let mut guards: Vec<String> = serde_json::from_str(
            record.get("guards").and_then(|v| v.as_str()).unwrap_or("[]")
        )?;

        if !guards.contains(&input.guard) {
            return Ok(NavigatorRemoveGuardOutput::Notfound {
                message: format!("Guard \"{}\" not found", input.guard),
            });
        }

        guards.retain(|g| g != &input.guard);

        let mut updated = record.clone();
        updated["guards"] = json!(serde_json::to_string(&guards)?);
        storage.put("navigator", &input.nav, updated).await?;

        Ok(NavigatorRemoveGuardOutput::Ok { nav: input.nav })
    }
}

pub struct NavigatorHandlerImpl;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_success() {
        let storage = InMemoryStorage::new();
        let handler = NavigatorHandlerImpl;
        let result = handler.register(
            NavigatorRegisterInput {
                nav: "nav-1".into(), name: "home".into(),
                target_concept: "Dashboard".into(), target_view: "index".into(),
                params_schema: None, meta: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            NavigatorRegisterOutput::Ok { nav } => assert_eq!(nav, "nav-1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_duplicate_destination() {
        let storage = InMemoryStorage::new();
        let handler = NavigatorHandlerImpl;
        handler.register(
            NavigatorRegisterInput {
                nav: "nav-1".into(), name: "home".into(),
                target_concept: "D".into(), target_view: "v".into(),
                params_schema: None, meta: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.register(
            NavigatorRegisterInput {
                nav: "nav-1".into(), name: "home".into(),
                target_concept: "D".into(), target_view: "v".into(),
                params_schema: None, meta: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            NavigatorRegisterOutput::Duplicate { .. } => {}
            _ => panic!("Expected Duplicate variant"),
        }
    }

    #[tokio::test]
    async fn test_go_success() {
        let storage = InMemoryStorage::new();
        let handler = NavigatorHandlerImpl;
        handler.register(
            NavigatorRegisterInput {
                nav: "nav-1".into(), name: "home".into(),
                target_concept: "D".into(), target_view: "v".into(),
                params_schema: None, meta: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.go(
            NavigatorGoInput { nav: "nav-1".into(), params: Some("/page".into()) },
            &storage,
        ).await.unwrap();
        match result {
            NavigatorGoOutput::Ok { nav, .. } => assert_eq!(nav, "nav-1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_go_not_found() {
        let storage = InMemoryStorage::new();
        let handler = NavigatorHandlerImpl;
        let result = handler.go(
            NavigatorGoInput { nav: "missing".into(), params: None },
            &storage,
        ).await.unwrap();
        match result {
            NavigatorGoOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_back_empty() {
        let storage = InMemoryStorage::new();
        let handler = NavigatorHandlerImpl;
        handler.register(
            NavigatorRegisterInput {
                nav: "nav-1".into(), name: "home".into(),
                target_concept: "D".into(), target_view: "v".into(),
                params_schema: None, meta: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.back(
            NavigatorBackInput { nav: "nav-1".into() },
            &storage,
        ).await.unwrap();
        match result {
            NavigatorBackOutput::Empty { .. } => {}
            _ => panic!("Expected Empty variant"),
        }
    }

    #[tokio::test]
    async fn test_forward_empty() {
        let storage = InMemoryStorage::new();
        let handler = NavigatorHandlerImpl;
        handler.register(
            NavigatorRegisterInput {
                nav: "nav-1".into(), name: "home".into(),
                target_concept: "D".into(), target_view: "v".into(),
                params_schema: None, meta: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.forward(
            NavigatorForwardInput { nav: "nav-1".into() },
            &storage,
        ).await.unwrap();
        match result {
            NavigatorForwardOutput::Empty { .. } => {}
            _ => panic!("Expected Empty variant"),
        }
    }

    #[tokio::test]
    async fn test_replace_not_found() {
        let storage = InMemoryStorage::new();
        let handler = NavigatorHandlerImpl;
        let result = handler.replace(
            NavigatorReplaceInput { nav: "missing".into(), params: None },
            &storage,
        ).await.unwrap();
        match result {
            NavigatorReplaceOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_add_guard_and_block() {
        let storage = InMemoryStorage::new();
        let handler = NavigatorHandlerImpl;
        handler.register(
            NavigatorRegisterInput {
                nav: "nav-1".into(), name: "home".into(),
                target_concept: "D".into(), target_view: "v".into(),
                params_schema: None, meta: None,
            },
            &storage,
        ).await.unwrap();
        handler.add_guard(
            NavigatorAddGuardInput { nav: "nav-1".into(), guard: "block-all".into() },
            &storage,
        ).await.unwrap();
        let result = handler.go(
            NavigatorGoInput { nav: "nav-1".into(), params: Some("/page".into()) },
            &storage,
        ).await.unwrap();
        match result {
            NavigatorGoOutput::Blocked { .. } => {}
            _ => panic!("Expected Blocked variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_guard_not_found() {
        let storage = InMemoryStorage::new();
        let handler = NavigatorHandlerImpl;
        let result = handler.remove_guard(
            NavigatorRemoveGuardInput { nav: "missing".into(), guard: "g".into() },
            &storage,
        ).await.unwrap();
        match result {
            NavigatorRemoveGuardOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
