// generated: field_mapping/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FieldMappingMapInput {
    pub mapping_id: String,
    pub source_field: String,
    pub dest_field: String,
    pub transform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FieldMappingMapOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FieldMappingApplyInput {
    pub record: String,
    pub mapping_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FieldMappingApplyOutput {
    Ok {
        mapped: String,
    },
    Notfound {
        message: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FieldMappingReverseInput {
    pub record: String,
    pub mapping_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FieldMappingReverseOutput {
    Ok {
        reversed: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FieldMappingAutoDiscoverInput {
    pub source_schema: String,
    pub dest_schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FieldMappingAutoDiscoverOutput {
    Ok {
        mapping_id: String,
        suggestions: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FieldMappingValidateInput {
    pub mapping_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FieldMappingValidateOutput {
    Ok {
        warnings: String,
    },
    Notfound {
        message: String,
    },
}

