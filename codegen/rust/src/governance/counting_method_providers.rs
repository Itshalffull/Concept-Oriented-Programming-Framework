// Counting Method Provider Implementations
//
// Majority, Supermajority, ApprovalCounting, ScoreVoting, BordaCount,
// RankedChoice, QuadraticVoting, CondorcetSchulze, ConsentProcess

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

// ══════════════════════════════════════════════════════════════
//  Shared ballot types
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleBallot {
    pub voter: String,
    pub choice: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankedBallot {
    pub voter: String,
    pub ranking: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalBallot {
    pub voter: String,
    pub approvals: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreBallot {
    pub voter: String,
    pub scores: HashMap<String, f64>,
}

// ══════════════════════════════════════════════════════════════
//  Majority
// ══════════════════════════════════════════════════════════════

pub struct MajorityCountHandler;

impl MajorityCountHandler {
    pub async fn configure(
        threshold: f64,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("maj-{}", chrono::Utc::now().timestamp_millis());
        storage.put("majority", &id, json!({
            "id": id, "threshold": threshold,
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn count(
        config: &str,
        ballots: &[SimpleBallot],
        weights: &HashMap<String, f64>,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let cfg = storage.get("majority", config).await?;
        let threshold = cfg.as_ref()
            .and_then(|c| c.get("threshold").and_then(|v| v.as_f64()))
            .unwrap_or(0.5);

        let mut tally: HashMap<String, f64> = HashMap::new();
        let mut total_weight: f64 = 0.0;

        for ballot in ballots {
            let w = weights.get(&ballot.voter).copied().unwrap_or(1.0);
            *tally.entry(ballot.choice.clone()).or_default() += w;
            total_weight += w;
        }

        let mut entries: Vec<_> = tally.iter().collect();
        entries.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap());

        if entries.is_empty() {
            return Ok(json!({ "variant": "no_votes", "totalWeight": 0.0 }));
        }

        let (top_choice, top_weight) = (entries[0].0.clone(), *entries[0].1);
        let vote_share = if total_weight > 0.0 { top_weight / total_weight } else { 0.0 };

        if vote_share > threshold {
            Ok(json!({ "variant": "winner", "choice": top_choice, "voteShare": vote_share, "totalWeight": total_weight }))
        } else {
            Ok(json!({ "variant": "no_majority", "topChoice": top_choice, "voteShare": vote_share, "threshold": threshold, "totalWeight": total_weight }))
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  Supermajority
// ══════════════════════════════════════════════════════════════

pub struct SupermajorityHandler;

impl SupermajorityHandler {
    pub async fn configure(
        threshold: f64,
        abstentions_count: bool,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("supermaj-{}", chrono::Utc::now().timestamp_millis());
        storage.put("supermajority", &id, json!({
            "id": id, "threshold": threshold, "abstentionsCount": abstentions_count,
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn count(
        config: &str,
        ballots: &[SimpleBallot],
        weights: &HashMap<String, f64>,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let cfg = storage.get("supermajority", config).await?;
        let threshold = cfg.as_ref()
            .and_then(|c| c.get("threshold").and_then(|v| v.as_f64()))
            .unwrap_or(2.0 / 3.0);
        let abstentions_count = cfg.as_ref()
            .and_then(|c| c.get("abstentionsCount").and_then(|v| v.as_bool()))
            .unwrap_or(false);

        let mut tally: HashMap<String, f64> = HashMap::new();
        let mut total_weight: f64 = 0.0;

        for ballot in ballots {
            let w = weights.get(&ballot.voter).copied().unwrap_or(1.0);
            if ballot.choice == "abstain" {
                if abstentions_count { total_weight += w; }
                continue;
            }
            *tally.entry(ballot.choice.clone()).or_default() += w;
            total_weight += w;
        }

        let mut entries: Vec<_> = tally.iter().collect();
        entries.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap());

        if entries.is_empty() {
            return Ok(json!({ "variant": "no_votes", "totalWeight": 0.0 }));
        }

        let (top_choice, top_weight) = (entries[0].0.clone(), *entries[0].1);
        let vote_share = if total_weight > 0.0 { top_weight / total_weight } else { 0.0 };

        if vote_share >= threshold {
            Ok(json!({ "variant": "winner", "choice": top_choice, "voteShare": vote_share, "requiredShare": threshold, "totalWeight": total_weight }))
        } else {
            Ok(json!({ "variant": "no_supermajority", "topChoice": top_choice, "voteShare": vote_share, "requiredShare": threshold, "totalWeight": total_weight }))
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  ApprovalCounting
// ══════════════════════════════════════════════════════════════

pub struct ApprovalCountingHandler;

impl ApprovalCountingHandler {
    pub async fn configure(
        winner_count: u32,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("approval-{}", chrono::Utc::now().timestamp_millis());
        storage.put("approval", &id, json!({
            "id": id, "winnerCount": winner_count,
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn count(
        config: &str,
        ballots: &[ApprovalBallot],
        weights: &HashMap<String, f64>,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let cfg = storage.get("approval", config).await?;
        let winner_count = cfg.as_ref()
            .and_then(|c| c.get("winnerCount").and_then(|v| v.as_u64()))
            .unwrap_or(1) as usize;

        let mut tally: HashMap<String, f64> = HashMap::new();
        for ballot in ballots {
            let w = weights.get(&ballot.voter).copied().unwrap_or(1.0);
            for choice in &ballot.approvals {
                *tally.entry(choice.clone()).or_default() += w;
            }
        }

        let mut ranked: Vec<_> = tally.into_iter().collect();
        ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        let top = ranked.first().map(|(c, w)| (c.clone(), *w));

        Ok(json!({
            "variant": "winners",
            "rankedResults": ranked.iter().take(winner_count).map(|(c, w)| json!({"choice": c, "approvalWeight": w})).collect::<Vec<_>>(),
            "topChoice": top.as_ref().map(|t| &t.0),
            "approvalCount": top.map(|t| t.1).unwrap_or(0.0),
        }))
    }
}

// ══════════════════════════════════════════════════════════════
//  ScoreVoting
// ══════════════════════════════════════════════════════════════

pub struct ScoreVotingHandler;

impl ScoreVotingHandler {
    pub async fn configure(
        min_score: f64,
        max_score: f64,
        aggregation: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("score-{}", chrono::Utc::now().timestamp_millis());
        storage.put("score_cfg", &id, json!({
            "id": id, "minScore": min_score, "maxScore": max_score, "aggregation": aggregation,
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn count(
        config: &str,
        ballots: &[ScoreBallot],
        weights: &HashMap<String, f64>,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let cfg = storage.get("score_cfg", config).await?;
        let aggregation = cfg.as_ref()
            .and_then(|c| c.get("aggregation").and_then(|v| v.as_str()))
            .unwrap_or("Mean");

        let mut per_candidate: HashMap<String, (Vec<f64>, Vec<f64>)> = HashMap::new();

        for ballot in ballots {
            let w = weights.get(&ballot.voter).copied().unwrap_or(1.0);
            for (candidate, &score) in &ballot.scores {
                let entry = per_candidate.entry(candidate.clone()).or_insert_with(|| (Vec::new(), Vec::new()));
                entry.0.push(score * w);
                entry.1.push(w);
            }
        }

        let mut results: Vec<(String, f64)> = per_candidate.iter().map(|(candidate, (ws, wts))| {
            let aggregate = if aggregation == "Median" {
                let mut raw: Vec<f64> = ws.iter().zip(wts.iter()).map(|(s, w)| s / w).collect();
                raw.sort_by(|a, b| a.partial_cmp(b).unwrap());
                let mid = raw.len() / 2;
                if raw.len() % 2 != 0 { raw[mid] } else { (raw[mid - 1] + raw[mid]) / 2.0 }
            } else {
                let total_w: f64 = wts.iter().sum();
                let total_s: f64 = ws.iter().sum();
                if total_w > 0.0 { total_s / total_w } else { 0.0 }
            };
            (candidate.clone(), aggregate)
        }).collect();

        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        let winner = results.first().cloned();

        Ok(json!({
            "variant": "winner",
            "choice": winner.as_ref().map(|w| &w.0),
            "averageScore": winner.map(|w| w.1).unwrap_or(0.0),
        }))
    }
}

// ══════════════════════════════════════════════════════════════
//  BordaCount
// ══════════════════════════════════════════════════════════════

pub struct BordaCountHandler;

impl BordaCountHandler {
    pub async fn configure(
        scheme: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("borda-{}", chrono::Utc::now().timestamp_millis());
        storage.put("borda", &id, json!({
            "id": id, "scheme": scheme,
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn count(
        config: &str,
        ballots: &[RankedBallot],
        weights: &HashMap<String, f64>,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let cfg = storage.get("borda", config).await?;
        let scheme = cfg.as_ref()
            .and_then(|c| c.get("scheme").and_then(|v| v.as_str()))
            .unwrap_or("Standard");

        let mut scores: HashMap<String, f64> = HashMap::new();

        for ballot in ballots {
            let w = weights.get(&ballot.voter).copied().unwrap_or(1.0);
            let n = ballot.ranking.len();

            for (i, candidate) in ballot.ranking.iter().enumerate() {
                let points = match scheme {
                    "Modified" => (n - i) as f64,
                    "Dowdall" => 1.0 / (i + 1) as f64,
                    _ => (n - 1 - i) as f64, // Standard
                };
                *scores.entry(candidate.clone()).or_default() += points * w;
            }
        }

        let mut ranked: Vec<_> = scores.iter().collect();
        ranked.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap());
        let winner = ranked.first().map(|(c, _)| (*c).clone());

        Ok(json!({
            "variant": "winner",
            "choice": winner,
            "scores": scores,
        }))
    }
}

// ══════════════════════════════════════════════════════════════
//  RankedChoice (IRV)
// ══════════════════════════════════════════════════════════════

pub struct RankedChoiceHandler;

impl RankedChoiceHandler {
    pub async fn configure(
        seats: u32,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("rcv-{}", chrono::Utc::now().timestamp_millis());
        storage.put("rcv", &id, json!({
            "id": id, "seats": seats, "method": "IRV",
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn count(
        _config: &str,
        ballots: &[RankedBallot],
        weights: &HashMap<String, f64>,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let mut active: Vec<(Vec<String>, f64)> = ballots.iter().map(|b| {
            (b.ranking.clone(), weights.get(&b.voter).copied().unwrap_or(1.0))
        }).collect();

        let total_weight: f64 = active.iter().map(|b| b.1).sum();
        let majority = total_weight / 2.0;
        let mut eliminated: Vec<String> = Vec::new();
        let mut rounds: Vec<Value> = Vec::new();

        for round in 1..=100 {
            let mut tally: HashMap<String, f64> = HashMap::new();
            for (ranking, w) in &active {
                if let Some(top) = ranking.iter().find(|c| !eliminated.contains(c)) {
                    *tally.entry(top.clone()).or_default() += w;
                }
            }

            let mut entries: Vec<_> = tally.iter().collect();
            entries.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap());

            if entries.is_empty() { break; }

            if *entries[0].1 > majority {
                rounds.push(json!({ "round": round, "tally": tally.clone(), "eliminated": null }));
                return Ok(json!({
                    "variant": "elected",
                    "winners": vec![entries[0].0.clone()],
                    "rounds": rounds,
                }));
            }

            let lowest = entries.last().unwrap().0.clone();
            eliminated.push(lowest.clone());
            rounds.push(json!({ "round": round, "tally": tally, "eliminated": lowest }));

            let remaining: Vec<_> = entries.iter().filter(|(c, _)| **c != lowest).collect();
            if remaining.len() <= 1 {
                let winner = remaining.first().map(|(c, _)| (*c).clone());
                return Ok(json!({
                    "variant": "elected",
                    "winners": winner.map(|w| vec![w]).unwrap_or_default(),
                    "rounds": rounds,
                }));
            }
        }

        Ok(json!({ "variant": "exhausted", "rounds": rounds }))
    }
}

// ══════════════════════════════════════════════════════════════
//  QuadraticVoting
// ══════════════════════════════════════════════════════════════

pub struct QuadraticVotingHandler;

impl QuadraticVotingHandler {
    pub async fn open_session(
        credit_budget: f64,
        options: &[String],
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("qv-{}", chrono::Utc::now().timestamp_millis());
        storage.put("qv_session", &id, json!({
            "id": id, "creditBudget": credit_budget, "options": options, "status": "open",
        })).await?;
        Ok(json!({ "variant": "opened", "session": id }))
    }

    pub async fn cast_votes(
        session: &str,
        voter: &str,
        allocations: &HashMap<String, f64>,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let record = storage.get("qv_session", session).await?;
        let record = match record { Some(r) => r, None => return Ok(json!({ "variant": "not_found", "session": session })) };

        let budget = record.get("creditBudget").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let total_cost: f64 = allocations.values().map(|v| v * v).sum();

        if total_cost > budget {
            return Ok(json!({ "variant": "budget_exceeded", "totalCost": total_cost, "budget": budget }));
        }

        let key = format!("{}:{}", session, voter);
        storage.put("qv_vote", &key, json!({
            "session": session, "voter": voter, "allocations": allocations, "totalCost": total_cost,
        })).await?;
        Ok(json!({ "variant": "cast", "session": session, "totalCost": total_cost, "remainingCredits": budget - total_cost }))
    }

    pub async fn tally(
        session: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let votes = storage.find("qv_vote", Some(&json!({ "session": session }))).await?;

        let mut by_option: HashMap<String, f64> = HashMap::new();
        for vote in &votes {
            if let Some(allocs) = vote.get("allocations").and_then(|v| v.as_object()) {
                for (option, v) in allocs {
                    let votes_val = v.as_f64().unwrap_or(0.0);
                    *by_option.entry(option.clone()).or_default() += votes_val;
                }
            }
        }

        let winner = by_option.iter().max_by(|a, b| a.1.partial_cmp(b.1).unwrap()).map(|(k, _)| k.clone());

        Ok(json!({
            "variant": "result",
            "session": session,
            "winner": winner,
            "votesByOption": by_option,
        }))
    }
}

// ══════════════════════════════════════════════════════════════
//  CondorcetSchulze
// ══════════════════════════════════════════════════════════════

pub struct CondorcetSchulzeHandler;

impl CondorcetSchulzeHandler {
    pub async fn configure(
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("condorcet-{}", chrono::Utc::now().timestamp_millis());
        storage.put("condorcet", &id, json!({ "id": id })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn count(
        _config: &str,
        ballots: &[RankedBallot],
        weights: &HashMap<String, f64>,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        // Collect candidates
        let mut candidate_set: std::collections::HashSet<String> = std::collections::HashSet::new();
        for b in ballots {
            for c in &b.ranking { candidate_set.insert(c.clone()); }
        }
        let candidates: Vec<String> = candidate_set.into_iter().collect();
        let n = candidates.len();
        let idx: HashMap<&str, usize> = candidates.iter().enumerate().map(|(i, c)| (c.as_str(), i)).collect();

        // Pairwise preference matrix
        let mut d = vec![vec![0.0f64; n]; n];
        for ballot in ballots {
            let w = weights.get(&ballot.voter).copied().unwrap_or(1.0);
            for i in 0..ballot.ranking.len() {
                for j in (i + 1)..ballot.ranking.len() {
                    let a = idx[ballot.ranking[i].as_str()];
                    let b = idx[ballot.ranking[j].as_str()];
                    d[a][b] += w;
                }
            }
        }

        // Schulze: strongest paths via Floyd-Warshall
        let mut p = vec![vec![0.0f64; n]; n];
        for i in 0..n {
            for j in 0..n {
                if i != j && d[i][j] > d[j][i] {
                    p[i][j] = d[i][j];
                }
            }
        }
        for k in 0..n {
            for i in 0..n {
                if i == k { continue; }
                for j in 0..n {
                    if j == i || j == k { continue; }
                    p[i][j] = p[i][j].max(p[i][k].min(p[k][j]));
                }
            }
        }

        // Find Condorcet winner
        let mut winner: Option<String> = None;
        for i in 0..n {
            if (0..n).all(|j| i == j || p[i][j] > p[j][i]) {
                winner = Some(candidates[i].clone());
                break;
            }
        }

        if let Some(w) = winner {
            Ok(json!({ "variant": "winner", "choice": w }))
        } else {
            Ok(json!({ "variant": "no_condorcet_winner" }))
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  ConsentProcess
// ══════════════════════════════════════════════════════════════

pub struct ConsentProcessHandler;

impl ConsentProcessHandler {
    pub async fn open_round(
        proposal: &str,
        facilitator: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("consent-{}", chrono::Utc::now().timestamp_millis());
        storage.put("consent", &id, json!({
            "id": id,
            "proposal": proposal,
            "facilitator": facilitator,
            "phase": "Presenting",
            "objections": [],
        })).await?;
        Ok(json!({ "variant": "opened", "round": id }))
    }

    pub async fn advance_phase(
        round: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let record = storage.get("consent", round).await?;
        let record = match record { Some(r) => r, None => return Ok(json!({ "variant": "not_found", "round": round })) };

        let phases = ["Presenting", "Clarifying", "Reacting", "Objecting", "Integrating", "Consented"];
        let current = record.get("phase").and_then(|v| v.as_str()).unwrap_or("Presenting");
        let idx = phases.iter().position(|&p| p == current).unwrap_or(0);

        if idx >= phases.len() - 1 {
            return Ok(json!({ "variant": "already_final", "round": round, "phase": current }));
        }

        let next = phases[idx + 1];
        let mut updated = record.clone();
        updated["phase"] = json!(next);
        storage.put("consent", round, updated).await?;
        Ok(json!({ "variant": "advanced", "round": round, "phase": next }))
    }

    pub async fn finalize(
        round: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let record = storage.get("consent", round).await?;
        let record = match record { Some(r) => r, None => return Ok(json!({ "variant": "not_found", "round": round })) };

        let mut updated = record.clone();
        updated["phase"] = json!("Consented");
        storage.put("consent", round, updated).await?;
        Ok(json!({ "variant": "consented", "round": round }))
    }
}
