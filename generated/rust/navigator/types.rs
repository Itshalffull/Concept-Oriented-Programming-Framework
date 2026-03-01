// generated: navigator/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NavigatorRegisterInput {
    pub nav: String,
    pub name: String,
    pub target_concept: String,
    pub target_view: String,
    pub params_schema: Option<String>,
    pub meta: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum NavigatorRegisterOutput {
    Ok {
        nav: String,
    },
    Duplicate {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NavigatorGoInput {
    pub nav: String,
    pub params: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum NavigatorGoOutput {
    Ok {
        nav: String,
        previous: Option<String>,
    },
    Blocked {
        nav: String,
        reason: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NavigatorBackInput {
    pub nav: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum NavigatorBackOutput {
    Ok {
        nav: String,
        previous: String,
    },
    Empty {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NavigatorForwardInput {
    pub nav: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum NavigatorForwardOutput {
    Ok {
        nav: String,
        previous: String,
    },
    Empty {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NavigatorReplaceInput {
    pub nav: String,
    pub params: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum NavigatorReplaceOutput {
    Ok {
        nav: String,
        previous: Option<String>,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NavigatorAddGuardInput {
    pub nav: String,
    pub guard: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum NavigatorAddGuardOutput {
    Ok {
        nav: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NavigatorRemoveGuardInput {
    pub nav: String,
    pub guard: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum NavigatorRemoveGuardOutput {
    Ok {
        nav: String,
    },
    Notfound {
        message: String,
    },
}

