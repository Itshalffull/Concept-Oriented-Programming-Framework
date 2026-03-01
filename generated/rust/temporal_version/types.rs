// generated: temporal_version/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TemporalVersionRecordInput {
    pub content_hash: String,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub metadata: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TemporalVersionRecordOutput {
    Ok {
        version_id: String,
    },
    InvalidHash {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TemporalVersionAsOfInput {
    pub system_time: Option<String>,
    pub valid_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TemporalVersionAsOfOutput {
    Ok {
        version_id: String,
        content_hash: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TemporalVersionBetweenInput {
    pub start: String,
    pub end: String,
    pub dimension: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TemporalVersionBetweenOutput {
    Ok {
        versions: Vec<String>,
    },
    InvalidDimension {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TemporalVersionCurrentInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TemporalVersionCurrentOutput {
    Ok {
        version_id: String,
        content_hash: String,
    },
    Empty {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TemporalVersionSupersedeInput {
    pub version_id: String,
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TemporalVersionSupersedeOutput {
    Ok {
        new_version_id: String,
    },
    NotFound {
        message: String,
    },
}

