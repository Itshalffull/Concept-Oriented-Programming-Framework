// generated: telemetry/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TelemetryConfigureInput {
    pub concept: String,
    pub endpoint: String,
    pub sampling_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TelemetryConfigureOutput {
    Ok {
        config: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TelemetryDeployMarkerInput {
    pub kit: String,
    pub version: String,
    pub environment: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TelemetryDeployMarkerOutput {
    Ok {
        marker: String,
    },
    BackendUnavailable {
        endpoint: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TelemetryAnalyzeInput {
    pub concept: String,
    pub window: i64,
    pub criteria: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TelemetryAnalyzeOutput {
    Ok {
        healthy: bool,
        error_rate: f64,
        latency_p99: i64,
        sample_size: i64,
    },
    InsufficientData {
        concept: String,
        samples_found: i64,
        samples_needed: i64,
    },
    BackendUnavailable {
        endpoint: String,
    },
}

