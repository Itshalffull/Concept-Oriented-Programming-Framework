// generated: machine_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MachineProviderInitializeInput {
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MachineProviderInitializeOutput {
    Ok {
        instance: String,
        plugin_ref: String,
    },
    ConfigError {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MachineProviderSpawnInput {
    pub machine_def: String,
    pub initial_state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MachineProviderSpawnOutput {
    Ok {
        machine_id: String,
        state: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MachineProviderSendInput {
    pub machine_id: String,
    pub event: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MachineProviderSendOutput {
    Ok {
        machine_id: String,
        state: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MachineProviderConnectInput {
    pub source_id: String,
    pub target_id: String,
    pub on_event: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MachineProviderConnectOutput {
    Ok {
        connection_id: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MachineProviderDestroyInput {
    pub machine_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MachineProviderDestroyOutput {
    Ok {
        machine_id: String,
    },
    NotFound {
        message: String,
    },
}
