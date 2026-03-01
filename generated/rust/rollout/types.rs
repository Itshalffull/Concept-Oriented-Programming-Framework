// generated: rollout/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RolloutBeginInput {
    pub plan: String,
    pub strategy: String,
    pub steps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RolloutBeginOutput {
    Ok {
        rollout: String,
    },
    InvalidStrategy {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RolloutAdvanceInput {
    pub rollout: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RolloutAdvanceOutput {
    Ok {
        rollout: String,
        new_weight: i64,
        step: i64,
    },
    Complete {
        rollout: String,
    },
    Paused {
        rollout: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RolloutPauseInput {
    pub rollout: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RolloutPauseOutput {
    Ok {
        rollout: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RolloutResumeInput {
    pub rollout: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RolloutResumeOutput {
    Ok {
        rollout: String,
        current_weight: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RolloutAbortInput {
    pub rollout: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RolloutAbortOutput {
    Ok {
        rollout: String,
    },
    AlreadyComplete {
        rollout: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RolloutStatusInput {
    pub rollout: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RolloutStatusOutput {
    Ok {
        rollout: String,
        step: i64,
        weight: i64,
        status: String,
        elapsed: i64,
    },
}

