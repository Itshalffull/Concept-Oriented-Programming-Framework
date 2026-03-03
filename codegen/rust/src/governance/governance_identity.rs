// Governance Identity Suite — Rust Stubs
//
// Concepts: Membership, Role, Permission, SybilResistance,
//           Attestation, AgenticDelegate

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ══════════════════════════════════════════════════════════════
//  Membership
// ══════════════════════════════════════════════════════════════

// --- join ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembershipJoinInput {
    pub polity_id: String,
    pub applicant_id: String,
    pub proof_of_eligibility: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MembershipJoinOutput {
    #[serde(rename = "ok")]
    Ok { member_id: String, joined_at: String },
    #[serde(rename = "rejected")]
    Rejected { reason: String },
}

// --- leave ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembershipLeaveInput {
    pub polity_id: String,
    pub member_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MembershipLeaveOutput {
    #[serde(rename = "ok")]
    Ok { left_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- suspend ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembershipSuspendInput {
    pub polity_id: String,
    pub member_id: String,
    pub reason: String,
    pub duration: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MembershipSuspendOutput {
    #[serde(rename = "ok")]
    Ok { suspended_until: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- reinstate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembershipReinstateInput {
    pub polity_id: String,
    pub member_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MembershipReinstateOutput {
    #[serde(rename = "ok")]
    Ok { reinstated_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- kick ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembershipKickInput {
    pub polity_id: String,
    pub member_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MembershipKickOutput {
    #[serde(rename = "ok")]
    Ok { kicked_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- updateRules ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembershipUpdateRulesInput {
    pub polity_id: String,
    pub new_rules: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MembershipUpdateRulesOutput {
    #[serde(rename = "ok")]
    Ok { version: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Role
// ══════════════════════════════════════════════════════════════

// --- create ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleCreateInput {
    pub polity_id: String,
    pub name: String,
    pub permissions: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RoleCreateOutput {
    #[serde(rename = "ok")]
    Ok { role_id: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- assign ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleAssignInput {
    pub role_id: String,
    pub member_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RoleAssignOutput {
    #[serde(rename = "ok")]
    Ok { assigned_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- revoke ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleRevokeInput {
    pub role_id: String,
    pub member_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RoleRevokeOutput {
    #[serde(rename = "ok")]
    Ok { revoked_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- check ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleCheckInput {
    pub role_id: String,
    pub member_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RoleCheckOutput {
    #[serde(rename = "ok")]
    Ok { has_role: String },
}

// --- dissolve ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleDissolveInput {
    pub role_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RoleDissolveOutput {
    #[serde(rename = "ok")]
    Ok { dissolved_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Permission
// ══════════════════════════════════════════════════════════════

// --- grant ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionGrantInput {
    pub role_id: String,
    pub permission: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PermissionGrantOutput {
    #[serde(rename = "ok")]
    Ok { granted_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- revoke ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionRevokeInput {
    pub role_id: String,
    pub permission: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PermissionRevokeOutput {
    #[serde(rename = "ok")]
    Ok { revoked_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- check ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionCheckInput {
    pub member_id: String,
    pub permission: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PermissionCheckOutput {
    #[serde(rename = "ok")]
    Ok { allowed: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  SybilResistance
// ══════════════════════════════════════════════════════════════

// --- verify ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SybilResistanceVerifyInput {
    pub polity_id: String,
    pub applicant_id: String,
    pub proof: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SybilResistanceVerifyOutput {
    #[serde(rename = "ok")]
    Ok { verified: String, score: String },
    #[serde(rename = "rejected")]
    Rejected { reason: String },
}

// --- challenge ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SybilResistanceChallengeInput {
    pub polity_id: String,
    pub member_id: String,
    pub challenger_id: String,
    pub evidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SybilResistanceChallengeOutput {
    #[serde(rename = "ok")]
    Ok { challenge_id: String, opened_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- resolveChallenge ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SybilResistanceResolveChallengeInput {
    pub challenge_id: String,
    pub outcome: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SybilResistanceResolveChallengeOutput {
    #[serde(rename = "ok")]
    Ok { resolved_at: String, outcome: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Attestation
// ══════════════════════════════════════════════════════════════

// --- attest ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttestationAttestInput {
    pub issuer_id: String,
    pub subject_id: String,
    pub claim: String,
    pub evidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AttestationAttestOutput {
    #[serde(rename = "ok")]
    Ok { attestation_id: String, issued_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- revoke ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttestationRevokeInput {
    pub attestation_id: String,
    pub issuer_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AttestationRevokeOutput {
    #[serde(rename = "ok")]
    Ok { revoked_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- verify ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttestationVerifyInput {
    pub attestation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AttestationVerifyOutput {
    #[serde(rename = "ok")]
    Ok { valid: String, claim: String },
    #[serde(rename = "invalid")]
    Invalid { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  AgenticDelegate
// ══════════════════════════════════════════════════════════════

// --- register ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgenticDelegateRegisterInput {
    pub polity_id: String,
    pub agent_id: String,
    pub principal_id: String,
    pub autonomy_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AgenticDelegateRegisterOutput {
    #[serde(rename = "ok")]
    Ok { delegate_id: String, registered_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- assumeRole ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgenticDelegateAssumeRoleInput {
    pub delegate_id: String,
    pub role_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AgenticDelegateAssumeRoleOutput {
    #[serde(rename = "ok")]
    Ok { assumed_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- releaseRole ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgenticDelegateReleaseRoleInput {
    pub delegate_id: String,
    pub role_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AgenticDelegateReleaseRoleOutput {
    #[serde(rename = "ok")]
    Ok { released_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- proposeAction ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgenticDelegateProposeActionInput {
    pub delegate_id: String,
    pub action_type: String,
    pub payload: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AgenticDelegateProposeActionOutput {
    #[serde(rename = "ok")]
    Ok { action_id: String, status: String },
    #[serde(rename = "escalated")]
    Escalated { reason: String, escalated_to: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- escalate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgenticDelegateEscalateInput {
    pub delegate_id: String,
    pub action_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AgenticDelegateEscalateOutput {
    #[serde(rename = "ok")]
    Ok { escalated_to: String, escalated_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- updateAutonomy ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgenticDelegateUpdateAutonomyInput {
    pub delegate_id: String,
    pub principal_id: String,
    pub new_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AgenticDelegateUpdateAutonomyOutput {
    #[serde(rename = "ok")]
    Ok { updated_at: String, level: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler
