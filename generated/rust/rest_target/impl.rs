use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RestTargetHandler;
use serde_json::json;

pub struct RestTargetHandlerImpl;

/// Map a concept action to an HTTP method based on naming conventions.
fn action_to_method(action: &str) -> &'static str {
    let lower = action.to_lowercase();
    if lower.starts_with("create") || lower.starts_with("add") || lower.starts_with("register") {
        "POST"
    } else if lower.starts_with("update") || lower.starts_with("set") || lower.starts_with("upsert") {
        "PUT"
    } else if lower.starts_with("delete") || lower.starts_with("remove") || lower.starts_with("destroy") {
        "DELETE"
    } else if lower.starts_with("patch") || lower.starts_with("modify") {
        "PATCH"
    } else {
        "GET"
    }
}

/// Convert a concept action name to a REST route path segment.
fn action_to_route_segment(action: &str) -> String {
    action.replace('_', "-").to_lowercase()
}

#[async_trait]
impl RestTargetHandler for RestTargetHandlerImpl {
    async fn generate(
        &self,
        input: RestTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RestTargetGenerateOutput, Box<dyn std::error::Error>> {
        let projection: serde_json::Value = serde_json::from_str(&input.projection)
            .unwrap_or(json!({"concept": "", "actions": []}));

        let concept = projection.get("concept").and_then(|v| v.as_str()).unwrap_or("");
        let actions = projection.get("actions").and_then(|v| v.as_array());

        let base_path = format!("/api/{}", concept.replace('_', "-").to_lowercase());

        let mut routes = Vec::new();
        let mut files = Vec::new();

        if let Some(action_list) = actions {
            for action_val in action_list {
                let action = action_val.as_str().unwrap_or("");
                let method = action_to_method(action);
                let segment = action_to_route_segment(action);
                let route = if method == "GET" || method == "POST" {
                    format!("{}/{}", base_path, segment)
                } else {
                    format!("{}/:{}_id/{}", base_path, concept, segment)
                };
                routes.push(format!("{} {}", method, route));
            }
        }

        files.push(format!("{}/routes.rs", concept));
        files.push(format!("{}/handlers.rs", concept));

        // Store the generated routes for later validation
        storage.put("rest-target", concept, json!({
            "concept": concept,
            "routes": routes,
            "files": files
        })).await?;

        Ok(RestTargetGenerateOutput::Ok { routes, files })
    }

    async fn validate(
        &self,
        input: RestTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RestTargetValidateOutput, Box<dyn std::error::Error>> {
        // Check for path conflicts with all stored routes
        let all_targets = storage.find("rest-target", None).await?;

        for target in &all_targets {
            if let Some(routes) = target.get("routes").and_then(|v| v.as_array()) {
                for route_val in routes {
                    let route = route_val.as_str().unwrap_or("");
                    // Extract path portion (after HTTP method)
                    let existing_path = route.split_whitespace().nth(1).unwrap_or("");
                    let input_path = input.route.split_whitespace().nth(1).unwrap_or(&input.route);

                    if existing_path == input_path && route != input.route {
                        return Ok(RestTargetValidateOutput::PathConflict {
                            route: input.route,
                            conflicting: route.to_string(),
                            reason: "Path already mapped to a different method/action".to_string(),
                        });
                    }
                }
            }
        }

        Ok(RestTargetValidateOutput::Ok {
            route: input.route,
        })
    }

    async fn list_routes(
        &self,
        input: RestTargetListRoutesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RestTargetListRoutesOutput, Box<dyn std::error::Error>> {
        let record = storage.get("rest-target", &input.concept).await?;

        if let Some(r) = record {
            let routes: Vec<String> = r.get("routes")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();

            let methods: Vec<String> = routes.iter()
                .filter_map(|r| r.split_whitespace().next().map(String::from))
                .collect();

            Ok(RestTargetListRoutesOutput::Ok { routes, methods })
        } else {
            Ok(RestTargetListRoutesOutput::Ok {
                routes: Vec::new(),
                methods: Vec::new(),
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_routes() {
        let storage = InMemoryStorage::new();
        let handler = RestTargetHandlerImpl;
        let result = handler.generate(
            RestTargetGenerateInput {
                projection: r#"{"concept":"user","actions":["createUser","getUser","deleteUser"]}"#.to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RestTargetGenerateOutput::Ok { routes, files } => {
                assert!(!routes.is_empty());
                assert!(!files.is_empty());
                assert!(routes.iter().any(|r| r.contains("POST")));
                assert!(routes.iter().any(|r| r.contains("DELETE")));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_no_conflict() {
        let storage = InMemoryStorage::new();
        let handler = RestTargetHandlerImpl;
        let result = handler.validate(
            RestTargetValidateInput { route: "GET /api/user/get-user".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RestTargetValidateOutput::Ok { .. } => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_list_routes_empty() {
        let storage = InMemoryStorage::new();
        let handler = RestTargetHandlerImpl;
        let result = handler.list_routes(
            RestTargetListRoutesInput { concept: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RestTargetListRoutesOutput::Ok { routes, methods } => {
                assert!(routes.is_empty());
                assert!(methods.is_empty());
            },
        }
    }
}
