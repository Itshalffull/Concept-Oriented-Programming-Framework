// SyncScaffoldGen concept implementation
// Generates boilerplate sync specification files from trigger/effect definitions.
// Produces ready-to-customize .sync files with when/then clause structure.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SyncScaffoldGenHandler;
use serde_json::json;

pub struct SyncScaffoldGenHandlerImpl;

fn to_kebab(name: &str) -> String {
    let mut result = String::new();
    for (i, c) in name.chars().enumerate() {
        if c.is_uppercase() && i > 0 {
            result.push('-');
        }
        result.push(c.to_ascii_lowercase());
    }
    result.replace(' ', "-").replace('_', "-")
}

fn generate_sync_files(
    name: &str,
    trigger: &serde_json::Value,
    effects: &[serde_json::Value],
) -> Vec<serde_json::Value> {
    let kebab = to_kebab(name);

    // Build when-clause from trigger
    let trigger_concept = trigger.get("concept")
        .and_then(|v| v.as_str())
        .unwrap_or("UnknownConcept");
    let trigger_action = trigger.get("action")
        .and_then(|v| v.as_str())
        .unwrap_or("action");
    let trigger_variant = trigger.get("variant")
        .and_then(|v| v.as_str())
        .unwrap_or("ok");

    // Build then-clause from effects
    let then_lines: Vec<String> = effects.iter()
        .map(|effect| {
            let concept = effect.get("concept")
                .and_then(|v| v.as_str())
                .unwrap_or("TargetConcept");
            let action = effect.get("action")
                .and_then(|v| v.as_str())
                .unwrap_or("action");
            format!("  {}.{}", concept, action)
        })
        .collect();

    let sync_content = format!(
        r#"// Sync: {name}
// Auto-generated scaffold - customize the field mappings below.

sync "{name}"

when:
  {trigger_concept}.{trigger_action} -> {trigger_variant}

then:
{then_lines}
"#,
        name = name,
        trigger_concept = trigger_concept,
        trigger_action = trigger_action,
        trigger_variant = trigger_variant,
        then_lines = then_lines.join("\n"),
    );

    let test_content = format!(
        r#"// Tests for sync: {}
// Verify trigger -> effect chain works correctly.

sync "{}-test"

when:
  {}.{} -> {}

then:
  // Assert expected effects
"#,
        name, name,
        trigger_concept, trigger_action, trigger_variant,
    );

    vec![
        json!({"path": format!("sync/{}.sync", kebab), "content": sync_content}),
        json!({"path": format!("sync/{}.test.sync", kebab), "content": test_content}),
    ]
}

#[async_trait]
impl SyncScaffoldGenHandler for SyncScaffoldGenHandlerImpl {
    async fn generate(
        &self,
        input: SyncScaffoldGenGenerateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SyncScaffoldGenGenerateOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(SyncScaffoldGenGenerateOutput::Error {
                message: "Sync name is required".to_string(),
            });
        }

        let files = generate_sync_files(&input.name, &input.trigger, &input.effects);
        let count = files.len() as i64;

        Ok(SyncScaffoldGenGenerateOutput::Ok {
            files,
            files_generated: count,
        })
    }

    async fn preview(
        &self,
        input: SyncScaffoldGenPreviewInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SyncScaffoldGenPreviewOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(SyncScaffoldGenPreviewOutput::Error {
                message: "Sync name is required".to_string(),
            });
        }

        let files = generate_sync_files(&input.name, &input.trigger, &input.effects);
        let count = files.len() as i64;

        Ok(SyncScaffoldGenPreviewOutput::Ok {
            files,
            would_write: count,
            would_skip: 0,
        })
    }

    async fn register(
        &self,
        _input: SyncScaffoldGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SyncScaffoldGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(SyncScaffoldGenRegisterOutput::Ok {
            name: "SyncScaffoldGen".to_string(),
            input_kind: "SyncTriggerConfig".to_string(),
            output_kind: "SyncSpec".to_string(),
            capabilities: vec![
                "generate".to_string(),
                "preview".to_string(),
                "test-scaffold".to_string(),
            ],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate() {
        let storage = InMemoryStorage::new();
        let handler = SyncScaffoldGenHandlerImpl;
        let result = handler.generate(
            SyncScaffoldGenGenerateInput {
                name: "UserFollowSync".to_string(),
                trigger: json!({"concept": "User", "action": "follow", "variant": "ok"}),
                effects: vec![json!({"concept": "Follow", "action": "create"})],
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncScaffoldGenGenerateOutput::Ok { files, files_generated } => {
                assert!(files_generated >= 2);
                assert!(!files.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_empty_name() {
        let storage = InMemoryStorage::new();
        let handler = SyncScaffoldGenHandlerImpl;
        let result = handler.generate(
            SyncScaffoldGenGenerateInput {
                name: "".to_string(),
                trigger: json!({}),
                effects: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncScaffoldGenGenerateOutput::Error { message } => {
                assert!(message.contains("required"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_preview() {
        let storage = InMemoryStorage::new();
        let handler = SyncScaffoldGenHandlerImpl;
        let result = handler.preview(
            SyncScaffoldGenPreviewInput {
                name: "TestSync".to_string(),
                trigger: json!({"concept": "A", "action": "do"}),
                effects: vec![json!({"concept": "B", "action": "react"})],
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncScaffoldGenPreviewOutput::Ok { files, would_write, .. } => {
                assert!(would_write >= 2);
                assert!(!files.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = SyncScaffoldGenHandlerImpl;
        let result = handler.register(
            SyncScaffoldGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            SyncScaffoldGenRegisterOutput::Ok { name, .. } => {
                assert_eq!(name, "SyncScaffoldGen");
            },
        }
    }
}
