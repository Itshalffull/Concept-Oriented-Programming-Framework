// Reputation Algorithm Provider Implementations
//
// SimpleAccumulator, EloRating, PeerAllocation, PageRankReputation, GlickoRating

use crate::storage::{ConceptStorage, StorageResult};
use serde_json::{json, Value};
use std::collections::HashMap;

// ══════════════════════════════════════════════════════════════
//  SimpleAccumulator
// ══════════════════════════════════════════════════════════════

pub struct SimpleAccumulatorHandler;

impl SimpleAccumulatorHandler {
    pub async fn configure(decay_rate: Option<f64>, cap: Option<f64>, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let id = format!("acc-{}", chrono::Utc::now().timestamp_millis());
        storage.put("accumulator", &id, json!({ "id": id, "decayRate": decay_rate, "cap": cap })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn add(config: &str, participant: &str, amount: f64, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let cfg = storage.get("accumulator", config).await?;
        let cap = cfg.as_ref().and_then(|c| c.get("cap").and_then(|v| v.as_f64()));
        let key = format!("{}:{}", config, participant);
        let existing = storage.get("acc_score", &key).await?;
        let current = existing.and_then(|r| r.get("score").and_then(|v| v.as_f64())).unwrap_or(0.0);
        let mut new_score = current + amount;
        if let Some(c) = cap { new_score = new_score.min(c); }
        storage.put("acc_score", &key, json!({ "config": config, "participant": participant, "score": new_score })).await?;
        Ok(json!({ "variant": "added", "participant": participant, "newScore": new_score }))
    }

    pub async fn apply_decay(config: &str, participant: &str, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let cfg = storage.get("accumulator", config).await?;
        let decay_rate = cfg.as_ref().and_then(|c| c.get("decayRate").and_then(|v| v.as_f64()));
        if decay_rate.is_none() { return Ok(json!({ "variant": "no_decay", "participant": participant })); }
        let rate = decay_rate.unwrap();
        let key = format!("{}:{}", config, participant);
        let existing = storage.get("acc_score", &key).await?;
        let current = existing.and_then(|r| r.get("score").and_then(|v| v.as_f64())).unwrap_or(0.0);
        let new_score = current * (1.0 - rate);
        storage.put("acc_score", &key, json!({ "config": config, "participant": participant, "score": new_score })).await?;
        Ok(json!({ "variant": "decayed", "participant": participant, "newScore": new_score, "previousScore": current }))
    }

    pub async fn get_score(config: &str, participant: &str, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let key = format!("{}:{}", config, participant);
        let existing = storage.get("acc_score", &key).await?;
        let score = existing.and_then(|r| r.get("score").and_then(|v| v.as_f64())).unwrap_or(0.0);
        Ok(json!({ "variant": "score", "participant": participant, "score": score }))
    }
}

// ══════════════════════════════════════════════════════════════
//  EloRating
// ══════════════════════════════════════════════════════════════

pub struct EloRatingHandler;

impl EloRatingHandler {
    pub async fn configure(k_factor: f64, initial_rating: f64, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let id = format!("elo-{}", chrono::Utc::now().timestamp_millis());
        storage.put("elo_cfg", &id, json!({ "id": id, "kFactor": k_factor, "initialRating": initial_rating })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn record_outcome(config: &str, winner: &str, loser: &str, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let cfg = storage.get("elo_cfg", config).await?;
        let k = cfg.as_ref().and_then(|c| c.get("kFactor").and_then(|v| v.as_f64())).unwrap_or(32.0);
        let initial = cfg.as_ref().and_then(|c| c.get("initialRating").and_then(|v| v.as_f64())).unwrap_or(1500.0);

        let w_key = format!("{}:{}", config, winner);
        let l_key = format!("{}:{}", config, loser);
        let w_rec = storage.get("elo_rating", &w_key).await?;
        let l_rec = storage.get("elo_rating", &l_key).await?;
        let rw = w_rec.as_ref().and_then(|r| r.get("rating").and_then(|v| v.as_f64())).unwrap_or(initial);
        let rl = l_rec.as_ref().and_then(|r| r.get("rating").and_then(|v| v.as_f64())).unwrap_or(initial);
        let w_games = w_rec.as_ref().and_then(|r| r.get("gamesPlayed").and_then(|v| v.as_u64())).unwrap_or(0);
        let l_games = l_rec.as_ref().and_then(|r| r.get("gamesPlayed").and_then(|v| v.as_u64())).unwrap_or(0);

        let ew = 1.0 / (1.0 + 10.0_f64.powf((rl - rw) / 400.0));
        let el = 1.0 / (1.0 + 10.0_f64.powf((rw - rl) / 400.0));
        let w_delta = k * (1.0 - ew);
        let l_delta = k * (0.0 - el);
        let w_new = rw + w_delta;
        let l_new = rl + l_delta;

        storage.put("elo_rating", &w_key, json!({ "config": config, "participant": winner, "rating": w_new, "gamesPlayed": w_games + 1 })).await?;
        storage.put("elo_rating", &l_key, json!({ "config": config, "participant": loser, "rating": l_new, "gamesPlayed": l_games + 1 })).await?;

        Ok(json!({ "variant": "updated", "winnerNewRating": w_new, "loserNewRating": l_new, "winnerDelta": w_delta, "loserDelta": l_delta }))
    }

    pub async fn get_rating(config: &str, participant: &str, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let cfg = storage.get("elo_cfg", config).await?;
        let initial = cfg.as_ref().and_then(|c| c.get("initialRating").and_then(|v| v.as_f64())).unwrap_or(1500.0);
        let key = format!("{}:{}", config, participant);
        let rec = storage.get("elo_rating", &key).await?;
        let rating = rec.as_ref().and_then(|r| r.get("rating").and_then(|v| v.as_f64())).unwrap_or(initial);
        let games = rec.as_ref().and_then(|r| r.get("gamesPlayed").and_then(|v| v.as_u64())).unwrap_or(0);
        Ok(json!({ "variant": "rating", "participant": participant, "value": rating, "gamesPlayed": games }))
    }
}

// ══════════════════════════════════════════════════════════════
//  PeerAllocation
// ══════════════════════════════════════════════════════════════

pub struct PeerAllocationHandler;

impl PeerAllocationHandler {
    pub async fn open_round(budget: f64, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let id = format!("peer-alloc-{}", chrono::Utc::now().timestamp_millis());
        storage.put("peer_alloc", &id, json!({ "id": id, "budget": budget, "status": "Open" })).await?;
        Ok(json!({ "variant": "opened", "round": id }))
    }

    pub async fn allocate(round: &str, allocator: &str, recipient: &str, amount: f64, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        if allocator == recipient { return Ok(json!({ "variant": "self_allocation", "allocator": allocator })); }
        let record = storage.get("peer_alloc", round).await?;
        if record.is_none() { return Ok(json!({ "variant": "not_found", "round": round })); }
        let rec = record.unwrap();
        if rec.get("status").and_then(|v| v.as_str()) != Some("Open") {
            return Ok(json!({ "variant": "round_closed", "round": round }));
        }
        let key = format!("{}:{}:{}", round, allocator, recipient);
        storage.put("peer_alloc_entry", &key, json!({
            "round": round, "allocator": allocator, "recipient": recipient, "amount": amount,
        })).await?;
        Ok(json!({ "variant": "allocated", "round": round }))
    }

    pub async fn finalize(round: &str, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let record = storage.get("peer_alloc", round).await?;
        if record.is_none() { return Ok(json!({ "variant": "not_found", "round": round })); }
        let rec = record.unwrap();
        let budget = rec.get("budget").and_then(|v| v.as_f64()).unwrap_or(0.0);

        let entries = storage.find("peer_alloc_entry", Some(&json!({ "round": round }))).await?;
        let mut totals: HashMap<String, f64> = HashMap::new();
        for entry in &entries {
            let r = entry.get("recipient").and_then(|v| v.as_str()).unwrap_or("");
            let a = entry.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
            *totals.entry(r.to_string()).or_default() += a;
        }
        let grand_total: f64 = totals.values().sum();
        let normalized: HashMap<String, f64> = totals.iter()
            .map(|(k, v)| (k.clone(), if grand_total > 0.0 { v / grand_total * budget } else { 0.0 }))
            .collect();

        let mut updated = rec.clone();
        updated["status"] = json!("Finalized");
        storage.put("peer_alloc", round, updated).await?;
        Ok(json!({ "variant": "finalized", "round": round, "results": normalized }))
    }
}

// ══════════════════════════════════════════════════════════════
//  PageRankReputation
// ══════════════════════════════════════════════════════════════

pub struct PageRankReputationHandler;

impl PageRankReputationHandler {
    pub async fn configure(damping_factor: f64, iterations: u32, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let id = format!("pr-{}", chrono::Utc::now().timestamp_millis());
        storage.put("pagerank", &id, json!({ "id": id, "dampingFactor": damping_factor, "iterations": iterations })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn add_contribution(config: &str, from: &str, to: &str, weight: f64, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let key = format!("{}:{}:{}", config, from, to);
        storage.put("pr_edge", &key, json!({ "config": config, "from": from, "to": to, "weight": weight })).await?;
        Ok(json!({ "variant": "added", "edge": format!("{}:{}", from, to) }))
    }

    pub async fn compute(config: &str, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let cfg = storage.get("pagerank", config).await?;
        let d = cfg.as_ref().and_then(|c| c.get("dampingFactor").and_then(|v| v.as_f64())).unwrap_or(0.85);
        let iterations = cfg.as_ref().and_then(|c| c.get("iterations").and_then(|v| v.as_u64())).unwrap_or(20) as usize;

        let edges = storage.find("pr_edge", Some(&json!({ "config": config }))).await?;

        let mut node_set: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut outgoing: HashMap<String, Vec<(String, f64)>> = HashMap::new();
        for edge in &edges {
            let from = edge.get("from").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let to = edge.get("to").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let w = edge.get("weight").and_then(|v| v.as_f64()).unwrap_or(1.0);
            node_set.insert(from.clone());
            node_set.insert(to.clone());
            outgoing.entry(from).or_default().push((to, w));
        }

        let nodes: Vec<String> = node_set.into_iter().collect();
        let n = nodes.len();
        if n == 0 { return Ok(json!({ "variant": "computed", "config": config, "scores": {} })); }

        let mut scores: HashMap<String, f64> = nodes.iter().map(|n| (n.clone(), 1.0 / n as f64)).collect();

        for _ in 0..iterations {
            let mut new_scores: HashMap<String, f64> = nodes.iter().map(|n| (n.clone(), (1.0 - d) / n as f64)).collect();
            for node in &nodes {
                if let Some(outs) = outgoing.get(node) {
                    let total_out: f64 = outs.iter().map(|(_, w)| w).sum();
                    if total_out == 0.0 { continue; }
                    let node_score = scores[node];
                    for (to, w) in outs {
                        let share = (w / total_out) * node_score * d;
                        *new_scores.entry(to.clone()).or_default() += share;
                    }
                }
            }
            scores = new_scores;
        }

        for (node, score) in &scores {
            storage.put("pr_score", &format!("{}:{}", config, node), json!({
                "config": config, "participant": node, "pageRank": score,
            })).await?;
        }

        Ok(json!({ "variant": "computed", "config": config, "scores": scores }))
    }

    pub async fn get_score(config: &str, participant: &str, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let key = format!("{}:{}", config, participant);
        let rec = storage.get("pr_score", &key).await?;
        let pr = rec.and_then(|r| r.get("pageRank").and_then(|v| v.as_f64())).unwrap_or(0.0);
        Ok(json!({ "variant": "score", "participant": participant, "pageRank": pr }))
    }
}

// ══════════════════════════════════════════════════════════════
//  GlickoRating
// ══════════════════════════════════════════════════════════════

pub struct GlickoRatingHandler;

impl GlickoRatingHandler {
    const TAU: f64 = 0.5;

    fn g(phi: f64) -> f64 {
        1.0 / (1.0 + 3.0 * phi * phi / (std::f64::consts::PI * std::f64::consts::PI)).sqrt()
    }

    fn expected(mu: f64, mu_j: f64, phi_j: f64) -> f64 {
        1.0 / (1.0 + (-Self::g(phi_j) * (mu - mu_j)).exp())
    }

    pub async fn configure(initial_rating: f64, initial_deviation: f64, initial_volatility: f64, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let id = format!("glicko-{}", chrono::Utc::now().timestamp_millis());
        storage.put("glicko_cfg", &id, json!({
            "id": id, "initialRating": initial_rating, "initialDeviation": initial_deviation, "initialVolatility": initial_volatility,
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn record_outcome(config: &str, participant: &str, opponent: &str, outcome: f64, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let cfg = storage.get("glicko_cfg", config).await?;
        let initial_r = cfg.as_ref().and_then(|c| c.get("initialRating").and_then(|v| v.as_f64())).unwrap_or(1500.0);
        let initial_d = cfg.as_ref().and_then(|c| c.get("initialDeviation").and_then(|v| v.as_f64())).unwrap_or(350.0);
        let initial_v = cfg.as_ref().and_then(|c| c.get("initialVolatility").and_then(|v| v.as_f64())).unwrap_or(0.06);

        let p_key = format!("{}:{}", config, participant);
        let o_key = format!("{}:{}", config, opponent);
        let p_rec = storage.get("glicko_rating", &p_key).await?;
        let o_rec = storage.get("glicko_rating", &o_key).await?;

        let r = p_rec.as_ref().and_then(|r| r.get("rating").and_then(|v| v.as_f64())).unwrap_or(initial_r);
        let rd = p_rec.as_ref().and_then(|r| r.get("deviation").and_then(|v| v.as_f64())).unwrap_or(initial_d);
        let sigma = p_rec.as_ref().and_then(|r| r.get("volatility").and_then(|v| v.as_f64())).unwrap_or(initial_v);
        let rj = o_rec.as_ref().and_then(|r| r.get("rating").and_then(|v| v.as_f64())).unwrap_or(initial_r);
        let rdj = o_rec.as_ref().and_then(|r| r.get("deviation").and_then(|v| v.as_f64())).unwrap_or(initial_d);

        let mu = (r - 1500.0) / 173.7178;
        let phi = rd / 173.7178;
        let mu_j = (rj - 1500.0) / 173.7178;
        let phi_j = rdj / 173.7178;

        let g_phi_j = Self::g(phi_j);
        let e = Self::expected(mu, mu_j, phi_j);
        let v = 1.0 / (g_phi_j * g_phi_j * e * (1.0 - e));
        let delta = v * g_phi_j * (outcome - e);

        // Simplified volatility update
        let new_sigma = sigma; // Full iterative algorithm omitted for brevity
        let phi_star = (phi * phi + new_sigma * new_sigma).sqrt();
        let new_phi = 1.0 / (1.0 / (phi_star * phi_star) + 1.0 / v).sqrt();
        let new_mu = mu + new_phi * new_phi * g_phi_j * (outcome - e);

        let new_rating = 173.7178 * new_mu + 1500.0;
        let new_deviation = 173.7178 * new_phi;
        let games = p_rec.as_ref().and_then(|r| r.get("gamesPlayed").and_then(|v| v.as_u64())).unwrap_or(0) + 1;

        storage.put("glicko_rating", &p_key, json!({
            "config": config, "participant": participant, "rating": new_rating, "deviation": new_deviation,
            "volatility": new_sigma, "gamesPlayed": games,
        })).await?;

        Ok(json!({ "variant": "updated", "participant": participant, "newRating": new_rating, "newDeviation": new_deviation }))
    }

    pub async fn get_reliable_weight(config: &str, participant: &str, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let cfg = storage.get("glicko_cfg", config).await?;
        let initial_r = cfg.as_ref().and_then(|c| c.get("initialRating").and_then(|v| v.as_f64())).unwrap_or(1500.0);
        let initial_d = cfg.as_ref().and_then(|c| c.get("initialDeviation").and_then(|v| v.as_f64())).unwrap_or(350.0);

        let key = format!("{}:{}", config, participant);
        let rec = storage.get("glicko_rating", &key).await?;
        let rating = rec.as_ref().and_then(|r| r.get("rating").and_then(|v| v.as_f64())).unwrap_or(initial_r);
        let deviation = rec.as_ref().and_then(|r| r.get("deviation").and_then(|v| v.as_f64())).unwrap_or(initial_d);
        let reliability = (1.0 - deviation / initial_d).max(0.0);

        Ok(json!({ "variant": "weight", "participant": participant, "rating": rating, "deviation": deviation, "reliability": reliability }))
    }
}
