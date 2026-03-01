// generated: signal/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SignalCreateInput {
    pub signal: String,
    pub kind: String,
    pub initial_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SignalCreateOutput {
    Ok {
        signal: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SignalReadInput {
    pub signal: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SignalReadOutput {
    Ok {
        signal: String,
        value: String,
        version: i64,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SignalWriteInput {
    pub signal: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SignalWriteOutput {
    Ok {
        signal: String,
        version: i64,
    },
    Readonly {
        message: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SignalBatchInput {
    pub signals: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SignalBatchOutput {
    Ok {
        count: i64,
    },
    Partial {
        message: String,
        succeeded: i64,
        failed: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SignalDisposeInput {
    pub signal: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SignalDisposeOutput {
    Ok {
        signal: String,
    },
    Notfound {
        message: String,
    },
}

