// generated: grpc_target/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GrpcTargetGenerateInput {
    pub projection: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GrpcTargetGenerateOutput {
    Ok {
        services: Vec<String>,
        files: Vec<String>,
    },
    ProtoIncompatible {
        type: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GrpcTargetValidateInput {
    pub service: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GrpcTargetValidateOutput {
    Ok {
        service: String,
    },
    FieldNumberConflict {
        service: String,
        message: String,
        field: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GrpcTargetListRpcsInput {
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GrpcTargetListRpcsOutput {
    Ok {
        rpcs: Vec<String>,
        streaming_modes: Vec<String>,
    },
}

