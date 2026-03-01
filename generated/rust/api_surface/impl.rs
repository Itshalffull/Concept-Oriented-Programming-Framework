// ApiSurface concept implementation
// Compose generated interfaces from multiple concepts into a cohesive,
// unified API surface per target (REST, GraphQL, CLI, MCP, SDK).

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ApiSurfaceHandler;
use serde_json::json;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("api-surface-{}", id)
}

pub struct ApiSurfaceHandlerImpl;

#[async_trait]
impl ApiSurfaceHandler for ApiSurfaceHandlerImpl {
    async fn compose(
        &self,
        input: ApiSurfaceComposeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApiSurfaceComposeOutput, Box<dyn std::error::Error>> {
        if input.outputs.is_empty() {
            return Ok(ApiSurfaceComposeOutput::ConflictingRoutes {
                target: input.target,
                conflicts: Vec::new(),
            });
        }

        let mut routes: Vec<serde_json::Value> = Vec::new();
        let mut seen_paths: HashMap<String, String> = HashMap::new();

        for output in &input.outputs {
            // Derive concept name from the output identifier
            let concept_name = output.strip_suffix("-output").unwrap_or(output);

            let route_path = match input.target.as_str() {
                "rest" => format!("/{}/{}", input.kit, concept_name),
                "graphql" => concept_name.to_string(),
                "cli" => format!("{} {}", input.kit, concept_name),
                "mcp" => format!("{}/{}", input.kit, concept_name),
                _ => format!("{}.{}", input.kit, concept_name),
            };

            // Check for route conflicts
            if seen_paths.contains_key(&route_path) {
                return Ok(ApiSurfaceComposeOutput::ConflictingRoutes {
                    target: input.target,
                    conflicts: vec![route_path],
                });
            }
            seen_paths.insert(route_path.clone(), concept_name.to_string());

            routes.push(json!({
                "path": route_path,
                "concept": concept_name,
                "action": "*",
            }));
        }

        // Generate entrypoint content based on target
        let entrypoint = match input.target.as_str() {
            "rest" => {
                let route_lines: Vec<String> = routes.iter().map(|r| {
                    format!("  router.use('{}', {}Router);",
                        r["path"].as_str().unwrap_or(""),
                        r["concept"].as_str().unwrap_or(""))
                }).collect();
                format!(
                    "// Auto-generated REST surface for kit: {}\nimport {{ Router }} from 'express';\n\nconst router = Router();\n{}\n\nexport default router;",
                    input.kit,
                    route_lines.join("\n")
                )
            }
            "graphql" => {
                let type_lines: Vec<String> = routes.iter().map(|r| {
                    format!("  # {} types and queries", r["concept"].as_str().unwrap_or(""))
                }).collect();
                format!(
                    "# Auto-generated GraphQL schema for kit: {}\ntype Query {{\n{}\n}}",
                    input.kit,
                    type_lines.join("\n")
                )
            }
            "cli" => {
                let cmd_lines: Vec<String> = routes.iter().map(|r| {
                    format!("  program.command('{}')", r["concept"].as_str().unwrap_or(""))
                }).collect();
                format!(
                    "// Auto-generated CLI surface for kit: {}\nimport {{ Command }} from 'commander';\nconst program = new Command('{}');\n{}\nexport default program;",
                    input.kit,
                    input.kit,
                    cmd_lines.join("\n")
                )
            }
            "mcp" => {
                let tool_lines: Vec<String> = routes.iter().map(|r| {
                    format!("  {{ name: '{}', concept: '{}' }}",
                        r["path"].as_str().unwrap_or(""),
                        r["concept"].as_str().unwrap_or(""))
                }).collect();
                format!(
                    "// Auto-generated MCP tool set for kit: {}\nexport const tools = [\n{}\n];",
                    input.kit,
                    tool_lines.join(",\n")
                )
            }
            _ => {
                let method_lines: Vec<String> = routes.iter().map(|r| {
                    let c = r["concept"].as_str().unwrap_or("");
                    format!("  {}: {}Client", c, c)
                }).collect();
                format!(
                    "// Auto-generated SDK client for kit: {}\nexport const client = {{\n{}\n}};",
                    input.kit,
                    method_lines.join(",\n")
                )
            }
        };

        let id = next_id();
        let now = chrono::Utc::now().to_rfc3339();
        let concept_count = input.outputs.len() as i64;

        storage.put("api-surface", &id, json!({
            "id": id,
            "kit": input.kit,
            "target": input.target,
            "concepts": serde_json::to_string(&input.outputs)?,
            "entrypoint": entrypoint,
            "routes": serde_json::to_string(&routes)?,
            "sharedTypes": "[]",
            "createdAt": now,
        })).await?;

        Ok(ApiSurfaceComposeOutput::Ok {
            surface: id,
            entrypoint,
            concept_count,
        })
    }

    async fn entrypoint(
        &self,
        input: ApiSurfaceEntrypointInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApiSurfaceEntrypointOutput, Box<dyn std::error::Error>> {
        let record = storage.get("api-surface", &input.surface).await?;
        match record {
            Some(r) => Ok(ApiSurfaceEntrypointOutput::Ok {
                content: r["entrypoint"].as_str().unwrap_or("").to_string(),
            }),
            None => Ok(ApiSurfaceEntrypointOutput::Ok {
                content: String::new(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_compose_rest_surface() {
        let storage = InMemoryStorage::new();
        let handler = ApiSurfaceHandlerImpl;
        let result = handler.compose(
            ApiSurfaceComposeInput {
                kit: "identity".to_string(),
                target: "rest".to_string(),
                outputs: vec!["user-output".to_string(), "profile-output".to_string()],
            },
            &storage,
        ).await.unwrap();
        match result {
            ApiSurfaceComposeOutput::Ok { surface, entrypoint, concept_count } => {
                assert!(!surface.is_empty());
                assert!(entrypoint.contains("router"));
                assert_eq!(concept_count, 2);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_compose_empty_outputs_returns_conflicting() {
        let storage = InMemoryStorage::new();
        let handler = ApiSurfaceHandlerImpl;
        let result = handler.compose(
            ApiSurfaceComposeInput {
                kit: "empty".to_string(),
                target: "rest".to_string(),
                outputs: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            ApiSurfaceComposeOutput::ConflictingRoutes { .. } => {}
            _ => panic!("Expected ConflictingRoutes variant"),
        }
    }

    #[tokio::test]
    async fn test_compose_graphql_surface() {
        let storage = InMemoryStorage::new();
        let handler = ApiSurfaceHandlerImpl;
        let result = handler.compose(
            ApiSurfaceComposeInput {
                kit: "collab".to_string(),
                target: "graphql".to_string(),
                outputs: vec!["article-output".to_string()],
            },
            &storage,
        ).await.unwrap();
        match result {
            ApiSurfaceComposeOutput::Ok { entrypoint, .. } => {
                assert!(entrypoint.contains("GraphQL"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_entrypoint_for_missing_surface() {
        let storage = InMemoryStorage::new();
        let handler = ApiSurfaceHandlerImpl;
        let result = handler.entrypoint(
            ApiSurfaceEntrypointInput { surface: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ApiSurfaceEntrypointOutput::Ok { content } => {
                assert!(content.is_empty());
            }
        }
    }
}
