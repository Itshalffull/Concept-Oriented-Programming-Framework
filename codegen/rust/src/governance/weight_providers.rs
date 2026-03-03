// Weight Source Provider Implementations
//
// TokenBalance, ReputationWeight, StakeWeight, EqualWeight, VoteEscrow, QuadraticWeight

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

// ══════════════════════════════════════════════════════════════
//  TokenBalance
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenBalanceConfigureInput {
    pub token_contract: String,
    pub snapshot_block: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenBalanceSetBalanceInput {
    pub config: String,
    pub participant: String,
    pub balance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenBalanceGetBalanceInput {
    pub config: String,
    pub participant: String,
    pub snapshot: Option<String>,
}

pub struct TokenBalanceHandler;

impl TokenBalanceHandler {
    pub async fn configure(
        input: &TokenBalanceConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("tb-cfg-{}", chrono::Utc::now().timestamp_millis());
        storage.put("tb_cfg", &id, json!({
            "id": id,
            "tokenContract": input.token_contract,
            "snapshotBlock": input.snapshot_block,
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn set_balance(
        input: &TokenBalanceSetBalanceInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let key = format!("{}:{}", input.config, input.participant);
        storage.put("tb_balance", &key, json!({
            "config": input.config,
            "participant": input.participant,
            "balance": input.balance,
        })).await?;
        Ok(json!({ "variant": "updated", "participant": input.participant, "balance": input.balance }))
    }

    pub async fn get_balance(
        input: &TokenBalanceGetBalanceInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        if let Some(ref snapshot) = input.snapshot {
            let snap = storage.get("tb_snapshot", snapshot).await?;
            if let Some(snap) = snap {
                let balances = snap.get("balances").and_then(|b| b.as_object());
                let balance = balances
                    .and_then(|b| b.get(&input.participant))
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);
                return Ok(json!({ "variant": "balance", "participant": input.participant, "balance": balance }));
            }
            return Ok(json!({ "variant": "not_found", "snapshot": snapshot }));
        }
        let key = format!("{}:{}", input.config, input.participant);
        let record = storage.get("tb_balance", &key).await?;
        let balance = record.and_then(|r| r.get("balance").and_then(|v| v.as_f64())).unwrap_or(0.0);
        Ok(json!({ "variant": "balance", "participant": input.participant, "balance": balance }))
    }
}

// ══════════════════════════════════════════════════════════════
//  ReputationWeight
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationWeightConfigureInput {
    pub scaling_function: Option<String>,
    pub cap: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationWeightComputeInput {
    pub config: String,
    pub participant: String,
    pub reputation_score: f64,
}

pub struct ReputationWeightHandler;

impl ReputationWeightHandler {
    fn apply_scaling(score: f64, function: &str, cap: Option<f64>) -> f64 {
        let scaled = match function {
            "log" => if score > 0.0 { (1.0 + score).ln() } else { 0.0 },
            "sigmoid" => 1.0 / (1.0 + (-score).exp()),
            _ => score, // linear
        };
        match cap {
            Some(c) if scaled > c => c,
            _ => scaled,
        }
    }

    pub async fn configure(
        input: &ReputationWeightConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("rw-cfg-{}", chrono::Utc::now().timestamp_millis());
        storage.put("rw_cfg", &id, json!({
            "id": id,
            "scalingFunction": input.scaling_function.as_deref().unwrap_or("linear"),
            "cap": input.cap,
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn compute(
        input: &ReputationWeightComputeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let cfg = storage.get("rw_cfg", &input.config).await?;
        let scaling_fn = cfg.as_ref()
            .and_then(|c| c.get("scalingFunction").and_then(|v| v.as_str()))
            .unwrap_or("linear");
        let cap = cfg.as_ref()
            .and_then(|c| c.get("cap").and_then(|v| v.as_f64()));
        let weight = Self::apply_scaling(input.reputation_score, scaling_fn, cap);
        Ok(json!({ "variant": "weight", "participant": input.participant, "weight": weight, "rawScore": input.reputation_score }))
    }
}

// ══════════════════════════════════════════════════════════════
//  StakeWeight
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StakeWeightConfigureInput {
    pub token: String,
    pub cooldown_days: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StakeWeightStakeInput {
    pub config: String,
    pub staker: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StakeWeightGetWeightInput {
    pub config: String,
    pub participant: String,
}

pub struct StakeWeightHandler;

impl StakeWeightHandler {
    pub async fn configure(
        input: &StakeWeightConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("sw-cfg-{}", chrono::Utc::now().timestamp_millis());
        storage.put("sw_cfg", &id, json!({
            "id": id,
            "token": input.token,
            "cooldownDays": input.cooldown_days.unwrap_or(0),
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn stake(
        input: &StakeWeightStakeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("stake-{}", chrono::Utc::now().timestamp_millis());
        storage.put("sw_stake", &id, json!({
            "id": id,
            "config": input.config,
            "staker": input.staker,
            "amount": input.amount,
            "status": "active",
        })).await?;
        Ok(json!({ "variant": "staked", "stake": id }))
    }

    pub async fn get_weight(
        input: &StakeWeightGetWeightInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let stakes = storage.find("sw_stake", Some(&json!({
            "config": input.config,
            "staker": input.participant,
        }))).await?;
        let total: f64 = stakes.iter()
            .filter(|s| s.get("status").and_then(|v| v.as_str()) == Some("active"))
            .filter_map(|s| s.get("amount").and_then(|v| v.as_f64()))
            .sum();
        Ok(json!({ "variant": "weight", "participant": input.participant, "stakedAmount": total }))
    }
}

// ══════════════════════════════════════════════════════════════
//  EqualWeight
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EqualWeightConfigureInput {
    pub weight_per_person: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EqualWeightGetWeightInput {
    pub config: String,
    pub participant: String,
}

pub struct EqualWeightHandler;

impl EqualWeightHandler {
    pub async fn configure(
        input: &EqualWeightConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("ew-cfg-{}", chrono::Utc::now().timestamp_millis());
        let weight = input.weight_per_person.unwrap_or(1.0);
        storage.put("ew_cfg", &id, json!({
            "id": id,
            "weightPerPerson": weight,
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn get_weight(
        input: &EqualWeightGetWeightInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let record = storage.get("ew_cfg", &input.config).await?;
        let weight = record
            .and_then(|r| r.get("weightPerPerson").and_then(|v| v.as_f64()))
            .unwrap_or(1.0);
        Ok(json!({ "variant": "weight", "participant": input.participant, "weight": weight }))
    }
}

// ══════════════════════════════════════════════════════════════
//  VoteEscrow
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteEscrowConfigureInput {
    pub token: String,
    pub max_lock_years: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteEscrowLockInput {
    pub config: String,
    pub locker: String,
    pub amount: f64,
    pub lock_years: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteEscrowGetWeightInput {
    pub config: String,
    pub participant: String,
}

pub struct VoteEscrowHandler;

impl VoteEscrowHandler {
    pub async fn configure(
        input: &VoteEscrowConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("ve-cfg-{}", chrono::Utc::now().timestamp_millis());
        let max_years = input.max_lock_years.unwrap_or(4.0);
        storage.put("ve_cfg", &id, json!({
            "id": id,
            "token": input.token,
            "maxLockYears": max_years,
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn lock(
        input: &VoteEscrowLockInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let cfg = storage.get("ve_cfg", &input.config).await?;
        let max_years = cfg.as_ref()
            .and_then(|c| c.get("maxLockYears").and_then(|v| v.as_f64()))
            .unwrap_or(4.0);
        let years = input.lock_years.min(max_years);
        let ve_tokens = input.amount * (years / max_years);
        let id = format!("lock-{}", chrono::Utc::now().timestamp_millis());

        storage.put("ve_lock", &id, json!({
            "id": id,
            "config": input.config,
            "locker": input.locker,
            "amount": input.amount,
            "lockYears": years,
            "veTokens": ve_tokens,
        })).await?;
        Ok(json!({ "variant": "locked", "lock": id, "veTokens": ve_tokens }))
    }

    pub async fn get_weight(
        input: &VoteEscrowGetWeightInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let locks = storage.find("ve_lock", Some(&json!({
            "config": input.config,
            "locker": input.participant,
        }))).await?;
        let total_ve: f64 = locks.iter()
            .filter_map(|l| l.get("veTokens").and_then(|v| v.as_f64()))
            .sum();
        Ok(json!({ "variant": "weight", "participant": input.participant, "veTokens": total_ve, "decayedWeight": total_ve }))
    }
}

// ══════════════════════════════════════════════════════════════
//  QuadraticWeight
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuadraticWeightConfigureInput {
    pub base_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuadraticWeightComputeInput {
    pub config: String,
    pub participant: String,
    pub balance: f64,
}

pub struct QuadraticWeightHandler;

impl QuadraticWeightHandler {
    pub async fn configure(
        input: &QuadraticWeightConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("qw-cfg-{}", chrono::Utc::now().timestamp_millis());
        storage.put("qw_cfg", &id, json!({
            "id": id,
            "baseSource": input.base_source,
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn compute(
        input: &QuadraticWeightComputeInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let weight = input.balance.sqrt();
        Ok(json!({ "variant": "weight", "participant": input.participant, "balance": input.balance, "sqrtWeight": weight }))
    }
}
