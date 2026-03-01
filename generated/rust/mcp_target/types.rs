// generated: mcp_target/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct McpTargetGenerateInput {
    pub projection: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum McpTargetGenerateOutput {
    Ok {
        tools: Vec<String>,
        files: Vec<String>,
    },
    TooManyTools {
        count: i64,
        limit: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct McpTargetValidateInput {
    pub tool: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum McpTargetValidateOutput {
    Ok {
        tool: String,
    },
    MissingDescription {
        tool: String,
        tool_name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct McpTargetListToolsInput {
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum McpTargetListToolsOutput {
    Ok {
        tools: Vec<String>,
        resources: Vec<String>,
        templates: Vec<String>,
    },
}

