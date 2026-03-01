// generated: llm_call/types.rs
// LLM prompt execution with structured output validation, tool calling, and repair loops.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LLMCallRequestInput {
    pub step_ref: String,
    pub model: String,
    pub prompt: serde_json::Value,
    pub output_schema: Option<String>,
    pub max_attempts: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LLMCallRequestOutput {
    Ok {
        call_id: String,
        step_ref: String,
        model: String,
        status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LLMCallRecordResponseInput {
    pub call_id: String,
    pub raw_output: serde_json::Value,
    pub input_tokens: i64,
    pub output_tokens: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LLMCallRecordResponseOutput {
    Ok {
        call_id: String,
        status: String,
    },
    ProviderError {
        call_id: String,
        message: String,
    },
    NotFound {
        call_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LLMCallValidateInput {
    pub call_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LLMCallValidateOutput {
    Valid {
        call_id: String,
        step_ref: String,
        validated_output: serde_json::Value,
    },
    Invalid {
        call_id: String,
        errors: String,
        attempt_count: i64,
        max_attempts: i64,
    },
    NotFound {
        call_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LLMCallRepairInput {
    pub call_id: String,
    pub errors: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LLMCallRepairOutput {
    Ok {
        call_id: String,
        status: String,
    },
    MaxAttemptsReached {
        call_id: String,
        step_ref: String,
    },
    NotFound {
        call_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LLMCallAcceptInput {
    pub call_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LLMCallAcceptOutput {
    Ok {
        call_id: String,
        step_ref: String,
        output: serde_json::Value,
    },
    NotFound {
        call_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LLMCallRejectInput {
    pub call_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LLMCallRejectOutput {
    Ok {
        call_id: String,
        step_ref: String,
        reason: String,
    },
    NotFound {
        call_id: String,
    },
}
