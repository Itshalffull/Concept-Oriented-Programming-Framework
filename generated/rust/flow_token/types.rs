// generated: flow_token/types.rs
// Token-based flow control for process execution graph traversal.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlowTokenEmitInput {
    pub run_ref: String,
    pub node_ref: String,
    pub token_type: Option<String>,
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FlowTokenEmitOutput {
    Ok {
        token_id: String,
        run_ref: String,
        node_ref: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlowTokenConsumeInput {
    pub token_id: String,
    pub run_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FlowTokenConsumeOutput {
    Ok {
        token_id: String,
    },
    NotFound {
        token_id: String,
    },
    AlreadyConsumed {
        token_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlowTokenKillInput {
    pub token_id: String,
    pub run_ref: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FlowTokenKillOutput {
    Ok {
        token_id: String,
    },
    NotFound {
        token_id: String,
    },
    AlreadyInactive {
        token_id: String,
        status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlowTokenCountActiveInput {
    pub run_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FlowTokenCountActiveOutput {
    Ok {
        count: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlowTokenListActiveInput {
    pub run_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FlowTokenListActiveOutput {
    Ok {
        tokens: Vec<serde_json::Value>,
    },
}
