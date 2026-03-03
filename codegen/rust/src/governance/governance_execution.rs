// Governance Execution Suite — Rust Stubs
//
// Concepts: Execution, Timelock, Guard, FinalityGate, RageQuit

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ══════════════════════════════════════════════════════════════
//  Execution
// ══════════════════════════════════════════════════════════════

// --- schedule ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionScheduleInput {
    pub proposal_id: String,
    pub actions: String,
    pub execute_after: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ExecutionScheduleOutput {
    #[serde(rename = "ok")]
    Ok { execution_id: String, scheduled_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- execute ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionExecuteInput {
    pub execution_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ExecutionExecuteOutput {
    #[serde(rename = "ok")]
    Ok { executed_at: String, results: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- rollback ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionRollbackInput {
    pub execution_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ExecutionRollbackOutput {
    #[serde(rename = "ok")]
    Ok { rolled_back_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Timelock
// ══════════════════════════════════════════════════════════════

// --- schedule ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelockScheduleInput {
    pub action: String,
    pub delay: String,
    pub proposer_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TimelockScheduleOutput {
    #[serde(rename = "ok")]
    Ok { timelock_id: String, executable_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- execute ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelockExecuteInput {
    pub timelock_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TimelockExecuteOutput {
    #[serde(rename = "ok")]
    Ok { executed_at: String, result: String },
    #[serde(rename = "not_ready")]
    NotReady { executable_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- cancel ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelockCancelInput {
    pub timelock_id: String,
    pub authority_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TimelockCancelOutput {
    #[serde(rename = "ok")]
    Ok { cancelled_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Guard
// ══════════════════════════════════════════════════════════════

// --- register ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardRegisterInput {
    pub name: String,
    pub guard_type: String,
    pub condition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GuardRegisterOutput {
    #[serde(rename = "ok")]
    Ok { guard_id: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- checkPre ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardCheckPreInput {
    pub guard_id: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GuardCheckPreOutput {
    #[serde(rename = "ok")]
    Ok { passed: String },
    #[serde(rename = "blocked")]
    Blocked { reason: String },
}

// --- checkPost ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardCheckPostInput {
    pub guard_id: String,
    pub context: String,
    pub result: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GuardCheckPostOutput {
    #[serde(rename = "ok")]
    Ok { passed: String },
    #[serde(rename = "blocked")]
    Blocked { reason: String },
}

// --- enable ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardEnableInput {
    pub guard_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GuardEnableOutput {
    #[serde(rename = "ok")]
    Ok { enabled_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- disable ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardDisableInput {
    pub guard_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GuardDisableOutput {
    #[serde(rename = "ok")]
    Ok { disabled_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  FinalityGate
// ══════════════════════════════════════════════════════════════

// --- submit ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinalityGateSubmitInput {
    pub execution_id: String,
    pub evidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FinalityGateSubmitOutput {
    #[serde(rename = "ok")]
    Ok { submission_id: String, submitted_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- confirm ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinalityGateConfirmInput {
    pub submission_id: String,
    pub confirmer_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FinalityGateConfirmOutput {
    #[serde(rename = "ok")]
    Ok { confirmed_at: String, finality_reached: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  RageQuit
// ══════════════════════════════════════════════════════════════

// --- initiate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RageQuitInitiateInput {
    pub member_id: String,
    pub polity_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RageQuitInitiateOutput {
    #[serde(rename = "ok")]
    Ok { ragequit_id: String, initiated_at: String, grace_period_ends: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- calculateClaim ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RageQuitCalculateClaimInput {
    pub ragequit_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RageQuitCalculateClaimOutput {
    #[serde(rename = "ok")]
    Ok { claimable_assets: String, pro_rata_share: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- claim ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RageQuitClaimInput {
    pub ragequit_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RageQuitClaimOutput {
    #[serde(rename = "ok")]
    Ok { claimed_at: String, assets_transferred: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler
