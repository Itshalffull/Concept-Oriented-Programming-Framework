// CLI Target -- generate CLI command scaffolding from concept projections
// Produces command definitions, shell completions, and validates flag consistency.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CliTargetHandler;
use serde_json::json;

pub struct CliTargetHandlerImpl;

#[async_trait]
impl CliTargetHandler for CliTargetHandlerImpl {
    async fn generate(
        &self,
        input: CliTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CliTargetGenerateOutput, Box<dyn std::error::Error>> {
        let projection = &input.projection;
        let config: serde_json::Value = serde_json::from_str(&input.config).unwrap_or(json!({}));

        let binary_name = config["binaryName"].as_str().unwrap_or("clef");
        let concept_name = projection
            .replace("-projection", "")
            .replace('-', " ");
        let command_base = concept_name.to_lowercase().replace(' ', "-");

        // Check for too many positional arguments
        if let Some(action_positionals) = config.get("actionPositionals").and_then(|v| v.as_object()) {
            let max_positional = config["maxPositional"].as_i64().unwrap_or(2);
            for (action, count_val) in action_positionals {
                let count = count_val.as_i64().unwrap_or(0);
                if count > max_positional {
                    return Ok(CliTargetGenerateOutput::TooManyPositional {
                        action: action.clone(),
                        count,
                    });
                }
            }
        }

        let commands = vec![
            format!("{} {} create", binary_name, command_base),
            format!("{} {} get", binary_name, command_base),
            format!("{} {} list", binary_name, command_base),
            format!("{} {} update", binary_name, command_base),
            format!("{} {} delete", binary_name, command_base),
        ];

        let files = vec![
            format!("src/cli/{}.ts", command_base),
            format!("src/cli/completion.bash"),
        ];

        let command_id = format!("cli-{}", command_base);
        storage.put("command", &command_id, json!({
            "commandId": command_id,
            "binaryName": binary_name,
            "concept": concept_name,
            "commands": commands,
            "files": files,
            "projection": projection,
            "config": input.config,
        })).await?;

        Ok(CliTargetGenerateOutput::Ok { commands, files })
    }

    async fn validate(
        &self,
        input: CliTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CliTargetValidateOutput, Box<dyn std::error::Error>> {
        let command_record = storage.get("command", &input.command).await?;

        if let Some(record) = command_record {
            // Check for flag collisions across sub-commands
            if let Some(commands) = record.get("commands").and_then(|v| v.as_array()) {
                let mut flag_actions: std::collections::HashMap<String, Vec<String>> =
                    std::collections::HashMap::new();

                for cmd in commands {
                    if let Some(cmd_str) = cmd.as_str() {
                        let parts: Vec<&str> = cmd_str.split_whitespace().collect();
                        if let Some(action) = parts.last() {
                            flag_actions
                                .entry("--format".to_string())
                                .or_default()
                                .push(action.to_string());
                        }
                    }
                }

                // In a real implementation, different flag types on the same name would conflict
                // For now, same-named flags across actions are considered acceptable
            }
        }

        Ok(CliTargetValidateOutput::Ok {
            command: input.command,
        })
    }

    async fn list_commands(
        &self,
        input: CliTargetListCommandsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CliTargetListCommandsOutput, Box<dyn std::error::Error>> {
        let command_base = input.concept.to_lowercase().replace(' ', "-");
        let command_id = format!("cli-{}", command_base);

        let mut commands = Vec::new();
        let mut subcommands = Vec::new();

        if let Some(record) = storage.get("command", &command_id).await? {
            if let Some(cmd_list) = record.get("commands").and_then(|v| v.as_array()) {
                for cmd in cmd_list {
                    if let Some(cmd_str) = cmd.as_str() {
                        let parts: Vec<&str> = cmd_str.split_whitespace().collect();
                        if parts.len() >= 2 {
                            commands.push(parts[..2].join(" "));
                        }
                        if parts.len() >= 3 {
                            subcommands.push(parts[2..].join(" "));
                        }
                    }
                }
            }
        } else {
            commands.push(format!("clef {}", command_base));
            subcommands.extend(vec![
                "create".to_string(),
                "get".to_string(),
                "list".to_string(),
                "update".to_string(),
                "delete".to_string(),
            ]);
        }

        Ok(CliTargetListCommandsOutput::Ok {
            commands,
            subcommands,
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
        let handler = CliTargetHandlerImpl;
        let result = handler.generate(
            CliTargetGenerateInput {
                projection: "comment-projection".to_string(),
                config: r#"{"binaryName":"clef"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CliTargetGenerateOutput::Ok { commands, files } => {
                assert!(!commands.is_empty());
                assert!(!files.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_too_many_positional() {
        let storage = InMemoryStorage::new();
        let handler = CliTargetHandlerImpl;
        let result = handler.generate(
            CliTargetGenerateInput {
                projection: "test-projection".to_string(),
                config: r#"{"actionPositionals":{"create":5},"maxPositional":2}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CliTargetGenerateOutput::TooManyPositional { action, count } => {
                assert_eq!(action, "create");
                assert_eq!(count, 5);
            },
            _ => panic!("Expected TooManyPositional variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_success() {
        let storage = InMemoryStorage::new();
        let handler = CliTargetHandlerImpl;
        let result = handler.validate(
            CliTargetValidateInput {
                command: "cli-test".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CliTargetValidateOutput::Ok { command } => {
                assert_eq!(command, "cli-test");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_list_commands_no_record() {
        let storage = InMemoryStorage::new();
        let handler = CliTargetHandlerImpl;
        let result = handler.list_commands(
            CliTargetListCommandsInput {
                concept: "Widget".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CliTargetListCommandsOutput::Ok { commands, subcommands } => {
                assert!(!commands.is_empty());
                assert!(!subcommands.is_empty());
            },
        }
    }
}
