// Approval concept types
// Models approval workflows: request, approve, deny, request_changes, timeout, get_status.

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApprovalRequestInput {
    pub subject: String,
    pub requester: String,
    pub approvers: Vec<String>,
    pub description: String,
    pub timeout_seconds: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ApprovalRequestOutput {
    Ok {
        approval_id: String,
        status: String,
    },
    ValidationError {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApprovalApproveInput {
    pub approval_id: String,
    pub approver: String,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ApprovalApproveOutput {
    Ok {
        approval_id: String,
        status: String,
    },
    NotAuthorized {
        approval_id: String,
        message: String,
    },
    AlreadyResolved {
        approval_id: String,
        current_status: String,
    },
    NotFound {
        approval_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApprovalDenyInput {
    pub approval_id: String,
    pub approver: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ApprovalDenyOutput {
    Ok {
        approval_id: String,
        status: String,
    },
    NotAuthorized {
        approval_id: String,
        message: String,
    },
    AlreadyResolved {
        approval_id: String,
        current_status: String,
    },
    NotFound {
        approval_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApprovalRequestChangesInput {
    pub approval_id: String,
    pub approver: String,
    pub requested_changes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ApprovalRequestChangesOutput {
    Ok {
        approval_id: String,
        status: String,
    },
    NotAuthorized {
        approval_id: String,
        message: String,
    },
    AlreadyResolved {
        approval_id: String,
        current_status: String,
    },
    NotFound {
        approval_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApprovalTimeoutInput {
    pub approval_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ApprovalTimeoutOutput {
    Ok {
        approval_id: String,
        status: String,
    },
    AlreadyResolved {
        approval_id: String,
        current_status: String,
    },
    NotFound {
        approval_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApprovalGetStatusInput {
    pub approval_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ApprovalGetStatusOutput {
    Ok {
        approval_id: String,
        status: String,
        approvers: String,
        decisions: String,
    },
    NotFound {
        approval_id: String,
    },
}
