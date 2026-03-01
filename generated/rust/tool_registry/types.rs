// generated: tool_registry/types.rs
// Tool schema registration, versioning, and authorization for LLM function/tool calling.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolRegistryRegisterInput {
    pub name: String,
    pub description: String,
    pub schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ToolRegistryRegisterOutput {
    Ok {
        tool_id: String,
        version: i64,
    },
    InvalidSchema {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolRegistryDeprecateInput {
    pub tool_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ToolRegistryDeprecateOutput {
    Ok { tool_id: String },
    NotFound { tool_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolRegistryDisableInput {
    pub tool_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ToolRegistryDisableOutput {
    Ok { tool_id: String },
    NotFound { tool_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolRegistryAuthorizeInput {
    pub tool_id: String,
    pub model: String,
    pub process_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ToolRegistryAuthorizeOutput {
    Ok { tool_id: String },
    NotFound { tool_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolRegistryCheckAccessInput {
    pub tool_id: String,
    pub model: String,
    pub process_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ToolRegistryCheckAccessOutput {
    Allowed {
        tool_id: String,
        schema: serde_json::Value,
    },
    Denied {
        tool_id: String,
        reason: String,
    },
    NotFound {
        tool_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolRegistryListActiveInput {
    pub process_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ToolRegistryListActiveOutput {
    Ok {
        tools: Vec<serde_json::Value>,
    },
}
