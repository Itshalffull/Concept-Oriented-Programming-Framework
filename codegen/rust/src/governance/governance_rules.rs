// Governance Rules Suite — Rust Stubs
//
// Concepts: Policy, Monitor, Sanction, Dispute

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ══════════════════════════════════════════════════════════════
//  Policy
// ══════════════════════════════════════════════════════════════

// --- create ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyCreateInput {
    pub polity_id: String,
    pub name: String,
    pub rule_expression: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PolicyCreateOutput {
    #[serde(rename = "ok")]
    Ok { policy_id: String, created_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- evaluate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyEvaluateInput {
    pub policy_id: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PolicyEvaluateOutput {
    #[serde(rename = "ok")]
    Ok { compliant: String, details: String },
}

// --- suspend ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicySuspendInput {
    pub policy_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PolicySuspendOutput {
    #[serde(rename = "ok")]
    Ok { suspended_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- repeal ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyRepealInput {
    pub policy_id: String,
    pub authority_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PolicyRepealOutput {
    #[serde(rename = "ok")]
    Ok { repealed_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- modify ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyModifyInput {
    pub policy_id: String,
    pub new_rule_expression: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PolicyModifyOutput {
    #[serde(rename = "ok")]
    Ok { version: String, modified_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Monitor
// ══════════════════════════════════════════════════════════════

// --- watch ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorWatchInput {
    pub policy_id: String,
    pub target: String,
    pub interval: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MonitorWatchOutput {
    #[serde(rename = "ok")]
    Ok { monitor_id: String, watching_since: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- observe ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorObserveInput {
    pub monitor_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MonitorObserveOutput {
    #[serde(rename = "ok")]
    Ok { status: String, violations: String, observed_at: String },
}

// --- resolve ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorResolveInput {
    pub monitor_id: String,
    pub resolution: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MonitorResolveOutput {
    #[serde(rename = "ok")]
    Ok { resolved_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Sanction
// ══════════════════════════════════════════════════════════════

// --- impose ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SanctionImposeInput {
    pub polity_id: String,
    pub target_id: String,
    pub sanction_type: String,
    pub reason: String,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SanctionImposeOutput {
    #[serde(rename = "ok")]
    Ok { sanction_id: String, imposed_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- escalate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SanctionEscalateInput {
    pub sanction_id: String,
    pub new_severity: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SanctionEscalateOutput {
    #[serde(rename = "ok")]
    Ok { escalated_at: String, severity: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- appeal ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SanctionAppealInput {
    pub sanction_id: String,
    pub appellant_id: String,
    pub grounds: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SanctionAppealOutput {
    #[serde(rename = "ok")]
    Ok { appeal_id: String, filed_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- pardon ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SanctionPardonInput {
    pub sanction_id: String,
    pub authority_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SanctionPardonOutput {
    #[serde(rename = "ok")]
    Ok { pardoned_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- reward ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SanctionRewardInput {
    pub polity_id: String,
    pub target_id: String,
    pub reward_type: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SanctionRewardOutput {
    #[serde(rename = "ok")]
    Ok { reward_id: String, awarded_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Dispute
// ══════════════════════════════════════════════════════════════

// --- open ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisputeOpenInput {
    pub polity_id: String,
    pub complainant_id: String,
    pub respondent_id: String,
    pub subject: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DisputeOpenOutput {
    #[serde(rename = "ok")]
    Ok { dispute_id: String, opened_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- submitEvidence ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisputeSubmitEvidenceInput {
    pub dispute_id: String,
    pub party_id: String,
    pub evidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DisputeSubmitEvidenceOutput {
    #[serde(rename = "ok")]
    Ok { evidence_id: String, submitted_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- arbitrate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisputeArbitrateInput {
    pub dispute_id: String,
    pub arbitrator_id: String,
    pub ruling: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DisputeArbitrateOutput {
    #[serde(rename = "ok")]
    Ok { ruling_id: String, ruled_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- appeal ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisputeAppealInput {
    pub dispute_id: String,
    pub appellant_id: String,
    pub grounds: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DisputeAppealOutput {
    #[serde(rename = "ok")]
    Ok { appeal_id: String, filed_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler
