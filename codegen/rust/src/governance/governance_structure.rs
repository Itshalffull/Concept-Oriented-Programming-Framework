// Governance Structure Suite — Rust Stubs
//
// Concepts: Polity, Circle, Delegation, Weight

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ══════════════════════════════════════════════════════════════
//  Polity
// ══════════════════════════════════════════════════════════════

// --- establish ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolityEstablishInput {
    pub name: String,
    pub constitution: String,
    pub founder_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PolityEstablishOutput {
    #[serde(rename = "ok")]
    Ok { polity_id: String, established_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- amend ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolityAmendInput {
    pub polity_id: String,
    pub amendment: String,
    pub proposer_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PolityAmendOutput {
    #[serde(rename = "ok")]
    Ok { version: String, amended_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- dissolve ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolityDissolveInput {
    pub polity_id: String,
    pub authority_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PolityDissolveOutput {
    #[serde(rename = "ok")]
    Ok { dissolved_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Circle
// ══════════════════════════════════════════════════════════════

// --- create ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircleCreateInput {
    pub polity_id: String,
    pub name: String,
    pub purpose: String,
    pub parent_circle_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CircleCreateOutput {
    #[serde(rename = "ok")]
    Ok { circle_id: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- assignMember ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircleAssignMemberInput {
    pub circle_id: String,
    pub member_id: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CircleAssignMemberOutput {
    #[serde(rename = "ok")]
    Ok { assigned_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- removeMember ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircleRemoveMemberInput {
    pub circle_id: String,
    pub member_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CircleRemoveMemberOutput {
    #[serde(rename = "ok")]
    Ok { removed_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- setLinks ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircleSetLinksInput {
    pub circle_id: String,
    pub lead_link: String,
    pub rep_link: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CircleSetLinksOutput {
    #[serde(rename = "ok")]
    Ok { updated_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- dissolve ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircleDissolveInput {
    pub circle_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CircleDissolveOutput {
    #[serde(rename = "ok")]
    Ok { dissolved_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- checkJurisdiction ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircleCheckJurisdictionInput {
    pub circle_id: String,
    pub domain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CircleCheckJurisdictionOutput {
    #[serde(rename = "ok")]
    Ok { has_jurisdiction: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Delegation
// ══════════════════════════════════════════════════════════════

// --- delegate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegationDelegateInput {
    pub delegator_id: String,
    pub delegate_id: String,
    pub scope: String,
    pub weight: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DelegationDelegateOutput {
    #[serde(rename = "ok")]
    Ok { delegation_id: String, delegated_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- undelegate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegationUndelegateInput {
    pub delegation_id: String,
    pub delegator_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DelegationUndelegateOutput {
    #[serde(rename = "ok")]
    Ok { undelegated_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- getEffectiveWeight ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegationGetEffectiveWeightInput {
    pub delegate_id: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DelegationGetEffectiveWeightOutput {
    #[serde(rename = "ok")]
    Ok { effective_weight: String, delegation_chain: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Weight
// ══════════════════════════════════════════════════════════════

// --- updateWeight ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightUpdateWeightInput {
    pub member_id: String,
    pub scope: String,
    pub new_weight: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum WeightUpdateWeightOutput {
    #[serde(rename = "ok")]
    Ok { updated_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- snapshot ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightSnapshotInput {
    pub polity_id: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum WeightSnapshotOutput {
    #[serde(rename = "ok")]
    Ok { snapshot_id: String, taken_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- getWeight ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightGetWeightInput {
    pub member_id: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum WeightGetWeightOutput {
    #[serde(rename = "ok")]
    Ok { weight: String },
}

// --- getWeightFromSnapshot ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightGetWeightFromSnapshotInput {
    pub snapshot_id: String,
    pub member_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum WeightGetWeightFromSnapshotOutput {
    #[serde(rename = "ok")]
    Ok { weight: String, snapshot_taken_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler
