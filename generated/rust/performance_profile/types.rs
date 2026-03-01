// generated: performance_profile/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PerformanceProfileAggregateInput {
    pub symbol: String,
    pub window: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PerformanceProfileAggregateOutput {
    Ok {
        profile: String,
    },
    InsufficientData {
        count: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PerformanceProfileHotspotsInput {
    pub kind: String,
    pub metric: String,
    pub top_n: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PerformanceProfileHotspotsOutput {
    Ok {
        hotspots: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PerformanceProfileSlowChainsInput {
    pub threshold_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PerformanceProfileSlowChainsOutput {
    Ok {
        chains: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PerformanceProfileCompareWindowsInput {
    pub symbol: String,
    pub window_a: String,
    pub window_b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PerformanceProfileCompareWindowsOutput {
    Ok {
        comparison: String,
    },
    InsufficientData {
        window: String,
        count: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PerformanceProfileGetInput {
    pub profile: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PerformanceProfileGetOutput {
    Ok {
        profile: String,
        entity_symbol: String,
        entity_kind: String,
        invocation_count: i64,
        error_rate: String,
    },
    Notfound,
}

