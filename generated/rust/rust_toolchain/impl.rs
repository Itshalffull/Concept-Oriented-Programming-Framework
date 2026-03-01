use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RustToolchainHandler;
use serde_json::json;

pub struct RustToolchainHandlerImpl;

/// Known platform targets and their Rust triple mappings.
fn platform_to_target(platform: &str) -> Option<&'static str> {
    match platform {
        "linux-x64" | "linux-amd64" => Some("x86_64-unknown-linux-gnu"),
        "linux-arm64" | "linux-aarch64" => Some("aarch64-unknown-linux-gnu"),
        "macos-x64" | "darwin-amd64" => Some("x86_64-apple-darwin"),
        "macos-arm64" | "darwin-aarch64" => Some("aarch64-apple-darwin"),
        "windows-x64" | "win32-amd64" => Some("x86_64-pc-windows-msvc"),
        "wasm" | "wasm32" => Some("wasm32-unknown-unknown"),
        "wasi" | "wasm32-wasi" => Some("wasm32-wasi"),
        _ => None,
    }
}

#[async_trait]
impl RustToolchainHandler for RustToolchainHandlerImpl {
    async fn resolve(
        &self,
        input: RustToolchainResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RustToolchainResolveOutput, Box<dyn std::error::Error>> {
        let target = platform_to_target(&input.platform);
        if target.is_none() {
            return Ok(RustToolchainResolveOutput::TargetMissing {
                target: input.platform.clone(),
                install_hint: format!("rustup target add <target> for platform '{}'", input.platform),
            });
        }

        let target = target.unwrap();
        let version = input.version_constraint.unwrap_or_else(|| "stable".to_string());

        // Check if we have a registered toolchain for this version
        let existing = storage.find("rust-toolchain", Some(&json!({"version": version}))).await?;

        if existing.is_empty() {
            // Simulate toolchain availability check
            let toolchain_id = format!("rustc-{}-{}", version, target);
            let rustc_path = format!("$HOME/.rustup/toolchains/{}/bin/rustc", version);

            // Register the toolchain for future lookups
            storage.put("rust-toolchain", &toolchain_id, json!({
                "id": toolchain_id,
                "version": version,
                "target": target,
                "rustcPath": rustc_path,
                "capabilities": ["std", "alloc", "core"]
            })).await?;

            return Ok(RustToolchainResolveOutput::Ok {
                toolchain: toolchain_id,
                rustc_path,
                version,
                capabilities: vec!["std".to_string(), "alloc".to_string(), "core".to_string()],
            });
        }

        let tc = &existing[0];
        Ok(RustToolchainResolveOutput::Ok {
            toolchain: tc.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            rustc_path: tc.get("rustcPath").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            version: tc.get("version").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            capabilities: tc.get("capabilities")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
        })
    }

    async fn register(
        &self,
        _input: RustToolchainRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<RustToolchainRegisterOutput, Box<dyn std::error::Error>> {
        Ok(RustToolchainRegisterOutput::Ok {
            name: "rust".to_string(),
            language: "rust".to_string(),
            capabilities: vec![
                "compile".to_string(),
                "cross-compile".to_string(),
                "wasm".to_string(),
                "clippy".to_string(),
                "fmt".to_string(),
            ],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_resolve_known_platform() {
        let storage = InMemoryStorage::new();
        let handler = RustToolchainHandlerImpl;
        let result = handler.resolve(
            RustToolchainResolveInput {
                platform: "linux-x64".to_string(),
                version_constraint: Some("stable".to_string()),
            },
            &storage,
        ).await.unwrap();
        match result {
            RustToolchainResolveOutput::Ok { toolchain, version, capabilities, .. } => {
                assert!(toolchain.contains("stable"));
                assert_eq!(version, "stable");
                assert!(capabilities.contains(&"std".to_string()));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_unknown_platform() {
        let storage = InMemoryStorage::new();
        let handler = RustToolchainHandlerImpl;
        let result = handler.resolve(
            RustToolchainResolveInput {
                platform: "unknown-platform".to_string(),
                version_constraint: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            RustToolchainResolveOutput::TargetMissing { target, .. } => {
                assert_eq!(target, "unknown-platform");
            },
            _ => panic!("Expected TargetMissing variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = RustToolchainHandlerImpl;
        let result = handler.register(
            RustToolchainRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            RustToolchainRegisterOutput::Ok { name, language, capabilities } => {
                assert_eq!(name, "rust");
                assert_eq!(language, "rust");
                assert!(capabilities.contains(&"wasm".to_string()));
            },
        }
    }
}
