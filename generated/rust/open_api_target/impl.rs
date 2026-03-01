// OpenApiTarget concept implementation
// Generate OpenAPI 3.1 specification documents from concept projections.
// Produces CRUD-style paths and component schemas for each projection resource.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::OpenApiTargetHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);
fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("open-api-target-{}", id)
}

pub struct OpenApiTargetHandlerImpl;

#[async_trait]
impl OpenApiTargetHandler for OpenApiTargetHandlerImpl {
    async fn generate(
        &self,
        input: OpenApiTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OpenApiTargetGenerateOutput, Box<dyn std::error::Error>> {
        let config: serde_json::Value = serde_json::from_str(&input.config).unwrap_or(json!({}));
        let title = config["title"].as_str().unwrap_or("Clef OpenAPI Specification");
        let version = config["version"].as_str().unwrap_or("1.0.0");
        let base_path = config["basePath"].as_str().unwrap_or("/api");

        let mut paths = serde_json::Map::new();
        let mut schemas = serde_json::Map::new();
        let mut path_count = 0i64;
        let mut schema_count = 0i64;

        for projection in &input.projections {
            // Derive resource name: replace non-alphanumeric with hyphens
            let resource_name: String = projection
                .chars()
                .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '-' })
                .collect();
            let resource_path = format!("{}/{}", base_path, resource_name);
            let op_id_base: String = resource_name.replace('-', "");

            // Collection path: GET (list) + POST (create)
            paths.insert(resource_path.clone(), json!({
                "get": {
                    "summary": format!("List {} items", resource_name),
                    "operationId": format!("list{}", op_id_base),
                    "responses": {
                        "200": {
                            "description": format!("Successful {} list response", resource_name),
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "array",
                                        "items": { "$ref": format!("#/components/schemas/{}", resource_name) }
                                    }
                                }
                            }
                        }
                    }
                },
                "post": {
                    "summary": format!("Create a {} item", resource_name),
                    "operationId": format!("create{}", op_id_base),
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": format!("#/components/schemas/{}Input", resource_name) }
                            }
                        }
                    },
                    "responses": {
                        "201": {
                            "description": format!("{} created", resource_name),
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": format!("#/components/schemas/{}", resource_name) }
                                }
                            }
                        }
                    }
                }
            }));
            path_count += 2;

            // Instance path: GET + PUT + DELETE
            let instance_path = format!("{}/{{id}}", resource_path);
            paths.insert(instance_path, json!({
                "get": {
                    "summary": format!("Get a {} by ID", resource_name),
                    "operationId": format!("get{}", op_id_base),
                    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
                    "responses": {
                        "200": { "description": format!("{} found", resource_name) },
                        "404": { "description": "Not found" }
                    }
                },
                "put": {
                    "summary": format!("Update a {} by ID", resource_name),
                    "operationId": format!("update{}", op_id_base),
                    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
                    "responses": { "200": { "description": format!("{} updated", resource_name) } }
                },
                "delete": {
                    "summary": format!("Delete a {} by ID", resource_name),
                    "operationId": format!("delete{}", op_id_base),
                    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
                    "responses": { "204": { "description": format!("{} deleted", resource_name) } }
                }
            }));
            path_count += 3;

            // Schemas
            schemas.insert(resource_name.clone(), json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string" },
                    "createdAt": { "type": "string", "format": "date-time" },
                    "updatedAt": { "type": "string", "format": "date-time" }
                },
                "required": ["id"]
            }));
            schema_count += 1;

            schemas.insert(format!("{}Input", resource_name), json!({
                "type": "object",
                "properties": {}
            }));
            schema_count += 1;
        }

        let open_api_doc = json!({
            "openapi": "3.1.0",
            "info": { "title": title, "version": version },
            "paths": paths,
            "components": { "schemas": schemas }
        });

        let content = serde_json::to_string_pretty(&open_api_doc)?;
        let id = next_id();

        storage.put("open-api-target", &id, json!({
            "id": id,
            "version": "3.1.0",
            "paths": path_count,
            "schemas": schema_count,
            "content": content
        })).await?;

        Ok(OpenApiTargetGenerateOutput::Ok {
            spec: id,
            content,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_with_projections() {
        let storage = InMemoryStorage::new();
        let handler = OpenApiTargetHandlerImpl;
        let result = handler.generate(
            OpenApiTargetGenerateInput {
                projections: vec!["users".to_string(), "articles".to_string()],
                config: r#"{"title":"Test API","version":"2.0.0"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            OpenApiTargetGenerateOutput::Ok { spec, content } => {
                assert!(!spec.is_empty());
                assert!(content.contains("3.1.0"));
                assert!(content.contains("Test API"));
                assert!(content.contains("users"));
                assert!(content.contains("articles"));
            }
        }
    }

    #[tokio::test]
    async fn test_generate_empty_projections() {
        let storage = InMemoryStorage::new();
        let handler = OpenApiTargetHandlerImpl;
        let result = handler.generate(
            OpenApiTargetGenerateInput {
                projections: vec![],
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            OpenApiTargetGenerateOutput::Ok { content, .. } => {
                assert!(content.contains("3.1.0"));
            }
        }
    }
}
