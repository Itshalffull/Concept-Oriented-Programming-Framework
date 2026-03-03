// generated: solver_provider/types.rs

use serde::{Serialize, Deserialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverProviderRegisterInput {
    pub provider_id: String,
    pub supported_languages: Vec<String>,
    pub supported_kinds: Vec<String>,
    pub capabilities: HashSet<String>,
    pub priority: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SolverProviderRegisterOutput {
    Ok {
        provider: String,
    },
    Duplicate {
        provider_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SolverProviderDispatchInput {
    pub property_ref: String,
    pub formal_language: String,
    pub kind: String,
    pub timeout_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SolverProviderDispatchOutput {
    Ok {
        provider: String,
        run_ref: String,
    },
    No_provider {
        formal_language: String,
        kind: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SolverProviderDispatch_batchInput {
    pub properties: Vec<String>,
    pub timeout_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SolverProviderDispatch_batchOutput {
    Ok {
        assignments: Vec<{ property_ref: String, provider: String }>,
    },
    Partial {
        assigned: Vec<String>,
        unassigned: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SolverProviderHealth_checkInput {
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SolverProviderHealth_checkOutput {
    Ok {
        provider: String,
        status: String,
        latency_ms: i64,
    },
    Unavailable {
        provider: String,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SolverProviderListInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SolverProviderListOutput {
    Ok {
        providers: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SolverProviderUnregisterInput {
    pub provider_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SolverProviderUnregisterOutput {
    Ok,
    Notfound {
        provider_id: String,
    },
}
