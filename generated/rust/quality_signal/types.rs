// generated: quality_signal/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QualitySignalRecordInput {
    pub target_symbol: String,
    pub dimension: String,
    pub status: String,
    pub severity: String,
    pub summary: Option<String>,
    pub artifact_path: Option<String>,
    pub artifact_hash: Option<String>,
    pub run_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QualitySignalRecordOutput {
    Ok {
        signal: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QualitySignalLatestInput {
    pub target_symbol: String,
    pub dimension: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QualitySignalLatestOutput {
    Ok {
        signal: String,
        status: String,
        severity: String,
        summary: Option<String>,
        observed_at: DateTime<Utc>,
    },
    Notfound {
        target_symbol: String,
        dimension: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QualitySignalRollupInput {
    pub target_symbols: Vec<String>,
    pub dimensions: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QualitySignalRollupOutput {
    Ok {
        results: Vec<{ target: String, status: String, blocking: bool }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QualitySignalExplainInput {
    pub target_symbol: String,
    pub dimensions: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QualitySignalExplainOutput {
    Ok {
        contributors: Vec<{ dimension: String, status: String, severity: String, observed_at: DateTime<Utc>, summary: Option<String>, artifact_path: Option<String>, artifact_hash: Option<String>, run_ref: Option<String> }>,
    },
}
