// generated: type_script_toolchain/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TypeScriptToolchainResolveInput {
    pub platform: String,
    pub version_constraint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TypeScriptToolchainResolveOutput {
    Ok {
        toolchain: String,
        tsc_path: String,
        version: String,
        capabilities: Vec<String>,
    },
    NotInstalled {
        install_hint: String,
    },
    NodeVersionMismatch {
        installed: String,
        required: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TypeScriptToolchainRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TypeScriptToolchainRegisterOutput {
    Ok {
        name: String,
        language: String,
        capabilities: Vec<String>,
    },
}

