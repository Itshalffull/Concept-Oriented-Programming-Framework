// Interface scaffold generator implementation
// Generates interface.yaml manifests with target configs, SDK settings,
// spec output options, and per-concept overrides.
// See architecture doc Section 8: Interface generation pipeline

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::InterfaceScaffoldGenHandler;
use serde_json::json;

pub struct InterfaceScaffoldGenHandlerImpl;

fn to_kebab(name: &str) -> String {
    let mut result = String::new();
    for (i, ch) in name.chars().enumerate() {
        if ch.is_uppercase() && i > 0 {
            result.push('-');
        }
        result.push(ch.to_lowercase().next().unwrap());
    }
    result.replace(' ', "-").replace('_', "-")
}

fn target_default(target: &str) -> String {
    match target {
        "rest" => "    rest:\n      basePath: /api\n      framework: hono\n      versioning: url".into(),
        "graphql" => "    graphql:\n      path: /graphql\n      relay: true\n      subscriptions: true".into(),
        "grpc" => "    grpc:\n      package: app.v1".into(),
        "cli" => "    cli:\n      name: my-cli\n      shell: [bash, zsh, fish]".into(),
        "mcp" => "    mcp:\n      name: my-mcp-server\n      transport: stdio".into(),
        "claude-skills" => "    claude-skills:\n      name: my-skills\n      progressive: true".into(),
        other => format!("    {}:\n      # TODO: configure target", other),
    }
}

fn sdk_default(sdk: &str, name: &str) -> String {
    match sdk {
        "typescript" => "    typescript:\n      packageName: \"@app/sdk\"\n      moduleSystem: esm".into(),
        "python" => "    python:\n      packageName: app-sdk\n      asyncSupport: true".into(),
        "go" => "    go:\n      modulePath: github.com/org/app-sdk-go".into(),
        "rust" => "    rust:\n      packageName: app-sdk".into(),
        "java" => "    java:\n      packageName: com.org.app.sdk".into(),
        "swift" => "    swift:\n      packageName: AppSDK".into(),
        other => format!("    {}:\n      packageName: \"{}-sdk-{}\"", other, name, other),
    }
}

fn build_interface_yaml(name: &str, targets: &[String], sdks: &[String]) -> String {
    let mut lines = vec![
        "interface:".to_string(),
        format!("  name: {}", name),
        "  version: \"0.1.0\"".to_string(),
        String::new(),
    ];

    if !targets.is_empty() {
        lines.push("  targets:".into());
        for t in targets {
            lines.push(target_default(t));
        }
        lines.push(String::new());
    }

    if !sdks.is_empty() {
        lines.push("  sdk:".into());
        for s in sdks {
            lines.push(sdk_default(s, name));
        }
        lines.push(String::new());
    }

    lines.push("  specs:".into());
    lines.push("    openapi: true".into());
    lines.push("    asyncapi: false".into());
    lines.push(String::new());
    lines.push("  output:".into());
    lines.push("    dir: ./bind".into());
    lines.push("    clean: true".into());
    lines.push(String::new());
    lines.push("  grouping:".into());
    lines.push("    strategy: per-concept".into());

    lines.join("\n")
}

#[async_trait]
impl InterfaceScaffoldGenHandler for InterfaceScaffoldGenHandlerImpl {
    async fn generate(
        &self,
        input: InterfaceScaffoldGenGenerateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<InterfaceScaffoldGenGenerateOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(InterfaceScaffoldGenGenerateOutput::Error {
                message: "Interface name is required".into(),
            });
        }

        let yaml_content = build_interface_yaml(&input.name, &input.targets, &input.sdks);
        let path = format!("interfaces/{}.interface.yaml", to_kebab(&input.name));

        let file = json!({ "path": path, "content": yaml_content });

        Ok(InterfaceScaffoldGenGenerateOutput::Ok {
            files: vec![file],
            files_generated: 1,
        })
    }

    async fn preview(
        &self,
        input: InterfaceScaffoldGenPreviewInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<InterfaceScaffoldGenPreviewOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(InterfaceScaffoldGenPreviewOutput::Error {
                message: "Interface name is required".into(),
            });
        }

        let yaml_content = build_interface_yaml(&input.name, &input.targets, &input.sdks);
        let path = format!("interfaces/{}.interface.yaml", to_kebab(&input.name));
        let file = json!({ "path": path, "content": yaml_content });

        Ok(InterfaceScaffoldGenPreviewOutput::Ok {
            files: vec![file],
            would_write: 1,
            would_skip: 0,
        })
    }

    async fn register(
        &self,
        _input: InterfaceScaffoldGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<InterfaceScaffoldGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(InterfaceScaffoldGenRegisterOutput::Ok {
            name: "InterfaceScaffoldGen".into(),
            input_kind: "InterfaceConfig".into(),
            output_kind: "InterfaceManifest".into(),
            capabilities: vec![
                "interface-yaml".into(),
                "target-config".into(),
                "sdk-config".into(),
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
        let handler = InterfaceScaffoldGenHandlerImpl;
        let result = handler.generate(
            InterfaceScaffoldGenGenerateInput {
                name: "MyApi".into(),
                targets: vec!["rest".into(), "graphql".into()],
                sdks: vec!["typescript".into()],
            },
            &storage,
        ).await.unwrap();
        match result {
            InterfaceScaffoldGenGenerateOutput::Ok { files, files_generated } => {
                assert_eq!(files_generated, 1);
                assert_eq!(files.len(), 1);
                let path = files[0].get("path").unwrap().as_str().unwrap();
                assert!(path.contains("my-api"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_empty_name_error() {
        let storage = InMemoryStorage::new();
        let handler = InterfaceScaffoldGenHandlerImpl;
        let result = handler.generate(
            InterfaceScaffoldGenGenerateInput {
                name: "".into(),
                targets: vec![],
                sdks: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            InterfaceScaffoldGenGenerateOutput::Error { message } => {
                assert!(message.contains("required"));
            }
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_success() {
        let storage = InMemoryStorage::new();
        let handler = InterfaceScaffoldGenHandlerImpl;
        let result = handler.preview(
            InterfaceScaffoldGenPreviewInput {
                name: "TestInterface".into(),
                targets: vec!["cli".into()],
                sdks: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            InterfaceScaffoldGenPreviewOutput::Ok { files, would_write, would_skip } => {
                assert_eq!(would_write, 1);
                assert_eq!(would_skip, 0);
                assert!(!files.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_empty_name_error() {
        let storage = InMemoryStorage::new();
        let handler = InterfaceScaffoldGenHandlerImpl;
        let result = handler.preview(
            InterfaceScaffoldGenPreviewInput {
                name: "".into(),
                targets: vec![],
                sdks: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            InterfaceScaffoldGenPreviewOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = InterfaceScaffoldGenHandlerImpl;
        let result = handler.register(
            InterfaceScaffoldGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            InterfaceScaffoldGenRegisterOutput::Ok { name, capabilities, .. } => {
                assert_eq!(name, "InterfaceScaffoldGen");
                assert!(capabilities.contains(&"interface-yaml".to_string()));
            }
        }
    }
}
