// OpenaiTarget concept implementation
// Generate OpenAI-compatible function-calling tool definitions from concept projections.
// Supports strict mode and validates function descriptions.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::OpenaiTargetHandler;
use serde_json::json;

pub struct OpenaiTargetHandlerImpl;

/// Convert a name to snake_case
fn to_snake_case(name: &str) -> String {
    let mut result = String::new();
    for (i, c) in name.chars().enumerate() {
        if c.is_uppercase() && i > 0 {
            result.push('_');
        }
        result.push(c.to_ascii_lowercase());
    }
    result.replace('-', "_")
}

#[async_trait]
impl OpenaiTargetHandler for OpenaiTargetHandlerImpl {
    async fn generate(
        &self,
        input: OpenaiTargetGenerateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<OpenaiTargetGenerateOutput, Box<dyn std::error::Error>> {
        let projection: serde_json::Value = match serde_json::from_str(&input.projection) {
            Ok(v) => v,
            Err(_) => return Ok(OpenaiTargetGenerateOutput::Ok {
                functions: vec![],
                files: vec![],
            }),
        };

        let config: serde_json::Value = serde_json::from_str(&input.config).unwrap_or(json!({}));
        let strict = config["strict"].as_bool().unwrap_or(true);
        let limit = config["limit"].as_i64().unwrap_or(128);

        let concept_name = projection["conceptName"].as_str().unwrap_or("Unknown");
        let manifest = &projection["conceptManifest"];
        let actions = manifest["actions"].as_array();

        let mut functions = Vec::new();
        if let Some(actions) = actions {
            if actions.len() as i64 > limit {
                return Ok(OpenaiTargetGenerateOutput::TooManyFunctions {
                    count: actions.len() as i64,
                    limit,
                });
            }

            for action in actions {
                let action_name = action["name"].as_str().unwrap_or("unknown");
                let snake_name = format!("{}_{}", to_snake_case(concept_name), to_snake_case(action_name));

                let func_def = json!({
                    "type": "function",
                    "function": {
                        "name": snake_name,
                        "description": format!("Execute {} action", action_name),
                        "strict": strict,
                        "parameters": {
                            "type": "object",
                            "properties": {},
                            "required": [],
                            "additionalProperties": !strict
                        }
                    }
                });
                functions.push(serde_json::to_string(&func_def)?);
            }
        }

        let kebab_name = concept_name.to_lowercase().replace('_', "-");
        let files = vec![format!("{}/{}.functions.ts", kebab_name, kebab_name)];

        Ok(OpenaiTargetGenerateOutput::Ok { functions, files })
    }

    async fn validate(
        &self,
        input: OpenaiTargetValidateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<OpenaiTargetValidateOutput, Box<dyn std::error::Error>> {
        let func: serde_json::Value = match serde_json::from_str(&input.function) {
            Ok(v) => v,
            Err(_) => return Ok(OpenaiTargetValidateOutput::Ok {
                function: input.function,
            }),
        };

        let function_name = func["function"]["name"].as_str().unwrap_or("unknown").to_string();
        let description = func["function"]["description"].as_str().unwrap_or("");

        if description.is_empty() {
            return Ok(OpenaiTargetValidateOutput::MissingDescription {
                function: input.function,
                function_name,
            });
        }

        Ok(OpenaiTargetValidateOutput::Ok {
            function: input.function,
        })
    }

    async fn list_functions(
        &self,
        input: OpenaiTargetListFunctionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OpenaiTargetListFunctionsOutput, Box<dyn std::error::Error>> {
        let records = storage.find("openai-function", Some(&json!({ "concept": input.concept }))).await?;
        let functions: Vec<String> = records.iter()
            .filter_map(|r| r["name"].as_str().map(|s| s.to_string()))
            .collect();

        Ok(OpenaiTargetListFunctionsOutput::Ok { functions })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_with_actions() {
        let storage = InMemoryStorage::new();
        let handler = OpenaiTargetHandlerImpl;
        let projection = r#"{"conceptName":"Article","conceptManifest":{"actions":[{"name":"create"},{"name":"update"}]}}"#;
        let result = handler.generate(
            OpenaiTargetGenerateInput {
                projection: projection.to_string(),
                config: r#"{"strict":true}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            OpenaiTargetGenerateOutput::Ok { functions, files } => {
                assert_eq!(functions.len(), 2);
                assert!(!files.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_invalid_projection() {
        let storage = InMemoryStorage::new();
        let handler = OpenaiTargetHandlerImpl;
        let result = handler.generate(
            OpenaiTargetGenerateInput {
                projection: "not-json".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            OpenaiTargetGenerateOutput::Ok { functions, .. } => {
                assert!(functions.is_empty());
            }
            _ => panic!("Expected Ok with empty functions"),
        }
    }

    #[tokio::test]
    async fn test_generate_too_many_functions() {
        let storage = InMemoryStorage::new();
        let handler = OpenaiTargetHandlerImpl;
        let mut actions = Vec::new();
        for i in 0..130 {
            actions.push(format!(r#"{{"name":"action{}"}}"#, i));
        }
        let projection = format!(
            r#"{{"conceptName":"Big","conceptManifest":{{"actions":[{}]}}}}"#,
            actions.join(",")
        );
        let result = handler.generate(
            OpenaiTargetGenerateInput {
                projection,
                config: r#"{"limit":128}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            OpenaiTargetGenerateOutput::TooManyFunctions { count, limit } => {
                assert_eq!(count, 130);
                assert_eq!(limit, 128);
            }
            _ => panic!("Expected TooManyFunctions variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_with_description() {
        let storage = InMemoryStorage::new();
        let handler = OpenaiTargetHandlerImpl;
        let func = r#"{"function":{"name":"test","description":"A test function"}}"#;
        let result = handler.validate(
            OpenaiTargetValidateInput { function: func.to_string() },
            &storage,
        ).await.unwrap();
        match result {
            OpenaiTargetValidateOutput::Ok { function } => {
                assert_eq!(function, func);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_missing_description() {
        let storage = InMemoryStorage::new();
        let handler = OpenaiTargetHandlerImpl;
        let func = r#"{"function":{"name":"test","description":""}}"#;
        let result = handler.validate(
            OpenaiTargetValidateInput { function: func.to_string() },
            &storage,
        ).await.unwrap();
        match result {
            OpenaiTargetValidateOutput::MissingDescription { function_name, .. } => {
                assert_eq!(function_name, "test");
            }
            _ => panic!("Expected MissingDescription variant"),
        }
    }

    #[tokio::test]
    async fn test_list_functions() {
        let storage = InMemoryStorage::new();
        let handler = OpenaiTargetHandlerImpl;
        let result = handler.list_functions(
            OpenaiTargetListFunctionsInput { concept: "test".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            OpenaiTargetListFunctionsOutput::Ok { functions } => {
                assert!(functions.is_empty());
            }
        }
    }
}
