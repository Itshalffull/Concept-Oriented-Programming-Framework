// generated: graph/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphAddNodeInput {
    pub graph: String,
    pub node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GraphAddNodeOutput {
    Ok,
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphRemoveNodeInput {
    pub graph: String,
    pub node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GraphRemoveNodeOutput {
    Ok,
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphAddEdgeInput {
    pub graph: String,
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GraphAddEdgeOutput {
    Ok,
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphRemoveEdgeInput {
    pub graph: String,
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GraphRemoveEdgeOutput {
    Ok,
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphComputeLayoutInput {
    pub graph: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GraphComputeLayoutOutput {
    Ok {
        layout: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphGetNeighborsInput {
    pub graph: String,
    pub node: String,
    pub depth: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GraphGetNeighborsOutput {
    Ok {
        neighbors: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphFilterNodesInput {
    pub graph: String,
    pub filter: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GraphFilterNodesOutput {
    Ok {
        filtered: String,
    },
    Notfound,
}

