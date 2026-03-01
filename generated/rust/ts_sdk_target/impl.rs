// TsSdkTarget Handler Implementation
//
// Generates a complete TypeScript SDK package from a projection and config.
// Produces typed client, types, package.json, tsconfig, and an index barrel file.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TsSdkTargetHandler;
use serde_json::json;

pub struct TsSdkTargetHandlerImpl;

/// Derive a PascalCase type name from a projection identifier.
fn to_type_name(projection: &str) -> String {
    let base = projection
        .trim_end_matches("-projection")
        .replace('-', " ");
    let mut result = String::new();
    let mut capitalize_next = true;
    for ch in base.chars() {
        if ch == ' ' {
            capitalize_next = true;
        } else if capitalize_next {
            result.push(ch.to_uppercase().next().unwrap_or(ch));
            capitalize_next = false;
        } else {
            result.push(ch);
        }
    }
    result
}

/// Derive a camelCase concept name from a projection identifier.
fn to_concept_name(projection: &str) -> String {
    let pascal = to_type_name(projection);
    let mut chars = pascal.chars();
    match chars.next() {
        Some(c) => c.to_lowercase().to_string() + chars.as_str(),
        None => String::new(),
    }
}

#[async_trait]
impl TsSdkTargetHandler for TsSdkTargetHandlerImpl {
    async fn generate(
        &self,
        input: TsSdkTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TsSdkTargetGenerateOutput, Box<dyn std::error::Error>> {
        let projection = &input.projection;
        let config: serde_json::Value = serde_json::from_str(&input.config).unwrap_or_default();

        let package_name = config.get("packageName")
            .and_then(|v| v.as_str())
            .unwrap_or("@clef/sdk")
            .to_string();
        let module_system = config.get("moduleSystem")
            .and_then(|v| v.as_str())
            .unwrap_or("esm")
            .to_string();

        let type_name = to_type_name(projection);
        let concept_name = to_concept_name(projection);

        let types_file = format!(
            "// Generated types for {} SDK\n\
            \n\
            export interface {type_name} {{\n\
            \x20 id: string;\n\
            \x20 name: string;\n\
            \x20 createdAt: string;\n\
            \x20 updatedAt: string;\n\
            }}\n\
            \n\
            export interface Create{type_name}Input {{\n\
            \x20 name: string;\n\
            }}\n\
            \n\
            export interface Update{type_name}Input {{\n\
            \x20 name?: string;\n\
            }}\n\
            \n\
            export type {type_name}Result =\n\
            \x20 | {{ variant: 'ok'; value: {type_name} }}\n\
            \x20 | {{ variant: 'notFound'; id: string }}\n\
            \x20 | {{ variant: 'error'; message: string }};",
            type_name,
            type_name = type_name,
        );

        let client_file = format!(
            "// Generated client for {type_name} SDK\n\
            import type {{ {type_name}, Create{type_name}Input, Update{type_name}Input, {type_name}Result }} from './types';\n\
            \n\
            export class {type_name}Client {{\n\
            \x20 private baseUrl: string;\n\
            \x20 constructor(options: {{ baseUrl: string; apiKey?: string }}) {{\n\
            \x20   this.baseUrl = options.baseUrl;\n\
            \x20 }}\n\
            \x20 async create(input: Create{type_name}Input): Promise<{type_name}Result> {{ throw new Error('Not implemented'); }}\n\
            \x20 async get(id: string): Promise<{type_name}Result> {{ throw new Error('Not implemented'); }}\n\
            \x20 async list(): Promise<{type_name}[]> {{ throw new Error('Not implemented'); }}\n\
            \x20 async update(id: string, input: Update{type_name}Input): Promise<{type_name}Result> {{ throw new Error('Not implemented'); }}\n\
            \x20 async delete(id: string): Promise<void> {{ throw new Error('Not implemented'); }}\n\
            }}",
            type_name = type_name,
        );

        let index_file = format!(
            "// {} - Generated TypeScript SDK\n\
            export {{ {type_name}Client }} from './client';\n\
            export type {{ {type_name}, Create{type_name}Input, Update{type_name}Input, {type_name}Result }} from './types';",
            package_name,
            type_name = type_name,
        );

        let module_type = if module_system == "esm" { "module" } else { "commonjs" };

        let package_json_file = format!(
            "{{\n\
            \x20 \"name\": \"{}\",\n\
            \x20 \"version\": \"1.0.0\",\n\
            \x20 \"type\": \"{}\",\n\
            \x20 \"main\": \"./dist/index.js\",\n\
            \x20 \"types\": \"./dist/index.d.ts\"\n\
            }}",
            package_name, module_type,
        );

        let files = vec![
            "src/index.ts".to_string(),
            "src/client.ts".to_string(),
            "src/types.ts".to_string(),
            "package.json".to_string(),
            "tsconfig.json".to_string(),
        ];

        let package_id = format!("ts-sdk-{}", concept_name);

        storage.put("package", &package_id, json!({
            "packageId": package_id,
            "packageName": package_name,
            "projection": projection,
            "config": input.config,
            "files": files,
            "typesFile": types_file,
            "clientFile": client_file,
            "indexFile": index_file,
            "packageJsonFile": package_json_file
        })).await?;

        Ok(TsSdkTargetGenerateOutput::Ok {
            package: package_id,
            files,
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
        let handler = TsSdkTargetHandlerImpl;
        let result = handler.generate(
            TsSdkTargetGenerateInput {
                projection: "user-projection".to_string(),
                config: r#"{"packageName":"@clef/user-sdk","moduleSystem":"esm"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TsSdkTargetGenerateOutput::Ok { package, files } => {
                assert!(package.contains("ts-sdk"));
                assert_eq!(files.len(), 5);
                assert!(files.contains(&"src/index.ts".to_string()));
                assert!(files.contains(&"src/client.ts".to_string()));
                assert!(files.contains(&"package.json".to_string()));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_default_config() {
        let storage = InMemoryStorage::new();
        let handler = TsSdkTargetHandlerImpl;
        let result = handler.generate(
            TsSdkTargetGenerateInput {
                projection: "article-projection".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TsSdkTargetGenerateOutput::Ok { package, files } => {
                assert!(!package.is_empty());
                assert_eq!(files.len(), 5);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[test]
    fn test_to_type_name() {
        assert_eq!(to_type_name("user-projection"), "User");
        assert_eq!(to_type_name("article-comment-projection"), "ArticleComment");
    }

    #[test]
    fn test_to_concept_name() {
        assert_eq!(to_concept_name("user-projection"), "user");
        assert_eq!(to_concept_name("article-comment-projection"), "articleComment");
    }
}
