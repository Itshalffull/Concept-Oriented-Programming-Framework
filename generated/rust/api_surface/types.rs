// generated: api_surface/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApiSurfaceComposeInput {
    pub kit: String,
    pub target: String,
    pub outputs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ApiSurfaceComposeOutput {
    Ok {
        surface: String,
        entrypoint: String,
        concept_count: i64,
    },
    ConflictingRoutes {
        target: String,
        conflicts: Vec<String>,
    },
    CyclicDependency {
        target: String,
        cycle: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApiSurfaceEntrypointInput {
    pub surface: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ApiSurfaceEntrypointOutput {
    Ok {
        content: String,
    },
}

