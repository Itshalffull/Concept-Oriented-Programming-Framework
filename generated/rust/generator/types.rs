// generated: generator/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GeneratorPlanInput {
    pub kit: String,
    pub interface_manifest: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GeneratorPlanOutput {
    Ok {
        plan: String,
        targets: Vec<String>,
        concepts: Vec<String>,
        estimated_files: i64,
    },
    NoTargetsConfigured {
        kit: String,
    },
    MissingProvider {
        target: String,
    },
    ProjectionFailed {
        concept: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GeneratorGenerateInput {
    pub plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GeneratorGenerateOutput {
    Ok {
        plan: String,
        files_generated: i64,
        files_unchanged: i64,
        duration: i64,
    },
    Partial {
        plan: String,
        generated: Vec<String>,
        failed: Vec<String>,
    },
    Blocked {
        plan: String,
        breaking_changes: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GeneratorRegenerateInput {
    pub plan: String,
    pub targets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GeneratorRegenerateOutput {
    Ok {
        plan: String,
        files_regenerated: i64,
    },
}

