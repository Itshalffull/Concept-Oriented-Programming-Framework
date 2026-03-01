// generated: attribution/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AttributionAttributeInput {
    pub content_ref: String,
    pub region: Vec<u8>,
    pub agent: String,
    pub change_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AttributionAttributeOutput {
    Ok {
        attribution_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AttributionBlameInput {
    pub content_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AttributionBlameOutput {
    Ok {
        map: Vec<{ region: Vec<u8>, agent: String, change_ref: String }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AttributionHistoryInput {
    pub content_ref: String,
    pub region: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AttributionHistoryOutput {
    Ok {
        chain: Vec<String>,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AttributionSetOwnershipInput {
    pub pattern: String,
    pub owners: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AttributionSetOwnershipOutput {
    Ok,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AttributionQueryOwnersInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AttributionQueryOwnersOutput {
    Ok {
        owners: Vec<String>,
    },
    NoMatch {
        message: String,
    },
}

