// generated: change_stream/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChangeStreamAppendInput {
    pub type: String,
    pub before: Option<Vec<u8>>,
    pub after: Option<Vec<u8>>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ChangeStreamAppendOutput {
    Ok {
        offset: i64,
        event_id: String,
    },
    InvalidType {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChangeStreamSubscribeInput {
    pub from_offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ChangeStreamSubscribeOutput {
    Ok {
        subscription_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChangeStreamReadInput {
    pub subscription_id: String,
    pub max_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ChangeStreamReadOutput {
    Ok {
        events: Vec<String>,
    },
    NotFound {
        message: String,
    },
    EndOfStream,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChangeStreamAcknowledgeInput {
    pub consumer: String,
    pub offset: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ChangeStreamAcknowledgeOutput {
    Ok,
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChangeStreamReplayInput {
    pub from: i64,
    pub to: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ChangeStreamReplayOutput {
    Ok {
        events: Vec<String>,
    },
    InvalidRange {
        message: String,
    },
}

