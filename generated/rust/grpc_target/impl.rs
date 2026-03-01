// GrpcTarget concept implementation
// Generates Protocol Buffers service definitions and message types from concept projections.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::GrpcTargetHandler;
use serde_json::json;

pub struct GrpcTargetHandlerImpl;

/// Convert concept name to PascalCase for protobuf service naming
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

/// Map Clef types to Protocol Buffer types
fn clef_type_to_proto(clef_type: &str) -> &str {
    match clef_type {
        "string" | "String" => "string",
        "number" | "Number" | "integer" | "int" | "i64" => "int64",
        "float" | "Float" | "f64" | "double" => "double",
        "boolean" | "Boolean" | "bool" => "bool",
        "bytes" | "Bytes" => "bytes",
        "int32" | "i32" => "int32",
        "uint32" | "u32" => "uint32",
        "uint64" | "u64" => "uint64",
        "datetime" | "DateTime" => "google.protobuf.Timestamp",
        _ => "string",
    }
}

/// Determine the gRPC streaming mode for an action
fn streaming_mode(action_name: &str) -> &str {
    let lower = action_name.to_lowercase();
    if lower.starts_with("stream") || lower.starts_with("watch") || lower.starts_with("subscribe") {
        "server_streaming"
    } else if lower.starts_with("upload") || lower.starts_with("push") {
        "client_streaming"
    } else if lower.starts_with("channel") || lower.starts_with("chat") || lower.starts_with("sync") {
        "bidirectional"
    } else {
        "unary"
    }
}

#[async_trait]
impl GrpcTargetHandler for GrpcTargetHandlerImpl {
    async fn generate(
        &self,
        input: GrpcTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GrpcTargetGenerateOutput, Box<dyn std::error::Error>> {
        let projection: serde_json::Value = serde_json::from_str(&input.projection)?;
        let config: serde_json::Value = serde_json::from_str(&input.config)?;

        let concept_name = projection.get("concept")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let service_name = format!("{}Service", to_pascal_case(concept_name));

        let pkg = config.get("package")
            .and_then(|v| v.as_str())
            .unwrap_or(concept_name);

        let actions = projection.get("actions")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut proto = String::new();
        proto.push_str("syntax = \"proto3\";\n\n");
        proto.push_str(&format!("package {};\n\n", pkg));
        proto.push_str("option go_package = \"./pb\";\n\n");

        // Check for timestamp usage
        let needs_timestamp = projection.get("fields")
            .and_then(|v| v.as_array())
            .map(|fields| fields.iter().any(|f| {
                f.get("type").and_then(|t| t.as_str())
                    .map(|t| t == "datetime" || t == "DateTime")
                    .unwrap_or(false)
            }))
            .unwrap_or(false);

        if needs_timestamp {
            proto.push_str("import \"google/protobuf/timestamp.proto\";\n\n");
        }

        // Generate message types for each action
        let mut service_rpcs: Vec<String> = Vec::new();
        let mut services: Vec<String> = vec![service_name.clone()];

        for (field_num_base, action) in actions.iter().enumerate() {
            let action_name = action.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("action");
            let rpc_name = to_pascal_case(action_name);

            // Request message
            proto.push_str(&format!("message {}Request {{\n", rpc_name));
            if let Some(inputs) = action.get("input").and_then(|v| v.as_array()) {
                for (i, field) in inputs.iter().enumerate() {
                    let fname = field.get("name").and_then(|v| v.as_str()).unwrap_or("field");
                    let ftype = field.get("type").and_then(|v| v.as_str()).unwrap_or("string");
                    let proto_type = clef_type_to_proto(ftype);
                    proto.push_str(&format!("  {} {} = {};\n", proto_type, fname, i + 1));
                }
            } else {
                proto.push_str(&format!("  string id = 1;\n"));
            }
            proto.push_str("}\n\n");

            // Response message
            proto.push_str(&format!("message {}Response {{\n", rpc_name));
            proto.push_str("  string variant = 1;\n");
            if let Some(outputs) = action.get("output").and_then(|v| v.as_array()) {
                for (i, field) in outputs.iter().enumerate() {
                    let fname = field.get("name").and_then(|v| v.as_str()).unwrap_or("field");
                    let ftype = field.get("type").and_then(|v| v.as_str()).unwrap_or("string");
                    let proto_type = clef_type_to_proto(ftype);
                    proto.push_str(&format!("  {} {} = {};\n", proto_type, fname, i + 2));
                }
            }
            proto.push_str("}\n\n");

            // Determine streaming mode
            let mode = streaming_mode(action_name);
            let rpc_def = match mode {
                "server_streaming" => format!("  rpc {}({}Request) returns (stream {}Response);", rpc_name, rpc_name, rpc_name),
                "client_streaming" => format!("  rpc {}(stream {}Request) returns ({}Response);", rpc_name, rpc_name, rpc_name),
                "bidirectional" => format!("  rpc {}(stream {}Request) returns (stream {}Response);", rpc_name, rpc_name, rpc_name),
                _ => format!("  rpc {}({}Request) returns ({}Response);", rpc_name, rpc_name, rpc_name),
            };
            service_rpcs.push(rpc_def);
        }

        // Service definition
        proto.push_str(&format!("service {} {{\n", service_name));
        for rpc in &service_rpcs {
            proto.push_str(&format!("{}\n", rpc));
        }
        proto.push_str("}\n");

        let files = vec![
            format!("{}.proto", concept_name),
            format!("{}_grpc.pb.go", concept_name),
            format!("{}.pb.go", concept_name),
        ];

        storage.put("grpc_output", concept_name, json!({
            "concept": concept_name,
            "service": service_name,
            "proto": proto,
            "files": serde_json::to_string(&files)?,
        })).await?;

        Ok(GrpcTargetGenerateOutput::Ok {
            services,
            files,
        })
    }

    async fn validate(
        &self,
        input: GrpcTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GrpcTargetValidateOutput, Box<dyn std::error::Error>> {
        let record = storage.get("grpc_output", &input.service).await?;

        if let Some(output) = record {
            let proto = output.get("proto")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            // Check for field number conflicts (simplified validation)
            // In a real implementation, parse the proto and check for duplicate field numbers
            let mut field_numbers: std::collections::HashMap<String, Vec<i32>> = std::collections::HashMap::new();
            let mut current_message = String::new();

            for line in proto.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("message ") {
                    current_message = trimmed.replace("message ", "").replace(" {", "");
                }
                if trimmed.contains(" = ") && !current_message.is_empty() {
                    if let Some(num_str) = trimmed.split(" = ").last() {
                        if let Ok(num) = num_str.trim_end_matches(';').parse::<i32>() {
                            let nums = field_numbers.entry(current_message.clone()).or_default();
                            if nums.contains(&num) {
                                let field_name = trimmed.split_whitespace()
                                    .nth(1)
                                    .unwrap_or("unknown")
                                    .to_string();
                                return Ok(GrpcTargetValidateOutput::FieldNumberConflict {
                                    service: input.service,
                                    message: current_message,
                                    field: field_name,
                                });
                            }
                            nums.push(num);
                        }
                    }
                }
            }
        }

        Ok(GrpcTargetValidateOutput::Ok {
            service: input.service,
        })
    }

    async fn list_rpcs(
        &self,
        input: GrpcTargetListRpcsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GrpcTargetListRpcsOutput, Box<dyn std::error::Error>> {
        let record = storage.get("grpc_output", &input.concept).await?;

        let mut rpcs: Vec<String> = Vec::new();
        let mut streaming_modes: Vec<String> = Vec::new();

        if let Some(output) = record {
            let proto = output.get("proto")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            for line in proto.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("rpc ") {
                    // Extract RPC name
                    let rpc_name = trimmed
                        .strip_prefix("rpc ")
                        .and_then(|s| s.split('(').next())
                        .unwrap_or("")
                        .trim()
                        .to_string();

                    rpcs.push(rpc_name);

                    // Determine streaming mode from syntax
                    let mode = if trimmed.contains("stream") && trimmed.contains("returns (stream") {
                        "bidirectional"
                    } else if trimmed.contains("returns (stream") {
                        "server_streaming"
                    } else if trimmed.contains("(stream") {
                        "client_streaming"
                    } else {
                        "unary"
                    };
                    streaming_modes.push(mode.to_string());
                }
            }
        }

        Ok(GrpcTargetListRpcsOutput::Ok {
            rpcs,
            streaming_modes,
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
        let handler = GrpcTargetHandlerImpl;
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
        let config = serde_json::json!({"package": "user"});
        let result = handler.generate(
            GrpcTargetGenerateInput {
                projection: serde_json::to_string(&projection).unwrap(),
                config: serde_json::to_string(&config).unwrap(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GrpcTargetGenerateOutput::Ok { services, files } => {
                assert!(services.contains(&"UserService".to_string()));
                assert!(files.iter().any(|f| f.ends_with(".proto")));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_ok() {
        let storage = InMemoryStorage::new();
        let handler = GrpcTargetHandlerImpl;
        let result = handler.validate(
            GrpcTargetValidateInput { service: "user".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GrpcTargetValidateOutput::Ok { service } => {
                assert_eq!(service, "user");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_list_rpcs_empty() {
        let storage = InMemoryStorage::new();
        let handler = GrpcTargetHandlerImpl;
        let result = handler.list_rpcs(
            GrpcTargetListRpcsInput { concept: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GrpcTargetListRpcsOutput::Ok { rpcs, .. } => {
                assert!(rpcs.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_generate_then_list_rpcs() {
        let storage = InMemoryStorage::new();
        let handler = GrpcTargetHandlerImpl;
        let projection = serde_json::json!({
            "concept": "article",
            "actions": [
                {"name": "create", "input": [], "output": []},
                {"name": "get", "input": [], "output": []}
            ]
        });
        let config = serde_json::json!({"package": "article"});
        handler.generate(
            GrpcTargetGenerateInput {
                projection: serde_json::to_string(&projection).unwrap(),
                config: serde_json::to_string(&config).unwrap(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.list_rpcs(
            GrpcTargetListRpcsInput { concept: "article".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GrpcTargetListRpcsOutput::Ok { rpcs, streaming_modes } => {
                assert_eq!(rpcs.len(), 2);
                assert_eq!(streaming_modes.len(), 2);
            },
        }
    }
}
