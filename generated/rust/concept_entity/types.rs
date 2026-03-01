// generated: concept_entity/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConceptEntityRegisterInput {
    pub name: String,
    pub source: String,
    pub ast: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConceptEntityRegisterOutput {
    Ok {
        entity: String,
    },
    AlreadyRegistered {
        existing: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConceptEntityGetInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConceptEntityGetOutput {
    Ok {
        entity: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConceptEntityFindByCapabilityInput {
    pub capability: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConceptEntityFindByCapabilityOutput {
    Ok {
        entities: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConceptEntityFindByKitInput {
    pub kit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConceptEntityFindByKitOutput {
    Ok {
        entities: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConceptEntityGeneratedArtifactsInput {
    pub entity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConceptEntityGeneratedArtifactsOutput {
    Ok {
        artifacts: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConceptEntityParticipatingSyncsInput {
    pub entity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConceptEntityParticipatingSyncsOutput {
    Ok {
        syncs: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConceptEntityCheckCompatibilityInput {
    pub a: String,
    pub b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConceptEntityCheckCompatibilityOutput {
    Compatible {
        shared_type_params: String,
    },
    Incompatible {
        reason: String,
    },
}

