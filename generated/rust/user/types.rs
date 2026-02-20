// generated: user/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UserRegisterInput {
    pub user: String,
    pub name: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum UserRegisterOutput {
    Ok {
        user: String,
    },
    Error {
        message: String,
    },
}

