use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RustBuilderHandler;
use serde_json::json;

pub struct RustBuilderHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("rust-build-{}-{}", t.as_secs(), t.subsec_nanos())
}

/// Compute a simple hash of the source content for artifact identity.
fn hash_content(content: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in content.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

#[async_trait]
impl RustBuilderHandler for RustBuilderHandlerImpl {
    async fn build(
        &self,
        input: RustBuilderBuildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RustBuilderBuildOutput, Box<dyn std::error::Error>> {
        let build_id = next_id();
        let artifact_hash = hash_content(&input.source);
        let artifact_path = format!("target/{}/release/{}", input.platform, build_id);

        // Store build record
        storage.put("rust-build", &build_id, json!({
            "id": build_id,
            "source": input.source,
            "toolchainPath": input.toolchain_path,
            "platform": input.platform,
            "config": input.config,
            "artifactPath": artifact_path,
            "artifactHash": artifact_hash,
            "status": "success"
        })).await?;

        Ok(RustBuilderBuildOutput::Ok {
            build: build_id,
            artifact_path,
            artifact_hash,
        })
    }

    async fn test(
        &self,
        input: RustBuilderTestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RustBuilderTestOutput, Box<dyn std::error::Error>> {
        let build = storage.get("rust-build", &input.build).await?;
        let test_type = input.test_type.unwrap_or_else(|| "unit".to_string());

        if build.is_none() {
            return Ok(RustBuilderTestOutput::TestFailure {
                passed: 0,
                failed: 1,
                failures: serde_json::to_string(&vec![json!({
                    "test": "build_check",
                    "message": format!("Build '{}' not found", input.build)
                })])?,
                test_type,
            });
        }

        // Simulate test execution: all tests pass for valid builds
        Ok(RustBuilderTestOutput::Ok {
            passed: 1,
            failed: 0,
            skipped: 0,
            duration: 150,
            test_type,
        })
    }

    async fn package(
        &self,
        input: RustBuilderPackageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RustBuilderPackageOutput, Box<dyn std::error::Error>> {
        let valid_formats = ["crate", "binary", "wasm", "docker"];
        if !valid_formats.contains(&input.format.as_str()) {
            return Ok(RustBuilderPackageOutput::FormatUnsupported {
                format: input.format,
            });
        }

        let build = storage.get("rust-build", &input.build).await?;
        let build_hash = build.as_ref()
            .and_then(|b| b.get("artifactHash").and_then(|v| v.as_str()))
            .unwrap_or("unknown")
            .to_string();

        let ext = match input.format.as_str() {
            "crate" => ".crate",
            "binary" => "",
            "wasm" => ".wasm",
            "docker" => ".tar.gz",
            _ => ".pkg",
        };

        let artifact_path = format!("dist/{}{}", input.build, ext);
        let artifact_hash = hash_content(&format!("{}-{}", build_hash, input.format));

        Ok(RustBuilderPackageOutput::Ok {
            artifact_path,
            artifact_hash,
        })
    }

    async fn register(
        &self,
        _input: RustBuilderRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<RustBuilderRegisterOutput, Box<dyn std::error::Error>> {
        Ok(RustBuilderRegisterOutput::Ok {
            name: "rust".to_string(),
            language: "rust".to_string(),
            capabilities: vec![
                "compile".to_string(),
                "test".to_string(),
                "package".to_string(),
                "cross-compile".to_string(),
                "wasm".to_string(),
            ],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_build_success() {
        let storage = InMemoryStorage::new();
        let handler = RustBuilderHandlerImpl;
        let result = handler.build(
            RustBuilderBuildInput {
                source: "fn main() {}".to_string(),
                toolchain_path: "/usr/bin/rustc".to_string(),
                platform: "linux-x64".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RustBuilderBuildOutput::Ok { build, artifact_path, artifact_hash } => {
                assert!(build.starts_with("rust-build-"));
                assert!(!artifact_path.is_empty());
                assert!(!artifact_hash.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_test_build_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RustBuilderHandlerImpl;
        let result = handler.test(
            RustBuilderTestInput { build: "missing".to_string(), test_type: None },
            &storage,
        ).await.unwrap();
        match result {
            RustBuilderTestOutput::TestFailure { failed, .. } => {
                assert_eq!(failed, 1);
            },
            _ => panic!("Expected TestFailure variant"),
        }
    }

    #[tokio::test]
    async fn test_package_format_unsupported() {
        let storage = InMemoryStorage::new();
        let handler = RustBuilderHandlerImpl;
        let result = handler.package(
            RustBuilderPackageInput { build: "b1".to_string(), format: "invalid".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RustBuilderPackageOutput::FormatUnsupported { format } => {
                assert_eq!(format, "invalid");
            },
            _ => panic!("Expected FormatUnsupported variant"),
        }
    }

    #[tokio::test]
    async fn test_package_crate_format() {
        let storage = InMemoryStorage::new();
        let handler = RustBuilderHandlerImpl;
        let result = handler.package(
            RustBuilderPackageInput { build: "b1".to_string(), format: "crate".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RustBuilderPackageOutput::Ok { artifact_path, .. } => {
                assert!(artifact_path.ends_with(".crate"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = RustBuilderHandlerImpl;
        let result = handler.register(
            RustBuilderRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            RustBuilderRegisterOutput::Ok { name, language, capabilities } => {
                assert_eq!(name, "rust");
                assert_eq!(language, "rust");
                assert!(capabilities.contains(&"compile".to_string()));
            },
        }
    }
}
