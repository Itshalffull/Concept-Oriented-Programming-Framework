// generated: connector/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConnectorConfigureInput {
    pub source_id: String,
    pub protocol_id: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConnectorConfigureOutput {
    Ok {
        connector_id: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConnectorReadInput {
    pub connector_id: String,
    pub query: String,
    pub options: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConnectorReadOutput {
    Ok {
        data: String,
    },
    Notfound {
        message: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConnectorWriteInput {
    pub connector_id: String,
    pub data: String,
    pub options: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConnectorWriteOutput {
    Ok {
        created: i64,
        updated: i64,
        skipped: i64,
        errors: i64,
    },
    Notfound {
        message: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConnectorTestInput {
    pub connector_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConnectorTestOutput {
    Ok {
        message: String,
    },
    Notfound {
        message: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConnectorDiscoverInput {
    pub connector_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConnectorDiscoverOutput {
    Ok {
        streams: String,
    },
    Notfound {
        message: String,
    },
    Error {
        message: String,
    },
}

