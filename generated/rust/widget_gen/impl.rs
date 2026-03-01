// WidgetGen Handler Implementation
//
// Generates framework-specific widget code from a widget AST for multiple
// UI targets (React, Solid, Vue, Svelte, Ink, React Native, SwiftUI).

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WidgetGenHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id(prefix: &str) -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("{}-{}", prefix, n)
}

const VALID_TARGETS: &[&str] = &["react", "solid", "vue", "svelte", "ink", "react-native", "swiftui"];

pub struct WidgetGenHandlerImpl;

#[async_trait]
impl WidgetGenHandler for WidgetGenHandlerImpl {
    async fn generate(
        &self,
        input: WidgetGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetGenGenerateOutput, Box<dyn std::error::Error>> {
        let gen = &input.gen;
        let target = &input.target;
        let widget_ast = &input.widget_ast;

        if !VALID_TARGETS.contains(&target.as_str()) {
            return Ok(WidgetGenGenerateOutput::Error {
                gen: gen.clone(),
                message: format!(
                    "Unsupported target \"{}\". Valid targets: {}",
                    target,
                    VALID_TARGETS.join(", ")
                ),
            });
        }

        let ast: serde_json::Value = match serde_json::from_str(widget_ast) {
            Ok(v) => v,
            Err(_) => {
                return Ok(WidgetGenGenerateOutput::Error {
                    gen: gen.clone(),
                    message: "Failed to parse widget AST as JSON".to_string(),
                });
            }
        };

        let id = if gen.is_empty() {
            next_id("G")
        } else {
            gen.clone()
        };

        let component_name = ast.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Widget");

        let props: Vec<(String, String)> = ast.get("props")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter().map(|p| {
                    let name = p.get("name").and_then(|v| v.as_str()).unwrap_or("prop");
                    let ty = p.get("type").and_then(|v| v.as_str()).unwrap_or("any");
                    (name.to_string(), ty.to_string())
                }).collect()
            })
            .unwrap_or_default();

        let props_signature: String = props.iter()
            .map(|(name, ty)| format!("{}: {}", name, ty))
            .collect::<Vec<_>>()
            .join(", ");

        let output = match target.as_str() {
            "react" => {
                let props_type = if !props.is_empty() {
                    let fields: String = props.iter()
                        .map(|(name, ty)| format!("  {}: {};", name, ty))
                        .collect::<Vec<_>>()
                        .join("\n");
                    format!("interface {}Props {{\n{}\n}}", component_name, fields)
                } else {
                    String::new()
                };
                let param = if !props.is_empty() {
                    format!("props: {}Props", component_name)
                } else {
                    String::new()
                };
                format!(
                    "{}\n\nexport function {}({}) {{\n  return <div>{}</div>;\n}}",
                    props_type, component_name, param, component_name
                )
            }
            "solid" => {
                format!(
                    "import {{ Component }} from 'solid-js';\n\nexport const {}: Component<{{{}}}> = (props) => {{\n  return <div>{}</div>;\n}};",
                    component_name, props_signature, component_name
                )
            }
            "vue" => {
                format!(
                    "<template>\n  <div>{}</div>\n</template>\n\n<script setup lang=\"ts\">\ndefineProps<{{{}}}>}();\n</script>",
                    component_name, props_signature
                )
            }
            "svelte" => {
                let script_props: String = props.iter()
                    .map(|(name, ty)| format!("  export let {}: {};", name, ty))
                    .collect::<Vec<_>>()
                    .join("\n");
                format!(
                    "<script lang=\"ts\">\n{}\n</script>\n\n<div>{}</div>",
                    script_props, component_name
                )
            }
            "ink" => {
                let destructured: String = props.iter()
                    .map(|(name, _)| name.clone())
                    .collect::<Vec<_>>()
                    .join(", ");
                format!(
                    "import {{ Box, Text }} from 'ink';\n\nexport function {}({{{}}}:{{{}}}) {{\n  return <Box><Text>{}</Text></Box>;\n}}",
                    component_name, destructured, props_signature, component_name
                )
            }
            "react-native" => {
                let destructured: String = props.iter()
                    .map(|(name, _)| name.clone())
                    .collect::<Vec<_>>()
                    .join(", ");
                format!(
                    "import {{ View, Text }} from 'react-native';\n\nexport function {}({{{}}}:{{{}}}) {{\n  return <View><Text>{}</Text></View>;\n}}",
                    component_name, destructured, props_signature, component_name
                )
            }
            "swiftui" => {
                let swift_props: String = props.iter()
                    .map(|(name, ty)| {
                        let swift_type = match ty.as_str() {
                            "string" => "String",
                            "number" => "Int",
                            _ => "Any",
                        };
                        format!("    var {}: {}", name, swift_type)
                    })
                    .collect::<Vec<_>>()
                    .join("\n");
                format!(
                    "struct {}: View {{\n{}\n\n    var body: some View {{\n        Text(\"{}\")\n    }}\n}}",
                    component_name, swift_props, component_name
                )
            }
            _ => String::new(),
        };

        storage.put("widgetGen", &id, json!({
            "target": target,
            "input": widget_ast,
            "output": output,
            "status": "generated"
        })).await?;

        Ok(WidgetGenGenerateOutput::Ok {
            gen: id,
            output,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_react() {
        let storage = InMemoryStorage::new();
        let handler = WidgetGenHandlerImpl;
        let result = handler.generate(
            WidgetGenGenerateInput {
                gen: "".to_string(),
                target: "react".to_string(),
                widget_ast: r#"{"name":"Button","props":[{"name":"label","type":"string"}]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetGenGenerateOutput::Ok { output, .. } => {
                assert!(output.contains("Button"));
                assert!(output.contains("export function"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_vue() {
        let storage = InMemoryStorage::new();
        let handler = WidgetGenHandlerImpl;
        let result = handler.generate(
            WidgetGenGenerateInput {
                gen: "".to_string(),
                target: "vue".to_string(),
                widget_ast: r#"{"name":"Card"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetGenGenerateOutput::Ok { output, .. } => {
                assert!(output.contains("template"));
                assert!(output.contains("Card"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_unsupported_target() {
        let storage = InMemoryStorage::new();
        let handler = WidgetGenHandlerImpl;
        let result = handler.generate(
            WidgetGenGenerateInput {
                gen: "".to_string(),
                target: "angular".to_string(),
                widget_ast: r#"{"name":"Button"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetGenGenerateOutput::Error { message, .. } => {
                assert!(message.contains("Unsupported"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_invalid_ast() {
        let storage = InMemoryStorage::new();
        let handler = WidgetGenHandlerImpl;
        let result = handler.generate(
            WidgetGenGenerateInput {
                gen: "".to_string(),
                target: "react".to_string(),
                widget_ast: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetGenGenerateOutput::Error { message, .. } => {
                assert!(message.contains("parse"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_swiftui() {
        let storage = InMemoryStorage::new();
        let handler = WidgetGenHandlerImpl;
        let result = handler.generate(
            WidgetGenGenerateInput {
                gen: "".to_string(),
                target: "swiftui".to_string(),
                widget_ast: r#"{"name":"Avatar","props":[{"name":"size","type":"number"}]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetGenGenerateOutput::Ok { output, .. } => {
                assert!(output.contains("struct Avatar"));
                assert!(output.contains("View"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
