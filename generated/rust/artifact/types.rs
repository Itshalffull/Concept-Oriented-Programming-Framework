// generated: artifact/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArtifactBuildInput {
    pub concept: String,
    pub spec: String,
    pub implementation: String,
    pub deps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArtifactBuildOutput {
    Ok {
        artifact: String,
        hash: String,
        size_bytes: i64,
    },
    CompilationError {
        concept: String,
        errors: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArtifactStoreInput {
    pub hash: String,
    pub location: String,
    pub concept: String,
    pub language: String,
    pub platform: String,
    pub metadata: Option<{ toolchain_version: String, build_mode: String, duration: i64 }>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArtifactStoreOutput {
    Ok {
        artifact: String,
    },
    AlreadyExists {
        artifact: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArtifactResolveInput {
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArtifactResolveOutput {
    Ok {
        artifact: String,
        location: String,
    },
    Notfound {
        hash: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArtifactGcInput {
    pub older_than: DateTime<Utc>,
    pub keep_versions: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArtifactGcOutput {
    Ok {
        removed: i64,
        freed_bytes: i64,
    },
}

