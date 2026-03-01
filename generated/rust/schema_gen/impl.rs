use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SchemaGenHandler;
use serde_json::json;

pub struct SchemaGenHandlerImpl;

/// Extract manifest fields from a parsed ConceptAST.
fn extract_manifest(ast: &serde_json::Value) -> serde_json::Value {
    let concept = ast.get("concept").and_then(|v| v.as_str()).unwrap_or("unknown");
    let purpose = ast.get("purpose").and_then(|v| v.as_str()).unwrap_or("");

    let actions: Vec<serde_json::Value> = ast.get("actions")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().map(|a| {
            let name = a.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let params: Vec<&str> = a.get("params")
                .and_then(|v| v.as_array())
                .map(|p| p.iter().filter_map(|x| x.as_str()).collect())
                .unwrap_or_default();
            let variants: Vec<&str> = a.get("variants")
                .and_then(|v| v.as_array())
                .map(|p| p.iter().filter_map(|x| x.get("tag").and_then(|t| t.as_str())).collect())
                .unwrap_or_default();
            json!({
                "name": name,
                "params": params,
                "variants": variants
            })
        }).collect())
        .unwrap_or_default();

    let state_fields: Vec<serde_json::Value> = ast.get("stateFields")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().map(|f| {
            json!({
                "name": f.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                "type": f.get("type").and_then(|v| v.as_str()).unwrap_or(""),
                "relation": f.get("relation").and_then(|v| v.as_str()).unwrap_or("")
            })
        }).collect())
        .unwrap_or_default();

    json!({
        "concept": concept,
        "purpose": purpose,
        "actions": actions,
        "stateFields": state_fields,
        "typeParams": ast.get("typeParams").cloned().unwrap_or(json!([])),
        "invariants": ast.get("invariants").cloned().unwrap_or(json!([]))
    })
}

#[async_trait]
impl SchemaGenHandler for SchemaGenHandlerImpl {
    async fn generate(
        &self,
        input: SchemaGenGenerateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SchemaGenGenerateOutput, Box<dyn std::error::Error>> {
        let manifest = extract_manifest(&input.ast);
        Ok(SchemaGenGenerateOutput::Ok { manifest })
    }

    async fn register(
        &self,
        _input: SchemaGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SchemaGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(SchemaGenRegisterOutput::Ok {
            name: "schema-gen".to_string(),
            input_kind: "concept-ast".to_string(),
            output_kind: "concept-manifest".to_string(),
            capabilities: vec![
                "actions".to_string(),
                "state-fields".to_string(),
                "invariants".to_string(),
                "type-params".to_string(),
            ],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_extracts_manifest() {
        let storage = InMemoryStorage::new();
        let handler = SchemaGenHandlerImpl;
        let ast = serde_json::json!({
            "concept": "User",
            "purpose": "Manage user accounts",
            "actions": [
                {"name": "create", "params": ["name"], "variants": [{"tag": "ok"}, {"tag": "error"}]}
            ],
            "stateFields": [{"name": "name", "type": "string", "relation": ""}]
        });
        let result = handler.generate(
            SchemaGenGenerateInput { ast },
            &storage,
        ).await.unwrap();
        match result {
            SchemaGenGenerateOutput::Ok { manifest } => {
                assert_eq!(manifest["concept"], "User");
                assert_eq!(manifest["purpose"], "Manage user accounts");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = SchemaGenHandlerImpl;
        let result = handler.register(
            SchemaGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            SchemaGenRegisterOutput::Ok { name, input_kind, output_kind, .. } => {
                assert_eq!(name, "schema-gen");
                assert_eq!(input_kind, "concept-ast");
                assert_eq!(output_kind, "concept-manifest");
            },
        }
    }
}
