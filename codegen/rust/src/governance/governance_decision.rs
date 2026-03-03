// Governance Decision Suite — Rust Stubs
//
// Concepts: Proposal, Vote, CountingMethod, Quorum, Conviction,
//           PredictionMarket, OptimisticApproval, Deliberation, Meeting

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ══════════════════════════════════════════════════════════════
//  Proposal
// ══════════════════════════════════════════════════════════════

// --- create ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalCreateInput {
    pub polity_id: String,
    pub title: String,
    pub body: String,
    pub author_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProposalCreateOutput {
    #[serde(rename = "ok")]
    Ok { proposal_id: String, created_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- sponsor ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalSponsorInput {
    pub proposal_id: String,
    pub sponsor_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProposalSponsorOutput {
    #[serde(rename = "ok")]
    Ok { sponsor_count: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- activate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalActivateInput {
    pub proposal_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProposalActivateOutput {
    #[serde(rename = "ok")]
    Ok { activated_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- advance ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalAdvanceInput {
    pub proposal_id: String,
    pub next_stage: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProposalAdvanceOutput {
    #[serde(rename = "ok")]
    Ok { stage: String, advanced_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- cancel ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalCancelInput {
    pub proposal_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProposalCancelOutput {
    #[serde(rename = "ok")]
    Ok { cancelled_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Vote
// ══════════════════════════════════════════════════════════════

// --- openSession ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteOpenSessionInput {
    pub proposal_id: String,
    pub method: String,
    pub deadline: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum VoteOpenSessionOutput {
    #[serde(rename = "ok")]
    Ok { session_id: String, opened_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- castVote ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteCastVoteInput {
    pub session_id: String,
    pub voter_id: String,
    pub choice: String,
    pub weight: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum VoteCastVoteOutput {
    #[serde(rename = "ok")]
    Ok { vote_id: String, cast_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- close ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteCloseInput {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum VoteCloseOutput {
    #[serde(rename = "ok")]
    Ok { closed_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- tally ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteTallyInput {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum VoteTallyOutput {
    #[serde(rename = "ok")]
    Ok { result: String, turnout: String, breakdown: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  CountingMethod
// ══════════════════════════════════════════════════════════════

// --- register ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CountingMethodRegisterInput {
    pub name: String,
    pub algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CountingMethodRegisterOutput {
    #[serde(rename = "ok")]
    Ok { method_id: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- aggregate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CountingMethodAggregateInput {
    pub method_id: String,
    pub votes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CountingMethodAggregateOutput {
    #[serde(rename = "ok")]
    Ok { result: String, breakdown: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- deregister ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CountingMethodDeregisterInput {
    pub method_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CountingMethodDeregisterOutput {
    #[serde(rename = "ok")]
    Ok { deregistered_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Quorum
// ══════════════════════════════════════════════════════════════

// --- setThreshold ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuorumSetThresholdInput {
    pub polity_id: String,
    pub scope: String,
    pub threshold: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum QuorumSetThresholdOutput {
    #[serde(rename = "ok")]
    Ok { set_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- check ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuorumCheckInput {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum QuorumCheckOutput {
    #[serde(rename = "ok")]
    Ok { met: String, current: String, required: String },
}

// --- updateThreshold ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuorumUpdateThresholdInput {
    pub polity_id: String,
    pub scope: String,
    pub new_threshold: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum QuorumUpdateThresholdOutput {
    #[serde(rename = "ok")]
    Ok { updated_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Conviction
// ══════════════════════════════════════════════════════════════

// --- registerProposal ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvictionRegisterProposalInput {
    pub proposal_id: String,
    pub requested_amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConvictionRegisterProposalOutput {
    #[serde(rename = "ok")]
    Ok { registered_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- stake ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvictionStakeInput {
    pub proposal_id: String,
    pub staker_id: String,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConvictionStakeOutput {
    #[serde(rename = "ok")]
    Ok { staked_at: String, total_staked: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- unstake ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvictionUnstakeInput {
    pub proposal_id: String,
    pub staker_id: String,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConvictionUnstakeOutput {
    #[serde(rename = "ok")]
    Ok { unstaked_at: String, remaining: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- updateConviction ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvictionUpdateConvictionInput {
    pub proposal_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConvictionUpdateConvictionOutput {
    #[serde(rename = "ok")]
    Ok { conviction_score: String, threshold: String, passed: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  PredictionMarket
// ══════════════════════════════════════════════════════════════

// --- createMarket ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictionMarketCreateMarketInput {
    pub proposal_id: String,
    pub question: String,
    pub outcomes: String,
    pub deadline: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PredictionMarketCreateMarketOutput {
    #[serde(rename = "ok")]
    Ok { market_id: String, created_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- trade ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictionMarketTradeInput {
    pub market_id: String,
    pub trader_id: String,
    pub outcome: String,
    pub amount: String,
    pub direction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PredictionMarketTradeOutput {
    #[serde(rename = "ok")]
    Ok { trade_id: String, shares: String, price: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- resolve ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictionMarketResolveInput {
    pub market_id: String,
    pub winning_outcome: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PredictionMarketResolveOutput {
    #[serde(rename = "ok")]
    Ok { resolved_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- claimPayout ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictionMarketClaimPayoutInput {
    pub market_id: String,
    pub trader_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PredictionMarketClaimPayoutOutput {
    #[serde(rename = "ok")]
    Ok { payout: String, claimed_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  OptimisticApproval
// ══════════════════════════════════════════════════════════════

// --- assert ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimisticApprovalAssertInput {
    pub proposal_id: String,
    pub asserter_id: String,
    pub claim: String,
    pub bond: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum OptimisticApprovalAssertOutput {
    #[serde(rename = "ok")]
    Ok { assertion_id: String, challenge_deadline: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- challenge ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimisticApprovalChallengeInput {
    pub assertion_id: String,
    pub challenger_id: String,
    pub evidence: String,
    pub bond: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum OptimisticApprovalChallengeOutput {
    #[serde(rename = "ok")]
    Ok { challenge_id: String, opened_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- finalize ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimisticApprovalFinalizeInput {
    pub assertion_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum OptimisticApprovalFinalizeOutput {
    #[serde(rename = "ok")]
    Ok { finalized_at: String, outcome: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- resolve ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimisticApprovalResolveInput {
    pub challenge_id: String,
    pub outcome: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum OptimisticApprovalResolveOutput {
    #[serde(rename = "ok")]
    Ok { resolved_at: String, bond_recipient: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Deliberation
// ══════════════════════════════════════════════════════════════

// --- open ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliberationOpenInput {
    pub proposal_id: String,
    pub topic: String,
    pub facilitator_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DeliberationOpenOutput {
    #[serde(rename = "ok")]
    Ok { deliberation_id: String, opened_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- addEntry ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliberationAddEntryInput {
    pub deliberation_id: String,
    pub author_id: String,
    pub content: String,
    pub entry_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DeliberationAddEntryOutput {
    #[serde(rename = "ok")]
    Ok { entry_id: String, added_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- signal ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliberationSignalInput {
    pub deliberation_id: String,
    pub member_id: String,
    pub signal_type: String,
    pub target_entry_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DeliberationSignalOutput {
    #[serde(rename = "ok")]
    Ok { signal_id: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- close ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliberationCloseInput {
    pub deliberation_id: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DeliberationCloseOutput {
    #[serde(rename = "ok")]
    Ok { closed_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler

// ══════════════════════════════════════════════════════════════
//  Meeting
// ══════════════════════════════════════════════════════════════

// --- schedule ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingScheduleInput {
    pub polity_id: String,
    pub title: String,
    pub scheduled_at: String,
    pub agenda: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MeetingScheduleOutput {
    #[serde(rename = "ok")]
    Ok { meeting_id: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- callToOrder ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingCallToOrderInput {
    pub meeting_id: String,
    pub chair_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MeetingCallToOrderOutput {
    #[serde(rename = "ok")]
    Ok { started_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- makeMotion ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingMakeMotionInput {
    pub meeting_id: String,
    pub mover_id: String,
    pub motion_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MeetingMakeMotionOutput {
    #[serde(rename = "ok")]
    Ok { motion_id: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- secondMotion ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingSecondMotionInput {
    pub motion_id: String,
    pub seconder_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MeetingSecondMotionOutput {
    #[serde(rename = "ok")]
    Ok { seconded_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- callQuestion ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingCallQuestionInput {
    pub motion_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MeetingCallQuestionOutput {
    #[serde(rename = "ok")]
    Ok { vote_session_id: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- recordMinute ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingRecordMinuteInput {
    pub meeting_id: String,
    pub recorder_id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MeetingRecordMinuteOutput {
    #[serde(rename = "ok")]
    Ok { minute_id: String, recorded_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// --- adjourn ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingAdjournInput {
    pub meeting_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MeetingAdjournOutput {
    #[serde(rename = "ok")]
    Ok { adjourned_at: String },
    #[serde(rename = "error")]
    Error { reason: String },
}

// TODO: implement handler
