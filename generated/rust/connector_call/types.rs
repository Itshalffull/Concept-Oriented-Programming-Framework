// ConnectorCall concept types
// Models external connector invocations: invoke, mark_success, mark_failure, get_result.

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConnectorCallInvokeInput {
    pub connector: String,
    pub action: String,
    pub payload: String,
    pub timeout_ms: Option<i64>,
    pub correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConnectorCallInvokeOutput {
    Ok {
        call_id: String,
        status: String,
    },
    ValidationError {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConnectorCallMarkSuccessInput {
    pub call_id: String,
    pub response: String,
    pub status_code: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConnectorCallMarkSuccessOutput {
    Ok {
        call_id: String,
        status: String,
    },
    AlreadyCompleted {
        call_id: String,
        current_status: String,
    },
    NotFound {
        call_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConnectorCallMarkFailureInput {
    pub call_id: String,
    pub error: String,
    pub error_code: Option<String>,
    pub retryable: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConnectorCallMarkFailureOutput {
    Ok {
        call_id: String,
        status: String,
    },
    AlreadyCompleted {
        call_id: String,
        current_status: String,
    },
    NotFound {
        call_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConnectorCallGetResultInput {
    pub call_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConnectorCallGetResultOutput {
    Ok {
        call_id: String,
        status: String,
        connector: String,
        response: Option<String>,
        error: Option<String>,
        duration_ms: i64,
    },
    NotFound {
        call_id: String,
    },
}
