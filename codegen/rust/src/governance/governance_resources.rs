// Governance Resources Suite — Rust Stubs
//
// Concepts: Treasury, Reputation, Metric, Objective, BondingCurve

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ══════════════════════════════════════════════════════════════
//  Treasury
// ══════════════════════════════════════════════════════════════

// --- deposit ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreasuryDepositInput {
    pub treasury_id: String,
    pub depositor_id: String,
    pub amount: String,
    pub asset: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TreasuryDepositOutput {
    #[serde(rename = "ok")]
    Ok { deposit_id: String, balance: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- withdraw ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreasuryWithdrawInput {
    pub treasury_id: String,
    pub recipient_id: String,
    pub amount: String,
    pub asset: String,
    pub authorization: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TreasuryWithdrawOutput {
    #[serde(rename = "ok")]
    Ok { withdrawal_id: String, balance: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- allocate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreasuryAllocateInput {
    pub treasury_id: String,
    pub proposal_id: String,
    pub amount: String,
    pub asset: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TreasuryAllocateOutput {
    #[serde(rename = "ok")]
    Ok { allocation_id: String, allocated_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- releaseAllocation ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreasuryReleaseAllocationInput {
    pub allocation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TreasuryReleaseAllocationOutput {
    #[serde(rename = "ok")]
    Ok { released_at: String, amount_returned: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Reputation
// ══════════════════════════════════════════════════════════════

// --- earn ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationEarnInput {
    pub member_id: String,
    pub amount: String,
    pub reason: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ReputationEarnOutput {
    #[serde(rename = "ok")]
    Ok { new_score: String, earned_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- burn ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationBurnInput {
    pub member_id: String,
    pub amount: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ReputationBurnOutput {
    #[serde(rename = "ok")]
    Ok { new_score: String, burned_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- decay ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationDecayInput {
    pub polity_id: String,
    pub decay_rate: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ReputationDecayOutput {
    #[serde(rename = "ok")]
    Ok { members_affected: String, decayed_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- getScore ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationGetScoreInput {
    pub member_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ReputationGetScoreOutput {
    #[serde(rename = "ok")]
    Ok { score: String, last_updated: String },
}

// --- recalculate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationRecalculateInput {
    pub member_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ReputationRecalculateOutput {
    #[serde(rename = "ok")]
    Ok { previous_score: String, new_score: String, recalculated_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Metric
// ══════════════════════════════════════════════════════════════

// --- define ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricDefineInput {
    pub polity_id: String,
    pub name: String,
    pub unit: String,
    pub aggregation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MetricDefineOutput {
    #[serde(rename = "ok")]
    Ok { metric_id: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- update ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricUpdateInput {
    pub metric_id: String,
    pub value: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MetricUpdateOutput {
    #[serde(rename = "ok")]
    Ok { updated_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- setThreshold ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricSetThresholdInput {
    pub metric_id: String,
    pub threshold: String,
    pub direction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MetricSetThresholdOutput {
    #[serde(rename = "ok")]
    Ok { set_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- evaluate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricEvaluateInput {
    pub metric_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MetricEvaluateOutput {
    #[serde(rename = "ok")]
    Ok { current_value: String, threshold_met: String, trend: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Objective
// ══════════════════════════════════════════════════════════════

// --- create ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectiveCreateInput {
    pub polity_id: String,
    pub title: String,
    pub description: String,
    pub target_metric_id: String,
    pub target_value: String,
    pub deadline: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ObjectiveCreateOutput {
    #[serde(rename = "ok")]
    Ok { objective_id: String, created_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- updateProgress ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectiveUpdateProgressInput {
    pub objective_id: String,
    pub progress: String,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ObjectiveUpdateProgressOutput {
    #[serde(rename = "ok")]
    Ok { updated_at: String, current_progress: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- evaluate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectiveEvaluateInput {
    pub objective_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ObjectiveEvaluateOutput {
    #[serde(rename = "ok")]
    Ok { status: String, progress: String, on_track: String },
}

// --- cancel ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectiveCancelInput {
    pub objective_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ObjectiveCancelOutput {
    #[serde(rename = "ok")]
    Ok { cancelled_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  BondingCurve
// ══════════════════════════════════════════════════════════════

// --- create ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BondingCurveCreateInput {
    pub polity_id: String,
    pub curve_type: String,
    pub reserve_asset: String,
    pub initial_price: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum BondingCurveCreateOutput {
    #[serde(rename = "ok")]
    Ok { curve_id: String, created_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- buy ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BondingCurveBuyInput {
    pub curve_id: String,
    pub buyer_id: String,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum BondingCurveBuyOutput {
    #[serde(rename = "ok")]
    Ok { tokens_minted: String, price_paid: String, new_price: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- sell ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BondingCurveSellInput {
    pub curve_id: String,
    pub seller_id: String,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum BondingCurveSellOutput {
    #[serde(rename = "ok")]
    Ok { tokens_burned: String, payout: String, new_price: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- getPrice ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BondingCurveGetPriceInput {
    pub curve_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum BondingCurveGetPriceOutput {
    #[serde(rename = "ok")]
    Ok { current_price: String, supply: String, reserve: String },
}

// TODO: implement handler
