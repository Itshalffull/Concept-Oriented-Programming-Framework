// generated: j_w_t/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JWTGenerateInput {
    pub user: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum JWTGenerateOutput {
    Ok {
        token: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JWTVerifyInput {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum JWTVerifyOutput {
    Ok {
        user: String,
    },
    Error {
        message: String,
    },
}

