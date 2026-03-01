// generated: conformance/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConformanceGenerateInput {
    pub concept: String,
    pub spec_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConformanceGenerateOutput {
    Ok {
        suite: String,
        test_vectors: Vec<{ id: String, description: String, input: String, expected_output: String }>,
    },
    SpecError {
        concept: String,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConformanceVerifyInput {
    pub suite: String,
    pub language: String,
    pub artifact_location: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConformanceVerifyOutput {
    Ok {
        passed: i64,
        total: i64,
        covered_requirements: Vec<String>,
    },
    Failure {
        passed: i64,
        failed: i64,
        failures: Vec<{ test_id: String, requirement: String, expected: String, actual: String }>,
    },
    DeviationDetected {
        requirement: String,
        language: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConformanceRegisterDeviationInput {
    pub concept: String,
    pub language: String,
    pub requirement: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConformanceRegisterDeviationOutput {
    Ok {
        suite: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConformanceMatrixInput {
    pub concepts: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConformanceMatrixOutput {
    Ok {
        matrix: Vec<{ concept: String, targets: Vec<{ language: String, conformance: String, covered: i64, total: i64, deviations: i64 }> }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConformanceTraceabilityInput {
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConformanceTraceabilityOutput {
    Ok {
        requirements: Vec<{ id: String, description: String, tested_by: Vec<{ language: String, test_id: String, status: String }> }>,
    },
}

