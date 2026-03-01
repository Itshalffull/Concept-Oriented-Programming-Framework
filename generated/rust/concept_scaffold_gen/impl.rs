// Concept Scaffold Generator -- generate .concept specification file scaffolds
// Builds well-formed concept specs from name, type parameters, purpose, state fields, and actions.
// See architecture doc Section 2: Concept specifications.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ConceptScaffoldGenHandler;
use serde_json::json;

pub struct ConceptScaffoldGenHandlerImpl;

fn to_kebab(name: &str) -> String {
    let mut result = String::new();
    for (i, ch) in name.chars().enumerate() {
        if ch.is_uppercase() && i > 0 {
            result.push('-');
        }
        result.push(ch.to_lowercase().next().unwrap_or(ch));
    }
    result.replace(' ', "-").replace('_', "-")
}

fn build_concept_spec(
    name: &str,
    type_param: &str,
    purpose: &str,
    state_fields: &[serde_json::Value],
    actions: &[serde_json::Value],
) -> String {
    let mut lines = Vec::new();

    lines.push(format!("concept {} [{}] {{", name, type_param));
    lines.push(String::new());

    // Purpose block
    lines.push("  purpose {".to_string());
    for line in purpose.split('\n') {
        lines.push(format!("    {}", line.trim()));
    }
    lines.push("  }".to_string());
    lines.push(String::new());

    // State block
    lines.push("  state {".to_string());
    for field in state_fields {
        let field_name = field["name"].as_str().unwrap_or("items");
        let field_type = field["type"].as_str().unwrap_or(&format!("set {}", type_param));
        let is_mapping = field["mapping"].as_bool().unwrap_or(false);

        if is_mapping {
            lines.push(format!("    {}: {} -> {}", field_name, type_param, field_type));
        } else {
            lines.push(format!("    {}: {}", field_name, field_type));
        }
    }
    lines.push("  }".to_string());
    lines.push(String::new());

    // Actions block
    lines.push("  actions {".to_string());
    for action in actions {
        let action_name = action["name"].as_str().unwrap_or("create");
        let params = action["params"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|p| {
                        let pname = p["name"].as_str()?;
                        let ptype = p["type"].as_str()?;
                        Some(format!("{}: {}", pname, ptype))
                    })
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .unwrap_or_default();

        lines.push(format!("    action {}({}) {{", action_name, params));

        let variants = action["variants"].as_array();
        if let Some(vars) = variants {
            for v in vars {
                let vname = v["name"].as_str().unwrap_or("ok");
                let vparams = v["params"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|p| {
                                let pname = p["name"].as_str()?;
                                let ptype = p["type"].as_str()?;
                                Some(format!("{}: {}", pname, ptype))
                            })
                            .collect::<Vec<_>>()
                            .join(", ")
                    })
                    .unwrap_or_default();
                let desc = v["description"].as_str().unwrap_or(&format!("{} variant.", vname));
                lines.push(format!("      -> {}({}) {{", vname, vparams));
                lines.push(format!("        {}", desc));
                lines.push("      }".to_string());
            }
        } else {
            lines.push("      -> ok() { Success. }".to_string());
            lines.push("      -> error(message: String) { Failure. }".to_string());
        }

        lines.push("    }".to_string());
        lines.push(String::new());
    }

    // Register action
    lines.push("    action register() {".to_string());
    lines.push("      -> ok(name: String, inputKind: String, outputKind: String, capabilities: list String) {".to_string());
    lines.push("        Return static metadata for discovery.".to_string());
    lines.push("      }".to_string());
    lines.push("    }".to_string());
    lines.push("  }".to_string());
    lines.push("}".to_string());
    lines.push(String::new());

    lines.join("\n")
}

#[async_trait]
impl ConceptScaffoldGenHandler for ConceptScaffoldGenHandlerImpl {
    async fn generate(
        &self,
        input: ConceptScaffoldGenGenerateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<ConceptScaffoldGenGenerateOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(ConceptScaffoldGenGenerateOutput::Error {
                message: "Concept name is required".to_string(),
            });
        }

        let concept_spec = build_concept_spec(
            &input.name,
            &input.type_param,
            &input.purpose,
            &input.state_fields,
            &input.actions,
        );

        let kebab = to_kebab(&input.name);
        let files = vec![json!({
            "path": format!("concepts/{}.concept", kebab),
            "content": concept_spec,
        })];

        Ok(ConceptScaffoldGenGenerateOutput::Ok {
            files,
            files_generated: 1,
        })
    }

    async fn preview(
        &self,
        input: ConceptScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptScaffoldGenPreviewOutput, Box<dyn std::error::Error>> {
        let gen_input = ConceptScaffoldGenGenerateInput {
            name: input.name,
            type_param: input.type_param,
            purpose: input.purpose,
            state_fields: input.state_fields,
            actions: input.actions,
        };

        let result = self.generate(gen_input, storage).await?;
        match result {
            ConceptScaffoldGenGenerateOutput::Ok { files, .. } => {
                let count = files.len() as i64;
                Ok(ConceptScaffoldGenPreviewOutput::Ok {
                    files,
                    would_write: count,
                    would_skip: 0,
                })
            }
            ConceptScaffoldGenGenerateOutput::Error { message } => {
                Ok(ConceptScaffoldGenPreviewOutput::Error { message })
            }
        }
    }

    async fn register(
        &self,
        _input: ConceptScaffoldGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<ConceptScaffoldGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(ConceptScaffoldGenRegisterOutput::Ok {
            name: "ConceptScaffoldGen".to_string(),
            input_kind: "ConceptConfig".to_string(),
            output_kind: "ConceptSpec".to_string(),
            capabilities: vec![
                "concept-spec".to_string(),
                "state-fields".to_string(),
                "actions".to_string(),
                "invariants".to_string(),
            ],
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
        let handler = ConceptScaffoldGenHandlerImpl;
        let result = handler.generate(
            ConceptScaffoldGenGenerateInput {
                name: "Bookmark".to_string(),
                type_param: "B".to_string(),
                purpose: "Manage bookmarks".to_string(),
                state_fields: vec![json!({"name": "items", "type": "set B"})],
                actions: vec![json!({"name": "create", "params": [{"name": "url", "type": "String"}]})],
            },
            &storage,
        ).await.unwrap();
        match result {
            ConceptScaffoldGenGenerateOutput::Ok { files, files_generated } => {
                assert_eq!(files_generated, 1);
                assert!(!files.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_empty_name() {
        let storage = InMemoryStorage::new();
        let handler = ConceptScaffoldGenHandlerImpl;
        let result = handler.generate(
            ConceptScaffoldGenGenerateInput {
                name: "".to_string(),
                type_param: "T".to_string(),
                purpose: "test".to_string(),
                state_fields: vec![],
                actions: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            ConceptScaffoldGenGenerateOutput::Error { message } => {
                assert!(message.contains("required"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_success() {
        let storage = InMemoryStorage::new();
        let handler = ConceptScaffoldGenHandlerImpl;
        let result = handler.preview(
            ConceptScaffoldGenPreviewInput {
                name: "Task".to_string(),
                type_param: "T".to_string(),
                purpose: "Manage tasks".to_string(),
                state_fields: vec![],
                actions: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            ConceptScaffoldGenPreviewOutput::Ok { would_write, .. } => {
                assert_eq!(would_write, 1);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = ConceptScaffoldGenHandlerImpl;
        let result = handler.register(
            ConceptScaffoldGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            ConceptScaffoldGenRegisterOutput::Ok { name, .. } => {
                assert_eq!(name, "ConceptScaffoldGen");
            },
        }
    }
}
