// generated: replica/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplicaLocalUpdateInput {
    pub op: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ReplicaLocalUpdateOutput {
    Ok {
        new_state: Vec<u8>,
    },
    InvalidOp {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplicaReceiveRemoteInput {
    pub op: Vec<u8>,
    pub from_replica: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ReplicaReceiveRemoteOutput {
    Ok {
        new_state: Vec<u8>,
    },
    Conflict {
        details: Vec<u8>,
    },
    UnknownReplica {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplicaSyncInput {
    pub peer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ReplicaSyncOutput {
    Ok,
    Unreachable {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplicaGetStateInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ReplicaGetStateOutput {
    Ok {
        state: Vec<u8>,
        clock: Vec<u8>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplicaForkInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ReplicaForkOutput {
    Ok {
        new_replica_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplicaAddPeerInput {
    pub peer_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ReplicaAddPeerOutput {
    Ok,
    AlreadyKnown {
        message: String,
    },
}

