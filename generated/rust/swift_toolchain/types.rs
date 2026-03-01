// generated: swift_toolchain/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SwiftToolchainResolveInput {
    pub platform: String,
    pub version_constraint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SwiftToolchainResolveOutput {
    Ok {
        toolchain: String,
        swiftc_path: String,
        version: String,
        capabilities: Vec<String>,
    },
    NotInstalled {
        install_hint: String,
    },
    XcodeRequired {
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SwiftToolchainRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SwiftToolchainRegisterOutput {
    Ok {
        name: String,
        language: String,
        capabilities: Vec<String>,
    },
}

