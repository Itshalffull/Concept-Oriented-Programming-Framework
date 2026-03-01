// COIF Component Scaffold Generator -- generate component scaffolding for the COIF UI framework
// Produces component files with parts, states, and event handler stubs.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CoifComponentScaffoldGenHandler;
use serde_json::json;

pub struct CoifComponentScaffoldGenHandlerImpl;

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

#[async_trait]
impl CoifComponentScaffoldGenHandler for CoifComponentScaffoldGenHandlerImpl {
    async fn generate(
        &self,
        input: CoifComponentScaffoldGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CoifComponentScaffoldGenGenerateOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(CoifComponentScaffoldGenGenerateOutput::Error {
                message: "Component name is required".to_string(),
            });
        }

        let kebab = to_kebab(&input.name);
        let mut files: Vec<serde_json::Value> = Vec::new();

        // Generate main component file
        let parts_str = input.parts.join(", ");
        let states_str = input.states.join(", ");
        let events_str = input.events.join(", ");

        let props_fields: String = input
            .parts
            .iter()
            .map(|p| format!("  {}?: any;\n", p))
            .collect();

        let component_content = format!(
            "// COIF Component: {name}\n\
             // Parts: [{parts}]\n\
             // States: [{states}]\n\
             // Events: [{events}]\n\
             \n\
             export interface {name}Props {{\n\
             {fields}\
             }}\n\
             \n\
             export function {name}(props: {name}Props) {{\n\
             \x20 return null;\n\
             }}\n",
            name = input.name,
            parts = parts_str,
            states = states_str,
            events = events_str,
            fields = props_fields,
        );
        files.push(json!({
            "path": format!("components/{}/{}.tsx", kebab, kebab),
            "content": component_content,
        }));

        // Generate styles file
        let styles_content = format!(
            "/* Styles for {} */\n.{} {{\n  display: block;\n}}\n",
            input.name, kebab
        );
        files.push(json!({
            "path": format!("components/{}/{}.css", kebab, kebab),
            "content": styles_content,
        }));

        // Generate test file
        let test_content = format!(
            "import {{ {} }} from './{}';\n\n\
             describe('{}', () => {{\n\
             \x20 it('renders without crashing', () => {{\n\
             \x20   // TODO: implement test\n\
             \x20 }});\n\
             }});\n",
            input.name, kebab, input.name
        );
        files.push(json!({
            "path": format!("components/{}/{}.test.tsx", kebab, kebab),
            "content": test_content,
        }));

        let files_generated = files.len() as i64;

        storage.put("scaffold", &kebab, json!({
            "name": input.name,
            "parts": input.parts,
            "states": input.states,
            "events": input.events,
            "filesGenerated": files_generated,
        })).await?;

        Ok(CoifComponentScaffoldGenGenerateOutput::Ok {
            files,
            files_generated,
        })
    }

    async fn preview(
        &self,
        input: CoifComponentScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CoifComponentScaffoldGenPreviewOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(CoifComponentScaffoldGenPreviewOutput::Error {
                message: "Component name is required".to_string(),
            });
        }

        let kebab = to_kebab(&input.name);
        if storage.get("scaffold", &kebab).await?.is_some() {
            return Ok(CoifComponentScaffoldGenPreviewOutput::Cached);
        }

        let files = vec![
            json!({ "path": format!("components/{}/{}.tsx", kebab, kebab) }),
            json!({ "path": format!("components/{}/{}.css", kebab, kebab) }),
            json!({ "path": format!("components/{}/{}.test.tsx", kebab, kebab) }),
        ];

        Ok(CoifComponentScaffoldGenPreviewOutput::Ok {
            files,
            would_write: 3,
            would_skip: 0,
        })
    }

    async fn register(
        &self,
        _input: CoifComponentScaffoldGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<CoifComponentScaffoldGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(CoifComponentScaffoldGenRegisterOutput::Ok {
            name: "CoifComponentScaffoldGen".to_string(),
            input_kind: "ComponentConfig".to_string(),
            output_kind: "ComponentScaffold".to_string(),
            capabilities: vec![
                "component-scaffold".to_string(),
                "parts".to_string(),
                "states".to_string(),
                "events".to_string(),
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
        let handler = CoifComponentScaffoldGenHandlerImpl;
        let result = handler.generate(
            CoifComponentScaffoldGenGenerateInput {
                name: "UserCard".to_string(),
                parts: vec!["avatar".to_string(), "name".to_string()],
                states: vec!["loading".to_string(), "ready".to_string()],
                events: vec!["onClick".to_string()],
            },
            &storage,
        ).await.unwrap();
        match result {
            CoifComponentScaffoldGenGenerateOutput::Ok { files, files_generated } => {
                assert_eq!(files_generated, 3);
                assert_eq!(files.len(), 3);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_empty_name() {
        let storage = InMemoryStorage::new();
        let handler = CoifComponentScaffoldGenHandlerImpl;
        let result = handler.generate(
            CoifComponentScaffoldGenGenerateInput {
                name: "".to_string(),
                parts: vec![],
                states: vec![],
                events: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            CoifComponentScaffoldGenGenerateOutput::Error { message } => {
                assert!(message.contains("required"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_success() {
        let storage = InMemoryStorage::new();
        let handler = CoifComponentScaffoldGenHandlerImpl;
        let result = handler.preview(
            CoifComponentScaffoldGenPreviewInput {
                name: "TestComponent".to_string(),
                parts: vec![],
                states: vec![],
                events: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            CoifComponentScaffoldGenPreviewOutput::Ok { would_write, .. } => {
                assert_eq!(would_write, 3);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = CoifComponentScaffoldGenHandlerImpl;
        let result = handler.register(
            CoifComponentScaffoldGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            CoifComponentScaffoldGenRegisterOutput::Ok { name, capabilities, .. } => {
                assert_eq!(name, "CoifComponentScaffoldGen");
                assert!(!capabilities.is_empty());
            },
        }
    }
}
