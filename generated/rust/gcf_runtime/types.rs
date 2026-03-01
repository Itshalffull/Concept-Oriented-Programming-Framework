// generated: gcf_runtime/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GcfRuntimeProvisionInput {
    pub concept: String,
    pub project_id: String,
    pub region: String,
    pub runtime: String,
    pub trigger_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GcfRuntimeProvisionOutput {
    Ok {
        function: String,
        endpoint: String,
    },
    Gen2Required {
        concept: String,
        reason: String,
    },
    TriggerConflict {
        trigger_type: String,
        existing: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GcfRuntimeDeployInput {
    pub function: String,
    pub source_archive: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GcfRuntimeDeployOutput {
    Ok {
        function: String,
        version: String,
    },
    BuildFailed {
        function: String,
        errors: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GcfRuntimeSetTrafficWeightInput {
    pub function: String,
    pub weight: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GcfRuntimeSetTrafficWeightOutput {
    Ok {
        function: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GcfRuntimeRollbackInput {
    pub function: String,
    pub target_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GcfRuntimeRollbackOutput {
    Ok {
        function: String,
        restored_version: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GcfRuntimeDestroyInput {
    pub function: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GcfRuntimeDestroyOutput {
    Ok {
        function: String,
    },
}

