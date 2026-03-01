// generated: solidity_toolchain/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SolidityToolchainResolveInput {
    pub platform: String,
    pub version_constraint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SolidityToolchainResolveOutput {
    Ok {
        toolchain: String,
        solc_path: String,
        version: String,
        capabilities: Vec<String>,
    },
    NotInstalled {
        install_hint: String,
    },
    EvmVersionUnsupported {
        requested: String,
        supported: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SolidityToolchainRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SolidityToolchainRegisterOutput {
    Ok {
        name: String,
        language: String,
        capabilities: Vec<String>,
    },
}

