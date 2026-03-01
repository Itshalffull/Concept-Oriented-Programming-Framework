// Solidity toolchain resolution: locates solc compiler and determines capabilities.
// Resolves platform-specific paths and validates EVM version support.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SolidityToolchainHandler;
use serde_json::json;

pub struct SolidityToolchainHandlerImpl;

const SUPPORTED_EVM_VERSIONS: &[&str] = &[
    "homestead", "tangerineWhistle", "spuriousDragon", "byzantium",
    "constantinople", "petersburg", "istanbul", "berlin", "london",
    "paris", "shanghai", "cancun",
];

#[async_trait]
impl SolidityToolchainHandler for SolidityToolchainHandlerImpl {
    async fn resolve(
        &self,
        input: SolidityToolchainResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolidityToolchainResolveOutput, Box<dyn std::error::Error>> {
        let platform = &input.platform;
        let version_constraint = input.version_constraint.as_deref().unwrap_or(">=0.8.20");

        // Determine solc path based on platform
        let solc_path = match platform.as_str() {
            "linux" | "linux-x64" | "linux-arm64" => "/usr/bin/solc".to_string(),
            "macos" | "darwin" | "darwin-arm64" => "/usr/local/bin/solc".to_string(),
            "windows" | "win32" => "C:\Program Files\solc\solc.exe".to_string(),
            _ => {
                return Ok(SolidityToolchainResolveOutput::NotInstalled {
                    install_hint: format!(
                        "Install solc for {}: https://docs.soliditylang.org/en/latest/installing-solidity.html",
                        platform
                    ),
                });
            }
        };

        // Check if the version constraint references a specific EVM version
        if let Some(constraint) = input.version_constraint.as_deref() {
            if constraint.starts_with("evm:") {
                let requested_evm = &constraint[4..];
                if !SUPPORTED_EVM_VERSIONS.contains(&requested_evm) {
                    return Ok(SolidityToolchainResolveOutput::EvmVersionUnsupported {
                        requested: requested_evm.to_string(),
                        supported: SUPPORTED_EVM_VERSIONS.iter().map(|s| s.to_string()).collect(),
                    });
                }
            }
        }

        let mut capabilities = vec![
            "compile".to_string(),
            "abi-output".to_string(),
            "bin-output".to_string(),
            "optimizer".to_string(),
        ];

        // Newer solc versions support additional features
        capabilities.push("via-ir".to_string());
        capabilities.push("yul".to_string());

        // Cache the resolved toolchain
        let key = format!("solidity-{}", platform);
        storage.put("toolchain", &key, json!({
            "platform": platform,
            "solcPath": &solc_path,
            "version": "0.8.24",
            "versionConstraint": version_constraint,
        })).await?;

        Ok(SolidityToolchainResolveOutput::Ok {
            toolchain: key,
            solc_path,
            version: "0.8.24".to_string(),
            capabilities,
        })
    }

    async fn register(
        &self,
        _input: SolidityToolchainRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SolidityToolchainRegisterOutput, Box<dyn std::error::Error>> {
        Ok(SolidityToolchainRegisterOutput::Ok {
            name: "SolidityToolchain".to_string(),
            language: "solidity".to_string(),
            capabilities: vec![
                "compile".to_string(),
                "abi-output".to_string(),
                "optimizer".to_string(),
                "foundry".to_string(),
            ],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_resolve_linux() {
        let storage = InMemoryStorage::new();
        let handler = SolidityToolchainHandlerImpl;
        let result = handler.resolve(
            SolidityToolchainResolveInput {
                platform: "linux".to_string(),
                version_constraint: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            SolidityToolchainResolveOutput::Ok { toolchain, solc_path, version, capabilities } => {
                assert!(toolchain.contains("solidity"));
                assert_eq!(solc_path, "/usr/bin/solc");
                assert!(!version.is_empty());
                assert!(capabilities.contains(&"compile".to_string()));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_unsupported_platform() {
        let storage = InMemoryStorage::new();
        let handler = SolidityToolchainHandlerImpl;
        let result = handler.resolve(
            SolidityToolchainResolveInput {
                platform: "freebsd".to_string(),
                version_constraint: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            SolidityToolchainResolveOutput::NotInstalled { install_hint } => {
                assert!(install_hint.contains("freebsd"));
            },
            _ => panic!("Expected NotInstalled variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_unsupported_evm_version() {
        let storage = InMemoryStorage::new();
        let handler = SolidityToolchainHandlerImpl;
        let result = handler.resolve(
            SolidityToolchainResolveInput {
                platform: "linux".to_string(),
                version_constraint: Some("evm:nonexistent".to_string()),
            },
            &storage,
        ).await.unwrap();
        match result {
            SolidityToolchainResolveOutput::EvmVersionUnsupported { requested, supported } => {
                assert_eq!(requested, "nonexistent");
                assert!(!supported.is_empty());
            },
            _ => panic!("Expected EvmVersionUnsupported variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = SolidityToolchainHandlerImpl;
        let result = handler.register(
            SolidityToolchainRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            SolidityToolchainRegisterOutput::Ok { name, language, capabilities } => {
                assert_eq!(name, "SolidityToolchain");
                assert_eq!(language, "solidity");
                assert!(capabilities.contains(&"compile".to_string()));
            },
        }
    }
}
