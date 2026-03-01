// generated: signature/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SignatureSignInput {
    pub content_hash: String,
    pub identity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SignatureSignOutput {
    Ok {
        signature_id: String,
    },
    UnknownIdentity {
        message: String,
    },
    HashNotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SignatureVerifyInput {
    pub content_hash: String,
    pub signature_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SignatureVerifyOutput {
    Valid {
        identity: String,
        timestamp: String,
    },
    Invalid {
        message: String,
    },
    Expired {
        message: String,
    },
    UntrustedSigner {
        signer: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SignatureTimestampInput {
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SignatureTimestampOutput {
    Ok {
        proof: Vec<u8>,
    },
    Unavailable {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SignatureAddTrustedSignerInput {
    pub identity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SignatureAddTrustedSignerOutput {
    Ok,
    AlreadyTrusted {
        message: String,
    },
}

