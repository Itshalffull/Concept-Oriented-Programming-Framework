// generated: dependence_graph/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DependenceGraphComputeInput {
    pub scope_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DependenceGraphComputeOutput {
    Ok {
        graph: String,
    },
    UnsupportedLanguage {
        language: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DependenceGraphQueryDependentsInput {
    pub symbol: String,
    pub edge_kinds: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DependenceGraphQueryDependentsOutput {
    Ok {
        dependents: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DependenceGraphQueryDependenciesInput {
    pub symbol: String,
    pub edge_kinds: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DependenceGraphQueryDependenciesOutput {
    Ok {
        dependencies: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DependenceGraphSliceForwardInput {
    pub criterion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DependenceGraphSliceForwardOutput {
    Ok {
        slice: String,
        edges: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DependenceGraphSliceBackwardInput {
    pub criterion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DependenceGraphSliceBackwardOutput {
    Ok {
        slice: String,
        edges: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DependenceGraphImpactAnalysisInput {
    pub changed: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DependenceGraphImpactAnalysisOutput {
    Ok {
        affected: String,
        paths: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DependenceGraphGetInput {
    pub graph: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DependenceGraphGetOutput {
    Ok {
        graph: String,
        scope: String,
        node_count: i64,
        edge_count: i64,
    },
    Notfound,
}

