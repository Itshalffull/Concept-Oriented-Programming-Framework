// generated: wallet/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WalletVerifyInput {
    pub address: String,
    pub message: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WalletVerifyOutput {
    Ok {
        address: String,
        recovered_address: String,
    },
    Invalid {
        address: String,
        recovered_address: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WalletVerifyTypedDataInput {
    pub address: String,
    pub domain: String,
    pub types: String,
    pub value: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WalletVerifyTypedDataOutput {
    Ok {
        address: String,
    },
    Invalid {
        address: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WalletGetNonceInput {
    pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WalletGetNonceOutput {
    Ok {
        address: String,
        nonce: i64,
    },
    NotFound {
        address: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WalletIncrementNonceInput {
    pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WalletIncrementNonceOutput {
    Ok {
        address: String,
        nonce: i64,
    },
}

