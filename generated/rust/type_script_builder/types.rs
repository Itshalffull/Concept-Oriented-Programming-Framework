// generated: type_script_builder/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TypeScriptBuilderBuildInput {
    pub source: String,
    pub toolchain_path: String,
    pub platform: String,
    pub config: { mode: String, features: Option<Vec<String>> },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TypeScriptBuilderBuildOutput {
    Ok {
        build: String,
        artifact_path: String,
        artifact_hash: String,
    },
    TypeError {
        errors: Vec<{ file: String, line: i64, message: String }>,
    },
    BundleError {
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TypeScriptBuilderTestInput {
    pub build: String,
    pub toolchain_path: String,
    pub invocation: Option<{ command: String, args: Vec<String>, output_format: String, config_file: Option<String>, env: Option<String> }>,
    pub test_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TypeScriptBuilderTestOutput {
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
pub struct TypeScriptBuilderPackageInput {
    pub build: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TypeScriptBuilderPackageOutput {
    Ok {
        artifact_path: String,
        artifact_hash: String,
    },
    FormatUnsupported {
        format: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TypeScriptBuilderRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TypeScriptBuilderRegisterOutput {
    Ok {
        name: String,
        language: String,
        capabilities: Vec<String>,
    },
}

