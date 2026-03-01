// generated: error_correlation/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ErrorCorrelationRecordInput {
    pub flow_id: String,
    pub error_kind: String,
    pub message: String,
    pub raw_event: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ErrorCorrelationRecordOutput {
    Ok {
        error: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ErrorCorrelationFindByEntityInput {
    pub symbol: String,
    pub since: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ErrorCorrelationFindByEntityOutput {
    Ok {
        errors: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ErrorCorrelationFindByKindInput {
    pub error_kind: String,
    pub since: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ErrorCorrelationFindByKindOutput {
    Ok {
        errors: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ErrorCorrelationErrorHotspotsInput {
    pub since: String,
    pub top_n: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ErrorCorrelationErrorHotspotsOutput {
    Ok {
        hotspots: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ErrorCorrelationRootCauseInput {
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ErrorCorrelationRootCauseOutput {
    Ok {
        chain: String,
        likely_cause: String,
        source: String,
    },
    Inconclusive {
        partial_chain: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ErrorCorrelationGetInput {
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ErrorCorrelationGetOutput {
    Ok {
        error: String,
        flow_id: String,
        error_kind: String,
        error_message: String,
        timestamp: String,
    },
    Notfound,
}

