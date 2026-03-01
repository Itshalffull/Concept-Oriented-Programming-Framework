// Toolchain concept implementation
// Coordination concept for tool resolution. Manages discovering, validating, and
// querying toolchain capabilities across languages and platforms.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ToolchainHandler;
use serde_json::json;

const RELATION: &str = "toolchain";

pub struct ToolchainHandlerImpl;

#[async_trait]
impl ToolchainHandler for ToolchainHandlerImpl {
    async fn resolve(
        &self,
        input: ToolchainResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolchainResolveOutput, Box<dyn std::error::Error>> {
        let category = input.category.as_deref().unwrap_or("compiler");

        // Check if a matching toolchain is already registered
        let mut query = json!({"language": input.language, "platform": input.platform, "category": category});
        if let Some(ref tool_name) = input.tool_name {
            query["toolName"] = json!(tool_name);
        }

        let existing = storage.find(RELATION, Some(&query)).await?;

        if !existing.is_empty() {
            let rec = &existing[0];
            let installed_version = rec["version"].as_str().unwrap_or("").to_string();

            if let Some(ref version_constraint) = input.version_constraint {
                if installed_version != *version_constraint {
                    return Ok(ToolchainResolveOutput::VersionMismatch {
                        language: input.language,
                        installed: installed_version,
                        required: version_constraint.clone(),
                    });
                }
            }

            return Ok(ToolchainResolveOutput::Ok {
                tool: rec["tool"].as_str().unwrap_or("").to_string(),
                version: installed_version,
                path: rec["path"].as_str().unwrap_or("").to_string(),
                capabilities: serde_json::from_str(rec["capabilities"].as_str().unwrap_or("[]")).unwrap_or_default(),
                invocation: json!({
                    "command": rec["command"].as_str().or(rec["path"].as_str()).unwrap_or(""),
                    "args": serde_json::from_str::<Vec<String>>(rec["args"].as_str().unwrap_or("[]")).unwrap_or_default(),
                    "output_format": rec["outputFormat"].as_str().unwrap_or("text"),
                    "config_file": rec["configFile"].as_str(),
                    "env": rec.get("env").and_then(|e| e.as_str()).and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
                }),
            });
        }

        // Use built-in defaults for known languages
        let (tool_name_str, version, path, capabilities, command, args, output_format, config_file) = match (input.language.as_str(), category) {
            ("typescript", "compiler") => ("tsc", "5.4.0", "/usr/local/bin/tsc",
                vec!["compile", "typecheck", "bundle", "sourcemap"],
                "npx tsc", vec!["--noEmit", "--pretty", "--diagnostics"], "tsc-diag", Some("tsconfig.json")),
            ("typescript", "unit-runner") => ("vitest", "1.6.0", "/usr/local/bin/vitest",
                vec!["vitest", "jest-compat", "parallel", "coverage", "filter"],
                "npx vitest run", vec!["--reporter=json", "--coverage"], "vitest-json", Some("vitest.config.ts")),
            ("rust", "compiler") => ("rustc", "1.77.0", "/usr/local/bin/rustc",
                vec!["compile", "link", "test", "bench", "clippy"],
                "cargo build", vec!["--message-format=json"], "cargo-json", Some("Cargo.toml")),
            ("rust", "unit-runner") => ("cargo-test", "1.77.0", "/usr/local/bin/cargo",
                vec!["cargo-test", "parallel", "filter", "coverage"],
                "cargo test", vec!["--", "--format=json", "-Z", "unstable-options"], "cargo-test-json", Some("Cargo.toml")),
            ("swift", "compiler") => ("swiftc", "5.10.1", "/usr/bin/swiftc",
                vec!["compile", "test", "cross-compile", "macros", "swift-testing"],
                "swiftc", vec!["-O", "-whole-module-optimization"], "swift-diag", None),
            ("solidity", "compiler") => ("foundry", "0.2.0", "/usr/local/bin/forge",
                vec!["compile", "optimizer", "via-ir", "foundry-tests"],
                "forge build", vec!["--json"], "forge-json", Some("foundry.toml")),
            _ => {
                return Ok(ToolchainResolveOutput::PlatformUnsupported {
                    language: input.language,
                    platform: input.platform,
                });
            }
        };

        if let Some(ref vc) = input.version_constraint {
            if version != vc.as_str() {
                return Ok(ToolchainResolveOutput::NotInstalled {
                    language: input.language.clone(),
                    platform: input.platform.clone(),
                    install_hint: format!("Install {} {} {} for {}", input.language, category, vc, input.platform),
                });
            }
        }

        let tool_id = format!("tc-{}", chrono::Utc::now().timestamp_millis());
        let caps: Vec<String> = capabilities.iter().map(|s| s.to_string()).collect();
        let args_vec: Vec<String> = args.iter().map(|s| s.to_string()).collect();

        storage.put(RELATION, &tool_id, json!({
            "tool": tool_id,
            "language": input.language,
            "platform": input.platform,
            "category": category,
            "toolName": tool_name_str,
            "version": version,
            "path": path,
            "capabilities": serde_json::to_string(&caps)?,
            "command": command,
            "args": serde_json::to_string(&args_vec)?,
            "outputFormat": output_format,
            "configFile": config_file,
            "status": "active",
            "resolvedAt": chrono::Utc::now().to_rfc3339()
        })).await?;

        Ok(ToolchainResolveOutput::Ok {
            tool: tool_id,
            version: version.to_string(),
            path: path.to_string(),
            capabilities: caps,
            invocation: json!({
                "command": command,
                "args": args_vec,
                "output_format": output_format,
                "config_file": config_file,
                "env": null
            }),
        })
    }

    async fn validate(
        &self,
        input: ToolchainValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolchainValidateOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.tool).await?;
        if record.is_none() {
            return Ok(ToolchainValidateOutput::Invalid {
                tool: input.tool,
                reason: "Toolchain not found".to_string(),
            });
        }

        let record = record.unwrap();
        let mut updated = record.clone();
        updated["status"] = json!("validated");
        updated["validatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put(RELATION, &input.tool, updated).await?;

        Ok(ToolchainValidateOutput::Ok {
            tool: input.tool,
            version: record["version"].as_str().unwrap_or("").to_string(),
        })
    }

    async fn list(
        &self,
        input: ToolchainListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolchainListOutput, Box<dyn std::error::Error>> {
        let mut query = json!({});
        if let Some(ref language) = input.language {
            query["language"] = json!(language);
        }
        if let Some(ref category) = input.category {
            query["category"] = json!(category);
        }

        let records = storage.find(RELATION, Some(&query)).await?;

        let tools: Vec<serde_json::Value> = records.iter().map(|rec| {
            json!({
                "language": rec["language"].as_str().unwrap_or(""),
                "platform": rec["platform"].as_str().unwrap_or(""),
                "category": rec["category"].as_str().unwrap_or("compiler"),
                "tool_name": rec["toolName"].as_str(),
                "version": rec["version"].as_str().unwrap_or(""),
                "path": rec["path"].as_str().unwrap_or(""),
                "command": rec["command"].as_str().or(rec["path"].as_str()).unwrap_or(""),
                "status": rec["status"].as_str().unwrap_or("")
            })
        }).collect();

        Ok(ToolchainListOutput::Ok { tools })
    }

    async fn capabilities(
        &self,
        input: ToolchainCapabilitiesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolchainCapabilitiesOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.tool).await?;
        if record.is_none() {
            return Ok(ToolchainCapabilitiesOutput::Ok {
                capabilities: vec![],
            });
        }

        let record = record.unwrap();
        let capabilities: Vec<String> = serde_json::from_str(
            record["capabilities"].as_str().unwrap_or("[]")
        ).unwrap_or_default();

        Ok(ToolchainCapabilitiesOutput::Ok { capabilities })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_resolve_typescript_compiler() {
        let storage = InMemoryStorage::new();
        let handler = ToolchainHandlerImpl;
        let result = handler.resolve(
            ToolchainResolveInput {
                language: "typescript".to_string(),
                platform: "linux-x86_64".to_string(),
                version_constraint: None,
                category: Some("compiler".to_string()),
                tool_name: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            ToolchainResolveOutput::Ok { tool, version, capabilities, .. } => {
                assert!(!tool.is_empty());
                assert!(!version.is_empty());
                assert!(capabilities.contains(&"compile".to_string()));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_unsupported_platform() {
        let storage = InMemoryStorage::new();
        let handler = ToolchainHandlerImpl;
        let result = handler.resolve(
            ToolchainResolveInput {
                language: "cobol".to_string(),
                platform: "mainframe".to_string(),
                version_constraint: None,
                category: None,
                tool_name: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            ToolchainResolveOutput::PlatformUnsupported { .. } => {},
            _ => panic!("Expected PlatformUnsupported variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_version_mismatch() {
        let storage = InMemoryStorage::new();
        let handler = ToolchainHandlerImpl;
        let result = handler.resolve(
            ToolchainResolveInput {
                language: "typescript".to_string(),
                platform: "linux-x86_64".to_string(),
                version_constraint: Some("99.0.0".to_string()),
                category: Some("compiler".to_string()),
                tool_name: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            ToolchainResolveOutput::NotInstalled { .. } => {},
            _ => panic!("Expected NotInstalled variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ToolchainHandlerImpl;
        let result = handler.validate(
            ToolchainValidateInput { tool: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ToolchainValidateOutput::Invalid { reason, .. } => {
                assert!(reason.contains("not found"));
            },
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_list_empty() {
        let storage = InMemoryStorage::new();
        let handler = ToolchainHandlerImpl;
        let result = handler.list(
            ToolchainListInput { language: None, category: None },
            &storage,
        ).await.unwrap();
        match result {
            ToolchainListOutput::Ok { tools } => {
                assert!(tools.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_capabilities_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ToolchainHandlerImpl;
        let result = handler.capabilities(
            ToolchainCapabilitiesInput { tool: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ToolchainCapabilitiesOutput::Ok { capabilities } => {
                assert!(capabilities.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
