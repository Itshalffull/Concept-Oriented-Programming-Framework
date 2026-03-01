// generated: contract_test/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContractTestGenerateInput {
    pub concept: String,
    pub spec_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContractTestGenerateOutput {
    Ok {
        contract: String,
        definition: { actions: Vec<{ action_name: String, input_schema: String, output_variants: Vec<String> }> },
    },
    SpecError {
        concept: String,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContractTestVerifyInput {
    pub contract: String,
    pub producer_artifact: String,
    pub producer_language: String,
    pub consumer_artifact: String,
    pub consumer_language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContractTestVerifyOutput {
    Ok {
        contract: String,
        passed: i64,
        total: i64,
    },
    Incompatible {
        contract: String,
        failures: Vec<{ action: String, issue: String, producer_behavior: String, consumer_expectation: String }>,
    },
    ProducerUnavailable {
        language: String,
        reason: String,
    },
    ConsumerUnavailable {
        language: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContractTestMatrixInput {
    pub concepts: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContractTestMatrixOutput {
    Ok {
        matrix: Vec<{ concept: String, pairs: Vec<{ producer: String, consumer: String, status: String, last_verified: Option<DateTime<Utc>> }> }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContractTestCanDeployInput {
    pub concept: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContractTestCanDeployOutput {
    Ok {
        safe: bool,
        verified_against: Vec<String>,
    },
    Unverified {
        missing_pairs: Vec<{ counterpart: String, last_verified: Option<DateTime<Utc>> }>,
    },
}

