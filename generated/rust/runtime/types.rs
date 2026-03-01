// generated: runtime/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeProvisionInput {
    pub concept: String,
    pub runtime_type: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeProvisionOutput {
    Ok {
        instance: String,
        endpoint: String,
    },
    AlreadyProvisioned {
        instance: String,
        endpoint: String,
    },
    ProvisionFailed {
        concept: String,
        runtime_type: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeDeployInput {
    pub instance: String,
    pub artifact: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeDeployOutput {
    Ok {
        instance: String,
        endpoint: String,
    },
    DeployFailed {
        instance: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeSetTrafficWeightInput {
    pub instance: String,
    pub weight: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeSetTrafficWeightOutput {
    Ok {
        instance: String,
        new_weight: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeRollbackInput {
    pub instance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeRollbackOutput {
    Ok {
        instance: String,
        previous_version: String,
    },
    NoHistory {
        instance: String,
    },
    RollbackFailed {
        instance: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeDestroyInput {
    pub instance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeDestroyOutput {
    Ok {
        instance: String,
    },
    DestroyFailed {
        instance: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeHealthCheckInput {
    pub instance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeHealthCheckOutput {
    Ok {
        instance: String,
        latency_ms: i64,
    },
    Unreachable {
        instance: String,
    },
    Degraded {
        instance: String,
        latency_ms: i64,
    },
}

