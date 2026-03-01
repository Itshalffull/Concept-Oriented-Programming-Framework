// NextjsTarget -- generates Next.js App Router routes from interface projections.
// Maps concept actions to HTTP methods, validates routes for path conflicts,
// and lists routes per concept.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::NextjsTargetHandler;
use serde_json::json;

pub struct NextjsTargetHandlerImpl;

/// Classify an action name to determine the appropriate HTTP method.
fn classify_action(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    if lower.starts_with("get") || lower.starts_with("list") || lower.starts_with("find")
        || lower.starts_with("search") || lower.starts_with("fetch") || lower.starts_with("read")
    {
        "GET"
    } else if lower.starts_with("delete") || lower.starts_with("remove")
        || lower.starts_with("revoke") || lower.starts_with("unsubscribe")
    {
        "DELETE"
    } else if lower.starts_with("update") || lower.starts_with("edit")
        || lower.starts_with("modify") || lower.starts_with("patch")
    {
        "PATCH"
    } else if lower.starts_with("replace") || lower.starts_with("set") {
        "PUT"
    } else {
        "POST"
    }
}

/// Convert PascalCase to kebab-case.
fn to_kebab_case(s: &str) -> String {
    let mut result = String::new();
    for (i, c) in s.chars().enumerate() {
        if c.is_uppercase() {
            if i > 0 {
                result.push('-');
            }
            result.push(c.to_lowercase().next().unwrap());
        } else {
            result.push(c);
        }
    }
    result
}

#[async_trait]
impl NextjsTargetHandler for NextjsTargetHandlerImpl {
    async fn generate(
        &self,
        input: NextjsTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NextjsTargetGenerateOutput, Box<dyn std::error::Error>> {
        let projection: serde_json::Value = serde_json::from_str(&input.projection)
            .unwrap_or_else(|_| json!({}));
        let config: serde_json::Value = serde_json::from_str(&input.config)
            .unwrap_or_else(|_| json!({}));

        let app_dir = config.get("appDir").and_then(|v| v.as_str()).unwrap_or("app");

        let concepts = projection.get("concepts")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut routes = Vec::new();
        let mut files = Vec::new();

        for concept in &concepts {
            let name = concept.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
            let kebab_name = to_kebab_case(name);

            let actions = concept.get("actions")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            // Generate route path
            let route_path = format!("/api/{}", kebab_name);
            routes.push(route_path.clone());

            // Check for ambiguous action-to-method mappings
            let mut method_actions: std::collections::HashMap<&str, Vec<String>> = std::collections::HashMap::new();
            for action in &actions {
                let action_name = action.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
                let method = classify_action(action_name);
                method_actions.entry(method).or_default().push(action_name.to_string());
            }

            for (method, action_names) in &method_actions {
                if action_names.len() > 1 {
                    return Ok(NextjsTargetGenerateOutput::AmbiguousMapping {
                        action: action_names.join(", "),
                        reason: format!(
                            "Multiple actions ({}) map to {} for concept '{}'. Use action dispatch pattern instead.",
                            action_names.join(", "), method, name
                        ),
                    });
                }
            }

            // Generate route.ts file
            let file_path = format!("{}/api/{}/route.ts", app_dir, kebab_name);
            files.push(file_path);

            // Store route registration
            storage.put("nextjs-route", &route_path, json!({
                "route": route_path,
                "concept": name,
                "methods": method_actions.keys().collect::<Vec<_>>(),
                "actions": actions.iter()
                    .filter_map(|a| a.get("name").and_then(|v| v.as_str()))
                    .collect::<Vec<_>>(),
            })).await?;
        }

        Ok(NextjsTargetGenerateOutput::Ok { routes, files })
    }

    async fn validate(
        &self,
        input: NextjsTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NextjsTargetValidateOutput, Box<dyn std::error::Error>> {
        // Check if the route conflicts with any existing registered routes
        let all_routes = storage.find("nextjs-route", None).await?;

        for existing in &all_routes {
            let existing_route = existing.get("route").and_then(|v| v.as_str()).unwrap_or("");
            if existing_route == input.route {
                continue; // Same route is fine
            }

            // Check for dynamic segment conflicts
            // e.g., /api/[slug] conflicts with /api/users
            let existing_segments: Vec<&str> = existing_route.split('/').collect();
            let new_segments: Vec<&str> = input.route.split('/').collect();

            if existing_segments.len() == new_segments.len() {
                let mut conflict = true;
                for (e, n) in existing_segments.iter().zip(new_segments.iter()) {
                    if e.starts_with('[') || n.starts_with('[') {
                        continue; // Dynamic segments match anything
                    }
                    if e != n {
                        conflict = false;
                        break;
                    }
                }
                if conflict && existing_route != input.route {
                    return Ok(NextjsTargetValidateOutput::PathConflict {
                        route: input.route,
                        conflicting: existing_route.to_string(),
                        reason: "Routes conflict due to overlapping dynamic segments".to_string(),
                    });
                }
            }
        }

        Ok(NextjsTargetValidateOutput::Ok { route: input.route })
    }

    async fn list_routes(
        &self,
        input: NextjsTargetListRoutesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NextjsTargetListRoutesOutput, Box<dyn std::error::Error>> {
        let all_routes = storage.find("nextjs-route", None).await?;

        let mut routes = Vec::new();
        let mut methods = Vec::new();

        for route_entry in &all_routes {
            let concept = route_entry.get("concept").and_then(|v| v.as_str()).unwrap_or("");
            if concept == input.concept || input.concept.is_empty() {
                if let Some(route) = route_entry.get("route").and_then(|v| v.as_str()) {
                    routes.push(route.to_string());
                }
                if let Some(route_methods) = route_entry.get("methods").and_then(|v| v.as_array()) {
                    for m in route_methods {
                        if let Some(method) = m.as_str() {
                            if !methods.contains(&method.to_string()) {
                                methods.push(method.to_string());
                            }
                        }
                    }
                }
            }
        }

        Ok(NextjsTargetListRoutesOutput::Ok { routes, methods })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_success() {
        let storage = InMemoryStorage::new();
        let handler = NextjsTargetHandlerImpl;
        let projection = json!({
            "concepts": [
                {
                    "name": "User",
                    "actions": [
                        {"name": "create"},
                        {"name": "getById"}
                    ]
                }
            ]
        });
        let result = handler.generate(
            NextjsTargetGenerateInput {
                projection: serde_json::to_string(&projection).unwrap(),
                config: "{}".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            NextjsTargetGenerateOutput::Ok { routes, files } => {
                assert!(routes.contains(&"/api/user".to_string()));
                assert!(!files.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_ambiguous_mapping() {
        let storage = InMemoryStorage::new();
        let handler = NextjsTargetHandlerImpl;
        let projection = json!({
            "concepts": [
                {
                    "name": "Article",
                    "actions": [
                        {"name": "create"},
                        {"name": "publish"}
                    ]
                }
            ]
        });
        let result = handler.generate(
            NextjsTargetGenerateInput {
                projection: serde_json::to_string(&projection).unwrap(),
                config: "{}".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            NextjsTargetGenerateOutput::AmbiguousMapping { .. } => {}
            _ => panic!("Expected AmbiguousMapping variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_no_conflict() {
        let storage = InMemoryStorage::new();
        let handler = NextjsTargetHandlerImpl;
        let result = handler.validate(
            NextjsTargetValidateInput { route: "/api/users".into() },
            &storage,
        ).await.unwrap();
        match result {
            NextjsTargetValidateOutput::Ok { route } => assert_eq!(route, "/api/users"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_list_routes_empty() {
        let storage = InMemoryStorage::new();
        let handler = NextjsTargetHandlerImpl;
        let result = handler.list_routes(
            NextjsTargetListRoutesInput { concept: "".into() },
            &storage,
        ).await.unwrap();
        match result {
            NextjsTargetListRoutesOutput::Ok { routes, .. } => assert!(routes.is_empty()),
        }
    }
}
