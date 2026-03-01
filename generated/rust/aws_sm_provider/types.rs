// generated: aws_sm_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AwsSmProviderFetchInput {
    pub secret_id: String,
    pub version_stage: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AwsSmProviderFetchOutput {
    Ok {
        value: String,
        version_id: String,
        arn: String,
    },
    KmsKeyInaccessible {
        secret_id: String,
        kms_key_id: String,
    },
    ResourceNotFound {
        secret_id: String,
    },
    DecryptionFailed {
        secret_id: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AwsSmProviderRotateInput {
    pub secret_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AwsSmProviderRotateOutput {
    Ok {
        secret_id: String,
        new_version_id: String,
    },
    RotationInProgress {
        secret_id: String,
    },
}

