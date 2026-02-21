// generated: authentication/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AuthenticationRegisterInput {
    pub user: String,
    pub provider: String,
    pub credentials: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AuthenticationRegisterOutput {
    Ok {
        user: String,
    },
    Exists {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AuthenticationLoginInput {
    pub user: String,
    pub credentials: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AuthenticationLoginOutput {
    Ok {
        token: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AuthenticationLogoutInput {
    pub user: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AuthenticationLogoutOutput {
    Ok {
        user: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AuthenticationAuthenticateInput {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AuthenticationAuthenticateOutput {
    Ok {
        user: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AuthenticationResetPasswordInput {
    pub user: String,
    pub new_credentials: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AuthenticationResetPasswordOutput {
    Ok {
        user: String,
    },
    Notfound {
        message: String,
    },
}

