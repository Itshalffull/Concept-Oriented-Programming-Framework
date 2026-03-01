// generated: chain_monitor/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChainMonitorAwaitFinalityInput {
    pub tx_hash: String,
    pub level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ChainMonitorAwaitFinalityOutput {
    Ok {
        chain: String,
        block: i64,
        confirmations: i64,
    },
    Reorged {
        tx_hash: String,
        depth: i64,
    },
    Timeout {
        tx_hash: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChainMonitorSubscribeInput {
    pub chain_id: i64,
    pub rpc_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ChainMonitorSubscribeOutput {
    Ok {
        chain_id: i64,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChainMonitorOnBlockInput {
    pub chain_id: i64,
    pub block_number: i64,
    pub block_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ChainMonitorOnBlockOutput {
    Ok {
        chain_id: i64,
        block_number: i64,
    },
    Reorg {
        chain_id: i64,
        depth: i64,
        from_block: i64,
    },
}

