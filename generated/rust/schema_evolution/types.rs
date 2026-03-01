// generated: schema_evolution/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SchemaEvolutionRegisterInput {
    pub subject: String,
    pub schema: Vec<u8>,
    pub compatibility: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SchemaEvolutionRegisterOutput {
    Ok {
        version: i64,
        schema_id: String,
    },
    Incompatible {
        reasons: Vec<String>,
    },
    InvalidCompatibility {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SchemaEvolutionCheckInput {
    pub old_schema: Vec<u8>,
    pub new_schema: Vec<u8>,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SchemaEvolutionCheckOutput {
    Compatible,
    Incompatible {
        reasons: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SchemaEvolutionUpcastInput {
    pub data: Vec<u8>,
    pub from_version: i64,
    pub to_version: i64,
    pub subject: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SchemaEvolutionUpcastOutput {
    Ok {
        transformed: Vec<u8>,
    },
    NoPath {
        message: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SchemaEvolutionResolveInput {
    pub reader_schema: Vec<u8>,
    pub writer_schema: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SchemaEvolutionResolveOutput {
    Ok {
        resolved: Vec<u8>,
    },
    Incompatible {
        reasons: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SchemaEvolutionGetSchemaInput {
    pub subject: String,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SchemaEvolutionGetSchemaOutput {
    Ok {
        schema: Vec<u8>,
        compatibility: String,
    },
    NotFound {
        message: String,
    },
}

