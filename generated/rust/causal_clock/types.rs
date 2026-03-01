// generated: causal_clock/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CausalClockTickInput {
    pub replica_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CausalClockTickOutput {
    Ok {
        timestamp: String,
        clock: Vec<i64>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CausalClockMergeInput {
    pub local_clock: Vec<i64>,
    pub remote_clock: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CausalClockMergeOutput {
    Ok {
        merged: Vec<i64>,
    },
    Incompatible {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CausalClockCompareInput {
    pub a: String,
    pub b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CausalClockCompareOutput {
    Before,
    After,
    Concurrent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CausalClockDominatesInput {
    pub a: String,
    pub b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CausalClockDominatesOutput {
    Ok {
        result: bool,
    },
}

