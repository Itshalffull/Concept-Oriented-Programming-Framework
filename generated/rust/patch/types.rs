// generated: patch/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PatchCreateInput {
    pub base: String,
    pub target: String,
    pub effect: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PatchCreateOutput {
    Ok {
        patch_id: String,
    },
    InvalidEffect {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PatchApplyInput {
    pub patch_id: String,
    pub content: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PatchApplyOutput {
    Ok {
        result: Vec<u8>,
    },
    IncompatibleContext {
        message: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PatchInvertInput {
    pub patch_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PatchInvertOutput {
    Ok {
        inverse_patch_id: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PatchComposeInput {
    pub first: String,
    pub second: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PatchComposeOutput {
    Ok {
        composed_id: String,
    },
    NonSequential {
        message: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PatchCommuteInput {
    pub p1: String,
    pub p2: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PatchCommuteOutput {
    Ok {
        p1_prime: String,
        p2_prime: String,
    },
    CannotCommute {
        message: String,
    },
    NotFound {
        message: String,
    },
}

