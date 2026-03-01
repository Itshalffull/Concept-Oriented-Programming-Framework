// DeployScaffoldGen Handler Implementation
//
// Generates deploy.yaml scaffolds from provided inputs: app name,
// runtime configs, concept assignments, and infrastructure settings.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DeployScaffoldGenHandler;
use serde_json::json;

fn to_kebab(name: &str) -> String {
    let mut result = String::new();
    for (i, ch) in name.chars().enumerate() {
        if ch.is_uppercase() && i > 0 {
            result.push('-');
        }
        result.push(ch.to_lowercase().next().unwrap_or(ch));
    }
    result.replace('_', "-").replace(' ', "-")
}

fn build_deploy_yaml(app_name: &str, runtimes: &[serde_json::Value], concepts: &[serde_json::Value]) -> String {
    let mut lines = vec![
        "app:".to_string(),
        format!("  name: {}", app_name),
        "  version: \"0.1.0\"".to_string(),
        String::new(),
    ];

    // Runtimes
    lines.push("runtimes:".to_string());
    if runtimes.is_empty() {
        lines.push("  main:".to_string());
        lines.push("    type: node".to_string());
        lines.push("    transport: http".to_string());
        lines.push("    storage: sqlite".to_string());
    } else {
        for rt in runtimes {
            let name = rt.get("name").and_then(|v| v.as_str()).unwrap_or("main");
            let rt_type = rt.get("type").and_then(|v| v.as_str()).unwrap_or("node");
            lines.push(format!("  {}:", name));
            lines.push(format!("    type: {}", rt_type));
            if let Some(transport) = rt.get("transport").and_then(|v| v.as_str()) {
                lines.push(format!("    transport: {}", transport));
            }
            if let Some(storage) = rt.get("storage").and_then(|v| v.as_str()) {
                lines.push(format!("    storage: {}", storage));
            }
        }
    }
    lines.push(String::new());
    lines.push("  engine:".to_string());
    lines.push("    engine: true".to_string());
    lines.push("    transport: http".to_string());
    lines.push(String::new());

    // Infrastructure
    lines.push("infrastructure:".to_string());
    lines.push("  storage:".to_string());
    lines.push("    sqlite:".to_string());
    lines.push("      type: sqlite".to_string());
    lines.push("      config: {}".to_string());
    lines.push(String::new());
    lines.push("  transports:".to_string());
    lines.push("    http:".to_string());
    lines.push("      type: http".to_string());
    lines.push("      config: {}".to_string());
    lines.push(String::new());
    lines.push("  iac:".to_string());
    lines.push("    provider: terraform".to_string());
    lines.push(String::new());

    // Concepts
    if !concepts.is_empty() {
        lines.push("concepts:".to_string());
        for c in concepts {
            let name = c.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
            let runtime = c.get("runtime").and_then(|v| v.as_str()).unwrap_or("main");
            let language = c.get("language").and_then(|v| v.as_str()).unwrap_or("typescript");
            let kebab_name = to_kebab(name);
            lines.push(format!("  {}:", name));
            lines.push(format!("    spec: ./concepts/{}.concept", kebab_name));
            lines.push("    implementations:".to_string());
            lines.push(format!("      - language: {}", language));
            let ext = if language == "typescript" { "ts" } else { language };
            lines.push(format!("        path: ./handlers/{}/{}.handler.ts", ext, kebab_name));
            lines.push(format!("        runtime: {}", runtime));
            lines.push("        storage: sqlite".to_string());
        }
        lines.push(String::new());
    }

    lines.push("syncs: []".to_string());
    lines.push(String::new());
    lines.push("build:".to_string());
    lines.push("  typescript:".to_string());
    lines.push("    compiler: tsc".to_string());
    lines.push("    testRunner: vitest".to_string());
    lines.push(String::new());

    lines.join("\n")
}

pub struct DeployScaffoldGenHandlerImpl;

#[async_trait]
impl DeployScaffoldGenHandler for DeployScaffoldGenHandlerImpl {
    async fn generate(
        &self,
        input: DeployScaffoldGenGenerateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<DeployScaffoldGenGenerateOutput, Box<dyn std::error::Error>> {
        if input.app_name.is_empty() {
            return Ok(DeployScaffoldGenGenerateOutput::Error {
                message: "App name is required".to_string(),
            });
        }

        let deploy_yaml = build_deploy_yaml(&input.app_name, &input.runtimes, &input.concepts);
        let kebab_name = to_kebab(&input.app_name);
        let files = vec![json!({
            "path": format!("deploys/{}.deploy.yaml", kebab_name),
            "content": deploy_yaml,
        })];

        Ok(DeployScaffoldGenGenerateOutput::Ok {
            files,
            files_generated: 1,
        })
    }

    async fn preview(
        &self,
        input: DeployScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployScaffoldGenPreviewOutput, Box<dyn std::error::Error>> {
        let gen_input = DeployScaffoldGenGenerateInput {
            app_name: input.app_name,
            runtimes: input.runtimes,
            concepts: input.concepts,
        };
        let result = self.generate(gen_input, storage).await?;
        match result {
            DeployScaffoldGenGenerateOutput::Ok { files, files_generated } => {
                Ok(DeployScaffoldGenPreviewOutput::Ok {
                    files,
                    would_write: files_generated,
                    would_skip: 0,
                })
            }
            DeployScaffoldGenGenerateOutput::Error { message } => {
                Ok(DeployScaffoldGenPreviewOutput::Error { message })
            }
        }
    }

    async fn register(
        &self,
        _input: DeployScaffoldGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<DeployScaffoldGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(DeployScaffoldGenRegisterOutput::Ok {
            name: "DeployScaffoldGen".to_string(),
            input_kind: "DeployConfig".to_string(),
            output_kind: "DeployManifest".to_string(),
            capabilities: vec!["deploy-yaml".to_string(), "runtime-config".to_string(), "infrastructure".to_string()],
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
        let handler = DeployScaffoldGenHandlerImpl;
        let result = handler.generate(
            DeployScaffoldGenGenerateInput {
                app_name: "MyApp".to_string(),
                runtimes: vec![],
                concepts: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            DeployScaffoldGenGenerateOutput::Ok { files, files_generated } => {
                assert_eq!(files_generated, 1);
                assert_eq!(files.len(), 1);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_empty_name() {
        let storage = InMemoryStorage::new();
        let handler = DeployScaffoldGenHandlerImpl;
        let result = handler.generate(
            DeployScaffoldGenGenerateInput {
                app_name: "".to_string(),
                runtimes: vec![],
                concepts: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            DeployScaffoldGenGenerateOutput::Error { message } => {
                assert!(message.contains("required"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_preview() {
        let storage = InMemoryStorage::new();
        let handler = DeployScaffoldGenHandlerImpl;
        let result = handler.preview(
            DeployScaffoldGenPreviewInput {
                app_name: "TestApp".to_string(),
                runtimes: vec![],
                concepts: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            DeployScaffoldGenPreviewOutput::Ok { would_write, .. } => {
                assert_eq!(would_write, 1);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = DeployScaffoldGenHandlerImpl;
        let result = handler.register(
            DeployScaffoldGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            DeployScaffoldGenRegisterOutput::Ok { name, .. } => {
                assert_eq!(name, "DeployScaffoldGen");
            },
        }
    }
}
