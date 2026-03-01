// generated: local_runtime/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LocalRuntimeProvisionInput {
    pub concept: String,
    pub command: String,
    pub port: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LocalRuntimeProvisionOutput {
    Ok {
        process: String,
        pid: i64,
        endpoint: String,
    },
    PortInUse {
        port: i64,
        existing_pid: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LocalRuntimeDeployInput {
    pub process: String,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LocalRuntimeDeployOutput {
    Ok {
        process: String,
        pid: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LocalRuntimeSetTrafficWeightInput {
    pub process: String,
    pub weight: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LocalRuntimeSetTrafficWeightOutput {
    Ok {
        process: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LocalRuntimeRollbackInput {
    pub process: String,
    pub previous_command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LocalRuntimeRollbackOutput {
    Ok {
        process: String,
        pid: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LocalRuntimeDestroyInput {
    pub process: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LocalRuntimeDestroyOutput {
    Ok {
        process: String,
    },
}

