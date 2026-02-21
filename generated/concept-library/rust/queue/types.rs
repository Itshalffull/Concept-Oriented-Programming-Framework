// generated: queue/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueueEnqueueInput {
    pub queue: String,
    pub item: String,
    pub priority: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QueueEnqueueOutput {
    Ok {
        item_id: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueueClaimInput {
    pub queue: String,
    pub worker: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QueueClaimOutput {
    Ok {
        item: String,
    },
    Empty {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueueProcessInput {
    pub queue: String,
    pub item_id: String,
    pub result: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QueueProcessOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueueReleaseInput {
    pub queue: String,
    pub item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QueueReleaseOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueueDeleteInput {
    pub queue: String,
    pub item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QueueDeleteOutput {
    Ok,
    Notfound {
        message: String,
    },
}

