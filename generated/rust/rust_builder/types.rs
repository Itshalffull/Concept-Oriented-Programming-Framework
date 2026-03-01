// generated: rust_builder/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RustBuilderBuildInput {
    pub source: String,
    pub toolchain_path: String,
    pub platform: String,
    pub config: { mode: String, features: Option<Vec<String>> },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RustBuilderBuildOutput {
    Ok {
        build: String,
        artifact_path: String,
        artifact_hash: String,
    },
    CompilationError {
        errors: Vec<{ file: String, line: i64, message: String }>,
    },
    FeatureConflict {
        conflicting: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RustBuilderTestInput {
    pub build: String,
    pub toolchain_path: String,
    pub invocation: Option<{ command: String, args: Vec<String>, output_format: String, config_file: Option<String>, env: Option<String> }>,
    pub test_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RustBuilderTestOutput {
    Ok {
        passed: i64,
        failed: i64,
        skipped: i64,
        duration: i64,
        test_type: String,
    },
    TestFailure {
        passed: i64,
        failed: i64,
        failures: Vec<{ test: String, message: String }>,
        test_type: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RustBuilderPackageInput {
    pub build: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RustBuilderPackageOutput {
    Ok {
        artifact_path: String,
        artifact_hash: String,
    },
    FormatUnsupported {
        format: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RustBuilderRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RustBuilderRegisterOutput {
    Ok {
        name: String,
        language: String,
        capabilities: Vec<String>,
    },
}

