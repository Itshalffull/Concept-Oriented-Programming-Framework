// generated: projection/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectionProjectInput {
    pub manifest: String,
    pub annotations: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProjectionProjectOutput {
    Ok {
        projection: String,
        shapes: i64,
        actions: i64,
        traits: i64,
    },
    AnnotationError {
        concept: String,
        errors: Vec<String>,
    },
    UnresolvedReference {
        concept: String,
        missing: Vec<String>,
    },
    TraitConflict {
        concept: String,
        trait1: String,
        trait2: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectionValidateInput {
    pub projection: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProjectionValidateOutput {
    Ok {
        projection: String,
        warnings: Vec<String>,
    },
    BreakingChange {
        projection: String,
        changes: Vec<String>,
    },
    IncompleteAnnotation {
        projection: String,
        missing: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectionDiffInput {
    pub projection: String,
    pub previous: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProjectionDiffOutput {
    Ok {
        added: Vec<String>,
        removed: Vec<String>,
        changed: Vec<String>,
    },
    Incompatible {
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectionInferResourcesInput {
    pub projection: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProjectionInferResourcesOutput {
    Ok {
        projection: String,
        resources: Vec<String>,
    },
}

