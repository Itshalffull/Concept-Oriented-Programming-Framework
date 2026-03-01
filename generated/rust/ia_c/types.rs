// generated: ia_c/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IaCEmitInput {
    pub plan: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum IaCEmitOutput {
    Ok {
        output: String,
        file_count: i64,
    },
    UnsupportedResource {
        resource: String,
        provider: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IaCPreviewInput {
    pub plan: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum IaCPreviewOutput {
    Ok {
        to_create: Vec<String>,
        to_update: Vec<String>,
        to_delete: Vec<String>,
        estimated_monthly_cost: f64,
    },
    StateCorrupted {
        provider: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IaCApplyInput {
    pub plan: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum IaCApplyOutput {
    Ok {
        created: Vec<String>,
        updated: Vec<String>,
        deleted: Vec<String>,
    },
    Partial {
        created: Vec<String>,
        failed: Vec<String>,
        reason: String,
    },
    ApplyFailed {
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IaCDetectDriftInput {
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum IaCDetectDriftOutput {
    Ok {
        drifted: Vec<String>,
        clean: Vec<String>,
    },
    NoDrift,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IaCTeardownInput {
    pub plan: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum IaCTeardownOutput {
    Ok {
        destroyed: Vec<String>,
    },
    Partial {
        destroyed: Vec<String>,
        stuck: Vec<String>,
    },
}

