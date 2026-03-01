// generated: process_spec/types.rs
// Process specification definition and lifecycle management.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessSpecCreateInput {
    pub name: String,
    pub version: String,
    pub steps: Vec<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessSpecCreateOutput {
    Ok {
        spec_ref: String,
        name: String,
        version: String,
    },
    AlreadyExists {
        name: String,
        version: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessSpecPublishInput {
    pub spec_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessSpecPublishOutput {
    Ok {
        spec_ref: String,
        status: String,
    },
    NotFound {
        spec_ref: String,
    },
    InvalidTransition {
        spec_ref: String,
        current_status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessSpecDeprecateInput {
    pub spec_ref: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessSpecDeprecateOutput {
    Ok {
        spec_ref: String,
        status: String,
    },
    NotFound {
        spec_ref: String,
    },
    InvalidTransition {
        spec_ref: String,
        current_status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessSpecUpdateInput {
    pub spec_ref: String,
    pub steps: Option<Vec<serde_json::Value>>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessSpecUpdateOutput {
    Ok {
        spec_ref: String,
    },
    NotFound {
        spec_ref: String,
    },
    NotEditable {
        spec_ref: String,
        status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessSpecGetInput {
    pub spec_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessSpecGetOutput {
    Ok {
        spec_ref: String,
        name: String,
        version: String,
        status: String,
        steps: Vec<serde_json::Value>,
        metadata: serde_json::Value,
    },
    NotFound {
        spec_ref: String,
    },
}
