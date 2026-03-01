// generated: file_artifact/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FileArtifactRegisterInput {
    pub node: String,
    pub role: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FileArtifactRegisterOutput {
    Ok {
        artifact: String,
    },
    AlreadyRegistered {
        existing: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FileArtifactSetProvenanceInput {
    pub artifact: String,
    pub spec: String,
    pub generator: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FileArtifactSetProvenanceOutput {
    Ok,
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FileArtifactFindByRoleInput {
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FileArtifactFindByRoleOutput {
    Ok {
        artifacts: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FileArtifactFindGeneratedFromInput {
    pub spec: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FileArtifactFindGeneratedFromOutput {
    Ok {
        artifacts: String,
    },
    NoGeneratedFiles,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FileArtifactGetInput {
    pub artifact: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FileArtifactGetOutput {
    Ok {
        artifact: String,
        node: String,
        role: String,
        language: String,
        encoding: String,
    },
    Notfound {
        message: String,
    },
}

