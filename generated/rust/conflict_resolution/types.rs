// generated: conflict_resolution/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConflictResolutionRegisterPolicyInput {
    pub name: String,
    pub priority: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConflictResolutionRegisterPolicyOutput {
    Ok {
        policy: serde_json::Value,
    },
    Duplicate {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConflictResolutionDetectInput {
    pub base: Option<String>,
    pub version1: String,
    pub version2: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConflictResolutionDetectOutput {
    NoConflict,
    Detected {
        conflict_id: serde_json::Value,
        detail: Vec<u8>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConflictResolutionResolveInput {
    pub conflict_id: serde_json::Value,
    pub policy_override: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConflictResolutionResolveOutput {
    Resolved {
        result: String,
    },
    RequiresHuman {
        conflict_id: serde_json::Value,
        options: Vec<Vec<u8>>,
    },
    NoPolicy {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConflictResolutionManualResolveInput {
    pub conflict_id: serde_json::Value,
    pub chosen: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConflictResolutionManualResolveOutput {
    Ok {
        result: String,
    },
    NotPending {
        message: String,
    },
}

