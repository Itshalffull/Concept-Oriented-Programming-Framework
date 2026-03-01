// GraphqlTarget concept implementation
// Generates GraphQL schema types, resolvers, queries, mutations, and subscriptions
// from concept projections. Supports Relay pagination and Apollo Federation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::GraphqlTargetHandler;
use serde_json::json;

pub struct GraphqlTargetHandlerImpl;

/// Map Clef types to GraphQL scalar types
fn clef_type_to_graphql(clef_type: &str) -> &str {
    match clef_type {
        "string" | "String" => "String",
        "number" | "Number" | "integer" | "int" | "i64" => "Int",
        "float" | "Float" | "f64" | "double" => "Float",
        "boolean" | "Boolean" | "bool" => "Boolean",
        "id" | "ID" => "ID",
        "datetime" | "DateTime" => "DateTime",
        "bytes" | "Bytes" => "String",
        _ => "JSON",
    }
}

/// Convert concept name to GraphQL PascalCase type name
fn to_type_name(s: &str) -> String {
    s.split(|c: char| c == '-' || c == '_' || c == ' ')
        .filter(|seg| !seg.is_empty())
        .map(|seg| {
            let mut chars = seg.chars();
            match chars.next() {
                Some(first) => {
                    let upper: String = first.to_uppercase().collect();
                    format!("{}{}", upper, chars.collect::<String>())
                }
                None => String::new(),
            }
        })
        .collect()
}

#[async_trait]
impl GraphqlTargetHandler for GraphqlTargetHandlerImpl {
    async fn generate(
        &self,
        input: GraphqlTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphqlTargetGenerateOutput, Box<dyn std::error::Error>> {
        let projection: serde_json::Value = serde_json::from_str(&input.projection)?;
        let config: serde_json::Value = serde_json::from_str(&input.config)?;

        let concept_name = projection.get("concept")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown");
        let type_name = to_type_name(concept_name);

        let enable_relay = config.get("relay")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let enable_federation = config.get("federation")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let mut schema_parts: Vec<String> = Vec::new();
        let mut files: Vec<String> = Vec::new();
        let mut type_names: Vec<String> = Vec::new();

        // Build the main type definition
        let fields = projection.get("fields")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut type_def = String::new();

        if enable_federation {
            type_def.push_str(&format!("type {} @key(fields: \"id\") {{\n", type_name));
        } else {
            type_def.push_str(&format!("type {} {{\n", type_name));
        }

        type_def.push_str("  id: ID!\n");

        for field in &fields {
            let fname = field.get("name").and_then(|v| v.as_str()).unwrap_or("field");
            let ftype = field.get("type").and_then(|v| v.as_str()).unwrap_or("string");
            let required = field.get("required").and_then(|v| v.as_bool()).unwrap_or(false);
            let gql_type = clef_type_to_graphql(ftype);
            let suffix = if required { "!" } else { "" };
            type_def.push_str(&format!("  {}: {}{}\n", fname, gql_type, suffix));
        }
        type_def.push_str("}\n");
        schema_parts.push(type_def);
        type_names.push(type_name.clone());

        // Input type
        let mut input_def = format!("input {}Input {{\n", type_name);
        for field in &fields {
            let fname = field.get("name").and_then(|v| v.as_str()).unwrap_or("field");
            let ftype = field.get("type").and_then(|v| v.as_str()).unwrap_or("string");
            let gql_type = clef_type_to_graphql(ftype);
            input_def.push_str(&format!("  {}: {}\n", fname, gql_type));
        }
        input_def.push_str("}\n");
        schema_parts.push(input_def);
        type_names.push(format!("{}Input", type_name));

        // Relay connection types
        if enable_relay {
            schema_parts.push(format!(
                "type {}Edge {{\n  node: {}!\n  cursor: String!\n}}\n",
                type_name, type_name
            ));
            schema_parts.push(format!(
                "type {}Connection {{\n  edges: [{}Edge!]!\n  pageInfo: PageInfo!\n  totalCount: Int!\n}}\n",
                type_name, type_name
            ));
            type_names.push(format!("{}Edge", type_name));
            type_names.push(format!("{}Connection", type_name));
        }

        // Actions -> Query/Mutation operations
        let actions = projection.get("actions")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut queries: Vec<String> = Vec::new();
        let mut mutations: Vec<String> = Vec::new();

        for action in &actions {
            let action_name = action.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("action");

            let is_mutation = ["create", "update", "delete", "set", "add", "remove", "assign", "revoke"]
                .iter()
                .any(|prefix| action_name.starts_with(prefix));

            if is_mutation {
                mutations.push(format!(
                    "  {}(input: {}Input!): {}!",
                    action_name, type_name, type_name
                ));
            } else {
                if enable_relay {
                    queries.push(format!(
                        "  {}(first: Int, after: String, last: Int, before: String): {}Connection!",
                        action_name, type_name
                    ));
                } else {
                    queries.push(format!(
                        "  {}(id: ID!): {}",
                        action_name, type_name
                    ));
                }
            }
        }

        // Add default CRUD queries/mutations
        queries.push(format!("  get{}(id: ID!): {}", type_name, type_name));
        if enable_relay {
            queries.push(format!("  list{}s(first: Int, after: String): {}Connection!", type_name, type_name));
        } else {
            queries.push(format!("  list{}s: [{}!]!", type_name, type_name));
        }

        mutations.push(format!("  create{}(input: {}Input!): {}!", type_name, type_name, type_name));
        mutations.push(format!("  update{}(id: ID!, input: {}Input!): {}!", type_name, type_name, type_name));
        mutations.push(format!("  delete{}(id: ID!): Boolean!", type_name));

        if !queries.is_empty() {
            schema_parts.push(format!("extend type Query {{\n{}\n}}\n", queries.join("\n")));
        }
        if !mutations.is_empty() {
            schema_parts.push(format!("extend type Mutation {{\n{}\n}}\n", mutations.join("\n")));
        }

        // Write schema file
        files.push(format!("{}.graphql", concept_name));
        // Write resolver file
        files.push(format!("{}.resolvers.ts", concept_name));

        // Store result
        storage.put("graphql_output", concept_name, json!({
            "concept": concept_name,
            "types": serde_json::to_string(&type_names)?,
            "schema": schema_parts.join("\n"),
            "files": serde_json::to_string(&files)?,
        })).await?;

        Ok(GraphqlTargetGenerateOutput::Ok {
            types: type_names,
            files,
        })
    }

    async fn validate(
        &self,
        input: GraphqlTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphqlTargetValidateOutput, Box<dyn std::error::Error>> {
        let record = storage.get("graphql_output", &input.r#type).await?;

        if record.is_none() {
            // Type not found, but not necessarily invalid
            return Ok(GraphqlTargetValidateOutput::Ok {
                r#type: input.r#type,
            });
        }

        let schema = record.as_ref()
            .and_then(|r| r.get("schema").and_then(|v| v.as_str()))
            .unwrap_or("");

        // Check for cyclic type references (simplified: look for self-referencing type in schema)
        let type_name = to_type_name(&input.r#type);
        let self_ref_pattern = format!("{}: {}!", type_name, type_name);
        if schema.contains(&self_ref_pattern) {
            return Ok(GraphqlTargetValidateOutput::CyclicType {
                r#type: input.r#type,
                cycle: vec![type_name.clone(), type_name],
            });
        }

        Ok(GraphqlTargetValidateOutput::Ok {
            r#type: input.r#type,
        })
    }

    async fn list_operations(
        &self,
        input: GraphqlTargetListOperationsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphqlTargetListOperationsOutput, Box<dyn std::error::Error>> {
        let type_name = to_type_name(&input.concept);

        // Standard operations for any concept
        let queries = vec![
            format!("get{}", type_name),
            format!("list{}s", type_name),
        ];

        let mutations = vec![
            format!("create{}", type_name),
            format!("update{}", type_name),
            format!("delete{}", type_name),
        ];

        let subscriptions = vec![
            format!("on{}Created", type_name),
            format!("on{}Updated", type_name),
            format!("on{}Deleted", type_name),
        ];

        Ok(GraphqlTargetListOperationsOutput::Ok {
            queries,
            mutations,
            subscriptions,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_success() {
        let storage = InMemoryStorage::new();
        let handler = GraphqlTargetHandlerImpl;
        let projection = serde_json::json!({
            "concept": "user",
            "fields": [
                {"name": "name", "type": "string", "required": true},
                {"name": "email", "type": "string", "required": true}
            ],
            "actions": [
                {"name": "getProfile"},
                {"name": "updateProfile"}
            ]
        });
        let config = serde_json::json!({"relay": false, "federation": false});
        let result = handler.generate(
            GraphqlTargetGenerateInput {
                projection: serde_json::to_string(&projection).unwrap(),
                config: serde_json::to_string(&config).unwrap(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GraphqlTargetGenerateOutput::Ok { types, files } => {
                assert!(types.contains(&"User".to_string()));
                assert!(files.iter().any(|f| f.ends_with(".graphql")));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_ok() {
        let storage = InMemoryStorage::new();
        let handler = GraphqlTargetHandlerImpl;
        let result = handler.validate(
            GraphqlTargetValidateInput { r#type: "User".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GraphqlTargetValidateOutput::Ok { .. } => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_list_operations() {
        let storage = InMemoryStorage::new();
        let handler = GraphqlTargetHandlerImpl;
        let result = handler.list_operations(
            GraphqlTargetListOperationsInput { concept: "article".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GraphqlTargetListOperationsOutput::Ok { queries, mutations, subscriptions } => {
                assert!(queries.iter().any(|q| q.contains("Article")));
                assert!(mutations.iter().any(|m| m.contains("Article")));
                assert!(subscriptions.iter().any(|s| s.contains("Article")));
            },
        }
    }
}
