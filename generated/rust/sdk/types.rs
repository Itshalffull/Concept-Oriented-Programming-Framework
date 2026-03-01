// generated: sdk/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SdkGenerateInput {
    pub projection: String,
    pub language: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SdkGenerateOutput {
    Ok {
        package: String,
        files: Vec<String>,
        package_json: String,
    },
    UnsupportedType {
        type_name: String,
        language: String,
    },
    LanguageError {
        language: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SdkPublishInput {
    pub package: String,
    pub registry: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SdkPublishOutput {
    Ok {
        package: String,
        published_version: String,
    },
    VersionExists {
        package: String,
        version: String,
    },
    RegistryUnavailable {
        registry: String,
    },
}

