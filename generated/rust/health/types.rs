// generated: health/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HealthCheckConceptInput {
    pub concept: String,
    pub runtime: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum HealthCheckConceptOutput {
    Ok {
        check: String,
        latency_ms: i64,
    },
    Unreachable {
        concept: String,
        transport: String,
    },
    StorageFailed {
        concept: String,
        storage: String,
        reason: String,
    },
    Degraded {
        concept: String,
        latency_ms: i64,
        threshold: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HealthCheckSyncInput {
    pub sync: String,
    pub concepts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum HealthCheckSyncOutput {
    Ok {
        check: String,
        round_trip_ms: i64,
    },
    PartialFailure {
        sync: String,
        failed: Vec<String>,
    },
    Timeout {
        sync: String,
        timeout_ms: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HealthCheckKitInput {
    pub kit: String,
    pub environment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum HealthCheckKitOutput {
    Ok {
        check: String,
        concept_results: Vec<String>,
        sync_results: Vec<String>,
    },
    Degraded {
        check: String,
        healthy: Vec<String>,
        degraded: Vec<String>,
    },
    Failed {
        check: String,
        healthy: Vec<String>,
        failed: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HealthCheckInvariantInput {
    pub concept: String,
    pub invariant: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum HealthCheckInvariantOutput {
    Ok {
        check: String,
    },
    Violated {
        concept: String,
        invariant: String,
        expected: String,
        actual: String,
    },
}

