// generated: rust_toolchain/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RustToolchainResolveInput {
    pub platform: String,
    pub version_constraint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RustToolchainResolveOutput {
    Ok {
        toolchain: String,
        rustc_path: String,
        version: String,
        capabilities: Vec<String>,
    },
    NotInstalled {
        install_hint: String,
    },
    TargetMissing {
        target: String,
        install_hint: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RustToolchainRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RustToolchainRegisterOutput {
    Ok {
        name: String,
        language: String,
        capabilities: Vec<String>,
    },
}

