// generated: verification_run/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VerificationRunStartInput {
    pub target_symbol: String,
    pub properties: Vec<String>,
    pub solver: String,
    pub timeout_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VerificationRunStartOutput {
    Ok {
        run: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VerificationRunCompleteInput {
    pub run: String,
    pub results: Vec<u8>,
    pub resource_usage: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VerificationRunCompleteOutput {
    Ok {
        run: String,
        proved: i64,
        refuted: i64,
        unknown: i64,
    },
    Notfound {
        run: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VerificationRunTimeoutInput {
    pub run: String,
    pub partial_results: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VerificationRunTimeoutOutput {
    Ok {
        run: String,
        completed_count: i64,
        remaining_count: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VerificationRunCancelInput {
    pub run: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VerificationRunCancelOutput {
    Ok {
        run: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VerificationRunGet_statusInput {
    pub run: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VerificationRunGet_statusOutput {
    Ok {
        run: String,
        status: String,
        progress: f64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VerificationRunCompareInput {
    pub run1: String,
    pub run2: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VerificationRunCompareOutput {
    Ok {
        regressions: Vec<String>,
        improvements: Vec<String>,
        unchanged: Vec<String>,
    },
}
