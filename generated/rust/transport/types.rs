// generated: transport/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TransportConfigureInput {
    pub transport: String,
    pub kind: String,
    pub base_url: Option<String>,
    pub auth: Option<String>,
    pub retry_policy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TransportConfigureOutput {
    Ok {
        transport: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TransportFetchInput {
    pub transport: String,
    pub query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TransportFetchOutput {
    Ok {
        transport: String,
        data: String,
    },
    Cached {
        transport: String,
        data: String,
        age: i64,
    },
    Error {
        transport: String,
        status: i64,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TransportMutateInput {
    pub transport: String,
    pub action: String,
    pub input: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TransportMutateOutput {
    Ok {
        transport: String,
        result: String,
    },
    Queued {
        transport: String,
        queue_position: i64,
    },
    Error {
        transport: String,
        status: i64,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TransportFlushQueueInput {
    pub transport: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TransportFlushQueueOutput {
    Ok {
        transport: String,
        flushed: i64,
    },
    Partial {
        transport: String,
        sent: i64,
        failed: i64,
    },
}

