// generated: data_flow_path/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DataFlowPathTraceInput {
    pub source: String,
    pub sink: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DataFlowPathTraceOutput {
    Ok {
        paths: String,
    },
    NoPath,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DataFlowPathTraceFromConfigInput {
    pub config_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DataFlowPathTraceFromConfigOutput {
    Ok {
        paths: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DataFlowPathTraceToOutputInput {
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DataFlowPathTraceToOutputOutput {
    Ok {
        paths: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DataFlowPathGetInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DataFlowPathGetOutput {
    Ok {
        path: String,
        source_symbol: String,
        sink_symbol: String,
        path_kind: String,
        step_count: i64,
    },
    Notfound,
}

