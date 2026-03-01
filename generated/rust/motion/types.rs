// generated: motion/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotionDefineDurationInput {
    pub motion: String,
    pub name: String,
    pub ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MotionDefineDurationOutput {
    Ok {
        motion: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotionDefineEasingInput {
    pub motion: String,
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MotionDefineEasingOutput {
    Ok {
        motion: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotionDefineTransitionInput {
    pub motion: String,
    pub name: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MotionDefineTransitionOutput {
    Ok {
        motion: String,
    },
    Invalid {
        message: String,
    },
}

