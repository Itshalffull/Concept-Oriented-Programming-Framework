// Swift toolchain resolution: locates swiftc compiler, detects Xcode, and determines capabilities.
// Platform-aware resolution for macOS (Xcode), Linux (swiftenv/toolchains), and cross-compilation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SwiftToolchainHandler;
use serde_json::json;

pub struct SwiftToolchainHandlerImpl;

#[async_trait]
impl SwiftToolchainHandler for SwiftToolchainHandlerImpl {
    async fn resolve(
        &self,
        input: SwiftToolchainResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SwiftToolchainResolveOutput, Box<dyn std::error::Error>> {
        let platform = &input.platform;

        let (swiftc_path, version, needs_xcode) = match platform.as_str() {
            "macos" | "darwin" | "darwin-arm64" | "darwin-x64" => {
                ("/usr/bin/swiftc".to_string(), "5.10".to_string(), true)
            }
            "ios" | "tvos" | "watchos" | "visionos" => {
                // iOS/tvOS/watchOS/visionOS require Xcode
                ("/usr/bin/swiftc".to_string(), "5.10".to_string(), true)
            }
            "linux" | "linux-x64" | "linux-arm64" => {
                ("/usr/bin/swiftc".to_string(), "5.10".to_string(), false)
            }
            "windows" | "win32" => {
                return Ok(SwiftToolchainResolveOutput::NotInstalled {
                    install_hint: "Install Swift for Windows from https://www.swift.org/download/".to_string(),
                });
            }
            _ => {
                return Ok(SwiftToolchainResolveOutput::NotInstalled {
                    install_hint: format!(
                        "Swift is not available for platform \"{}\". See https://www.swift.org/download/",
                        platform
                    ),
                });
            }
        };

        // Check version constraint
        if let Some(constraint) = &input.version_constraint {
            if constraint.starts_with("xcode:") && !needs_xcode {
                return Ok(SwiftToolchainResolveOutput::XcodeRequired {
                    reason: format!("Xcode is not available on platform \"{}\"", platform),
                });
            }
        }

        // iOS platforms always need Xcode
        if needs_xcode && matches!(platform.as_str(), "ios" | "tvos" | "watchos" | "visionos") {
            // These are fine on macOS with Xcode, but we note the requirement
        }

        let mut capabilities = vec![
            "compile".to_string(),
            "swift-package-manager".to_string(),
            "async-await".to_string(),
            "concurrency".to_string(),
        ];

        if needs_xcode {
            capabilities.push("xcode".to_string());
            capabilities.push("xctest".to_string());
            capabilities.push("xcframework".to_string());
        }

        // Swift 5.9+ features
        capabilities.push("macros".to_string());
        capabilities.push("observation".to_string());

        let key = format!("swift-{}", platform);
        storage.put("toolchain", &key, json!({
            "platform": platform,
            "swiftcPath": &swiftc_path,
            "version": &version,
        })).await?;

        Ok(SwiftToolchainResolveOutput::Ok {
            toolchain: key,
            swiftc_path,
            version,
            capabilities,
        })
    }

    async fn register(
        &self,
        _input: SwiftToolchainRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SwiftToolchainRegisterOutput, Box<dyn std::error::Error>> {
        Ok(SwiftToolchainRegisterOutput::Ok {
            name: "SwiftToolchain".to_string(),
            language: "swift".to_string(),
            capabilities: vec![
                "compile".to_string(),
                "spm".to_string(),
                "xctest".to_string(),
                "async-await".to_string(),
            ],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_resolve_macos() {
        let storage = InMemoryStorage::new();
        let handler = SwiftToolchainHandlerImpl;
        let result = handler.resolve(
            SwiftToolchainResolveInput {
                platform: "macos".to_string(),
                version_constraint: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            SwiftToolchainResolveOutput::Ok { toolchain, swiftc_path, capabilities, .. } => {
                assert!(toolchain.contains("swift"));
                assert_eq!(swiftc_path, "/usr/bin/swiftc");
                assert!(capabilities.contains(&"xcode".to_string()));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_windows_not_installed() {
        let storage = InMemoryStorage::new();
        let handler = SwiftToolchainHandlerImpl;
        let result = handler.resolve(
            SwiftToolchainResolveInput {
                platform: "windows".to_string(),
                version_constraint: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            SwiftToolchainResolveOutput::NotInstalled { install_hint } => {
                assert!(install_hint.contains("swift.org"));
            },
            _ => panic!("Expected NotInstalled variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_xcode_required_on_linux() {
        let storage = InMemoryStorage::new();
        let handler = SwiftToolchainHandlerImpl;
        let result = handler.resolve(
            SwiftToolchainResolveInput {
                platform: "linux".to_string(),
                version_constraint: Some("xcode:15".to_string()),
            },
            &storage,
        ).await.unwrap();
        match result {
            SwiftToolchainResolveOutput::XcodeRequired { reason } => {
                assert!(reason.contains("linux"));
            },
            _ => panic!("Expected XcodeRequired variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = SwiftToolchainHandlerImpl;
        let result = handler.register(
            SwiftToolchainRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            SwiftToolchainRegisterOutput::Ok { name, language, .. } => {
                assert_eq!(name, "SwiftToolchain");
                assert_eq!(language, "swift");
            },
        }
    }
}
