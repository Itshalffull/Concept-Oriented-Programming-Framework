// Kit scaffold generator implementation
// Generates suite.yaml manifests with concept definitions,
// sync rules, and directory structure for new suites.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::KitScaffoldGenHandler;
use serde_json::json;

pub struct KitScaffoldGenHandlerImpl;

fn build_suite_yaml(name: &str, description: &str, concepts: &[String]) -> String {
    let mut lines = vec![
        "suite:".to_string(),
        format!("  name: {}", name),
        format!("  description: \"{}\"", description),
        "  version: \"0.1.0\"".to_string(),
        String::new(),
        "  concepts:".to_string(),
    ];

    for concept in concepts {
        lines.push(format!("    - {}", concept));
    }

    lines.push(String::new());
    lines.push("  syncs: []".into());
    lines.join("\n")
}

#[async_trait]
impl KitScaffoldGenHandler for KitScaffoldGenHandlerImpl {
    async fn generate(
        &self,
        input: KitScaffoldGenGenerateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<KitScaffoldGenGenerateOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(KitScaffoldGenGenerateOutput::Error {
                message: "Suite name is required".into(),
            });
        }

        let yaml_content = build_suite_yaml(&input.name, &input.description, &input.concepts);
        let kebab_name = input.name.to_lowercase().replace(' ', "-");
        let path = format!("repertoire/{}/suite.yaml", kebab_name);

        let file = json!({ "path": path, "content": yaml_content });

        Ok(KitScaffoldGenGenerateOutput::Ok {
            files: vec![file],
            files_generated: 1,
        })
    }

    async fn preview(
        &self,
        input: KitScaffoldGenPreviewInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<KitScaffoldGenPreviewOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(KitScaffoldGenPreviewOutput::Error {
                message: "Suite name is required".into(),
            });
        }

        let yaml_content = build_suite_yaml(&input.name, &input.description, &input.concepts);
        let kebab_name = input.name.to_lowercase().replace(' ', "-");
        let path = format!("repertoire/{}/suite.yaml", kebab_name);
        let file = json!({ "path": path, "content": yaml_content });

        Ok(KitScaffoldGenPreviewOutput::Ok {
            files: vec![file],
            would_write: 1,
            would_skip: 0,
        })
    }

    async fn register(
        &self,
        _input: KitScaffoldGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<KitScaffoldGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(KitScaffoldGenRegisterOutput::Ok {
            name: "KitScaffoldGen".into(),
            input_kind: "SuiteConfig".into(),
            output_kind: "SuiteManifest".into(),
            capabilities: vec!["suite-yaml".into(), "concept-scaffold".into()],
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
        let handler = KitScaffoldGenHandlerImpl;
        let result = handler.generate(
            KitScaffoldGenGenerateInput {
                name: "collaboration".into(),
                description: "Collaboration suite".into(),
                concepts: vec!["comment".into(), "tag".into()],
            },
            &storage,
        ).await.unwrap();
        match result {
            KitScaffoldGenGenerateOutput::Ok { files, files_generated } => {
                assert_eq!(files_generated, 1);
                assert!(!files.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_empty_name_error() {
        let storage = InMemoryStorage::new();
        let handler = KitScaffoldGenHandlerImpl;
        let result = handler.generate(
            KitScaffoldGenGenerateInput {
                name: "".into(),
                description: "desc".into(),
                concepts: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            KitScaffoldGenGenerateOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_success() {
        let storage = InMemoryStorage::new();
        let handler = KitScaffoldGenHandlerImpl;
        let result = handler.preview(
            KitScaffoldGenPreviewInput {
                name: "test-suite".into(),
                description: "Test".into(),
                concepts: vec!["echo".into()],
            },
            &storage,
        ).await.unwrap();
        match result {
            KitScaffoldGenPreviewOutput::Ok { would_write, .. } => assert_eq!(would_write, 1),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = KitScaffoldGenHandlerImpl;
        let result = handler.register(
            KitScaffoldGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            KitScaffoldGenRegisterOutput::Ok { name, .. } => assert_eq!(name, "KitScaffoldGen"),
        }
    }
}
