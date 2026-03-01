// generated: toolchain/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolchainResolveInput {
    pub language: String,
    pub platform: String,
    pub version_constraint: Option<String>,
    pub category: Option<String>,
    pub tool_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ToolchainResolveOutput {
    Ok {
        tool: String,
        version: String,
        path: String,
        capabilities: Vec<String>,
        invocation: { command: String, args: Vec<String>, output_format: String, config_file: Option<String>, env: Option<String> },
    },
    NotInstalled {
        language: String,
        platform: String,
        install_hint: String,
    },
    VersionMismatch {
        language: String,
        installed: String,
        required: String,
    },
    PlatformUnsupported {
        language: String,
        platform: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolchainValidateInput {
    pub tool: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ToolchainValidateOutput {
    Ok {
        tool: String,
        version: String,
    },
    Invalid {
        tool: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolchainListInput {
    pub language: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ToolchainListOutput {
    Ok {
        tools: Vec<{ language: String, platform: String, category: String, tool_name: Option<String>, version: String, path: String, command: String, status: String }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolchainCapabilitiesInput {
    pub tool: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ToolchainCapabilitiesOutput {
    Ok {
        capabilities: Vec<String>,
    },
}

