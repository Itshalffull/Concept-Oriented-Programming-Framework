// generated: d_a_g_history/types.rs

use serde::{Serialize, Deserialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DAGHistoryAppendInput {
    pub parents: HashSet<String>,
    pub content_ref: String,
    pub metadata: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DAGHistoryAppendOutput {
    Ok {
        node_id: String,
    },
    UnknownParent {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DAGHistoryAncestorsInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DAGHistoryAncestorsOutput {
    Ok {
        nodes: Vec<String>,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DAGHistoryCommonAncestorInput {
    pub a: String,
    pub b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DAGHistoryCommonAncestorOutput {
    Found {
        node_id: String,
    },
    None {
        message: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DAGHistoryDescendantsInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DAGHistoryDescendantsOutput {
    Ok {
        nodes: Vec<String>,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DAGHistoryBetweenInput {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DAGHistoryBetweenOutput {
    Ok {
        path: Vec<String>,
    },
    NoPath {
        message: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DAGHistoryGetNodeInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DAGHistoryGetNodeOutput {
    Ok {
        parents: HashSet<String>,
        content_ref: String,
        metadata: Vec<u8>,
    },
    NotFound {
        message: String,
    },
}

