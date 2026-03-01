// generated: machine/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MachineSpawnInput {
    pub machine: String,
    pub widget: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MachineSpawnOutput {
    Ok {
        machine: String,
    },
    Notfound {
        message: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MachineSendInput {
    pub machine: String,
    pub event: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MachineSendOutput {
    Ok {
        machine: String,
        state: String,
    },
    Invalid {
        message: String,
    },
    Guarded {
        machine: String,
        guard: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MachineConnectInput {
    pub machine: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MachineConnectOutput {
    Ok {
        machine: String,
        props: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MachineDestroyInput {
    pub machine: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MachineDestroyOutput {
    Ok {
        machine: String,
    },
    Notfound {
        message: String,
    },
}

