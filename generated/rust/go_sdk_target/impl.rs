// GoSdkTarget concept implementation
// Generates Go SDK code from a concept projection: structs, client methods, and module files.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::GoSdkTargetHandler;
use serde_json::json;

pub struct GoSdkTargetHandlerImpl;

/// Convert a concept name to Go PascalCase (e.g., "user-profile" -> "UserProfile")
fn to_pascal_case(s: &str) -> String {
    s.split(|c: char| c == '-' || c == '_' || c == ' ')
        .filter(|seg| !seg.is_empty())
        .map(|seg| {
            let mut chars = seg.chars();
            match chars.next() {
                Some(first) => {
                    let upper: String = first.to_uppercase().collect();
                    format!("{}{}", upper, chars.collect::<String>())
                }
                None => String::new(),
            }
        })
        .collect()
}

/// Convert a concept name to Go snake_case for package naming
fn to_snake_case(s: &str) -> String {
    s.replace('-', "_").replace(' ', "_").to_lowercase()
}

/// Map a Clef type to a Go type
fn clef_type_to_go(clef_type: &str) -> &str {
    match clef_type {
        "string" | "String" => "string",
        "number" | "Number" | "integer" | "int" => "int64",
        "float" | "Float" | "double" => "float64",
        "boolean" | "Boolean" | "bool" => "bool",
        "bytes" | "Bytes" => "[]byte",
        "datetime" | "DateTime" => "time.Time",
        _ => "interface{}",
    }
}

#[async_trait]
impl GoSdkTargetHandler for GoSdkTargetHandlerImpl {
    async fn generate(
        &self,
        input: GoSdkTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GoSdkTargetGenerateOutput, Box<dyn std::error::Error>> {
        let projection: serde_json::Value = serde_json::from_str(&input.projection)?;
        let config: serde_json::Value = serde_json::from_str(&input.config)?;

        let module_name = config.get("module")
            .and_then(|v| v.as_str())
            .unwrap_or("github.com/generated/sdk");

        let concept_name = projection.get("concept")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        let pascal = to_pascal_case(concept_name);
        let snake = to_snake_case(concept_name);
        let pkg_name = snake.clone();

        let mut files: Vec<String> = Vec::new();

        // Generate types.go with input/output structs
        let actions = projection.get("actions")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut types_code = format!("package {}\n\n", pkg_name);

        let needs_time = actions.iter().any(|a| {
            a.get("fields")
                .and_then(|f| f.as_array())
                .map(|fields| fields.iter().any(|f| {
                    f.get("type").and_then(|t| t.as_str()).map(|t| t == "datetime" || t == "DateTime").unwrap_or(false)
                }))
                .unwrap_or(false)
        });

        if needs_time {
            types_code.push_str("import \"time\"\n\n");
        }

        for action in &actions {
            let action_name = action.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let action_pascal = to_pascal_case(action_name);

            // Input struct
            types_code.push_str(&format!("type {}{}Input struct {{\n", pascal, action_pascal));
            if let Some(fields) = action.get("input").and_then(|v| v.as_array()) {
                for field in fields {
                    let fname = field.get("name").and_then(|v| v.as_str()).unwrap_or("field");
                    let ftype = field.get("type").and_then(|v| v.as_str()).unwrap_or("string");
                    let go_type = clef_type_to_go(ftype);
                    let field_pascal = to_pascal_case(fname);
                    types_code.push_str(&format!("\t{} {} `json:\"{}\"`\n", field_pascal, go_type, fname));
                }
            }
            types_code.push_str("}\n\n");

            // Output struct
            types_code.push_str(&format!("type {}{}Output struct {{\n", pascal, action_pascal));
            types_code.push_str("\tVariant string `json:\"variant\"`\n");
            if let Some(fields) = action.get("output").and_then(|v| v.as_array()) {
                for field in fields {
                    let fname = field.get("name").and_then(|v| v.as_str()).unwrap_or("field");
                    let ftype = field.get("type").and_then(|v| v.as_str()).unwrap_or("string");
                    let go_type = clef_type_to_go(ftype);
                    let field_pascal = to_pascal_case(fname);
                    types_code.push_str(&format!("\t{} {} `json:\"{},omitempty\"`\n", field_pascal, go_type, fname));
                }
            }
            types_code.push_str("}\n\n");
        }

        let types_file = format!("{}/types.go", pkg_name);
        files.push(types_file);

        // Generate client.go with the concept client
        let mut client_code = format!("package {}\n\n", pkg_name);
        client_code.push_str("import (\n\t\"context\"\n\t\"encoding/json\"\n\t\"fmt\"\n\t\"net/http\"\n\t\"bytes\"\n)\n\n");
        client_code.push_str(&format!("type {}Client struct {{\n\tBaseURL string\n\tHTTPClient *http.Client\n}}\n\n", pascal));
        client_code.push_str(&format!("func New{}Client(baseURL string) *{}Client {{\n\treturn &{}Client{{\n\t\tBaseURL: baseURL,\n\t\tHTTPClient: http.DefaultClient,\n\t}}\n}}\n\n", pascal, pascal, pascal));

        for action in &actions {
            let action_name = action.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let action_pascal = to_pascal_case(action_name);

            client_code.push_str(&format!(
                "func (c *{pascal}Client) {action_pascal}(ctx context.Context, input {pascal}{action_pascal}Input) (*{pascal}{action_pascal}Output, error) {{\n"
            ));
            client_code.push_str("\tbody, err := json.Marshal(input)\n");
            client_code.push_str("\tif err != nil {\n\t\treturn nil, fmt.Errorf(\"marshal: %w\", err)\n\t}\n");
            client_code.push_str(&format!(
                "\treq, err := http.NewRequestWithContext(ctx, \"POST\", c.BaseURL+\"/{}/{}\", bytes.NewReader(body))\n",
                concept_name, action_name
            ));
            client_code.push_str("\tif err != nil {\n\t\treturn nil, fmt.Errorf(\"request: %w\", err)\n\t}\n");
            client_code.push_str("\treq.Header.Set(\"Content-Type\", \"application/json\")\n");
            client_code.push_str("\tresp, err := c.HTTPClient.Do(req)\n");
            client_code.push_str("\tif err != nil {\n\t\treturn nil, fmt.Errorf(\"do: %w\", err)\n\t}\n");
            client_code.push_str("\tdefer resp.Body.Close()\n");
            client_code.push_str(&format!("\tvar out {pascal}{action_pascal}Output\n"));
            client_code.push_str("\tif err := json.NewDecoder(resp.Body).Decode(&out); err != nil {\n\t\treturn nil, fmt.Errorf(\"decode: %w\", err)\n\t}\n");
            client_code.push_str("\treturn &out, nil\n}\n\n");
        }

        let client_file = format!("{}/client.go", pkg_name);
        files.push(client_file);

        // Store generation result
        let module = format!("{}/{}", module_name, pkg_name);
        storage.put("sdk_output", concept_name, json!({
            "module": module,
            "files": serde_json::to_string(&files)?,
            "concept": concept_name,
        })).await?;

        Ok(GoSdkTargetGenerateOutput::Ok {
            module,
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
        let handler = GoSdkTargetHandlerImpl;
        let projection = serde_json::json!({
            "concept": "user",
            "actions": [
                {
                    "name": "create",
                    "input": [{"name": "name", "type": "string"}],
                    "output": [{"name": "id", "type": "string"}]
                }
            ]
        });
        let config = serde_json::json!({"module": "github.com/myorg/sdk"});
        let result = handler.generate(
            GoSdkTargetGenerateInput {
                projection: serde_json::to_string(&projection).unwrap(),
                config: serde_json::to_string(&config).unwrap(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GoSdkTargetGenerateOutput::Ok { module, files } => {
                assert!(module.contains("user"));
                assert!(files.iter().any(|f| f.contains("types.go")));
                assert!(files.iter().any(|f| f.contains("client.go")));
            },
        }
    }

    #[tokio::test]
    async fn test_generate_with_defaults() {
        let storage = InMemoryStorage::new();
        let handler = GoSdkTargetHandlerImpl;
        let projection = serde_json::json!({
            "concept": "article",
            "actions": []
        });
        let config = serde_json::json!({});
        let result = handler.generate(
            GoSdkTargetGenerateInput {
                projection: serde_json::to_string(&projection).unwrap(),
                config: serde_json::to_string(&config).unwrap(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GoSdkTargetGenerateOutput::Ok { module, files } => {
                assert!(module.contains("article"));
                assert_eq!(files.len(), 2);
            },
        }
    }
}
