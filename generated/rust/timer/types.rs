// generated: timer/types.rs
// Time-based triggers for process execution: absolute dates, durations, recurring cycles.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimerSetTimerInput {
    pub run_ref: String,
    pub timer_type: String,
    pub specification: String,
    pub purpose_tag: String,
    pub context_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TimerSetTimerOutput {
    Ok {
        timer_id: String,
        run_ref: String,
        next_fire_at: String,
    },
    InvalidSpec {
        specification: String,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimerFireInput {
    pub timer_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TimerFireOutput {
    Ok {
        timer_id: String,
        run_ref: String,
        purpose_tag: String,
        context_ref: Option<String>,
        fire_count: i64,
    },
    NotActive {
        timer_id: String,
        current_status: String,
    },
    NotFound {
        timer_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimerCancelInput {
    pub timer_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TimerCancelOutput {
    Ok {
        timer_id: String,
    },
    NotActive {
        timer_id: String,
        current_status: String,
    },
    NotFound {
        timer_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimerResetInput {
    pub timer_id: String,
    pub specification: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TimerResetOutput {
    Ok {
        timer_id: String,
        next_fire_at: String,
    },
    NotFound {
        timer_id: String,
    },
}
