// Finality Provider Implementations
//
// ImmediateFinality, ChainFinality, BftFinality, OptimisticOracleFinality

use crate::storage::{ConceptStorage, StorageResult};
use serde_json::{json, Value};

// ══════════════════════════════════════════════════════════════
//  ImmediateFinality
// ══════════════════════════════════════════════════════════════

pub struct ImmediateFinalityHandler;

impl ImmediateFinalityHandler {
    pub async fn confirm(operation_ref: &str, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        // Duplicate check
        let existing = storage.find("imm_final", Some(&json!({ "operationRef": operation_ref }))).await?;
        if !existing.is_empty() {
            let id = existing[0].get("id").and_then(|v| v.as_str()).unwrap_or("");
            return Ok(json!({ "variant": "already_finalized", "confirmation": id }));
        }

        let id = format!("imm-{}", chrono::Utc::now().timestamp_millis());
        storage.put("imm_final", &id, json!({
            "id": id, "operationRef": operation_ref,
        })).await?;
        Ok(json!({ "variant": "finalized", "confirmation": id }))
    }
}

// ══════════════════════════════════════════════════════════════
//  ChainFinality
// ══════════════════════════════════════════════════════════════

pub struct ChainFinalityHandler;

impl ChainFinalityHandler {
    pub async fn track(
        operation_ref: &str,
        tx_hash: &str,
        chain_id: &str,
        required_confirmations: u64,
        submitted_block: u64,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("chain-{}", chrono::Utc::now().timestamp_millis());
        storage.put("chain_final", &id, json!({
            "id": id, "operationRef": operation_ref, "txHash": tx_hash,
            "chainId": chain_id, "requiredConfirmations": required_confirmations,
            "submittedBlock": submitted_block, "status": "Pending",
        })).await?;
        Ok(json!({ "variant": "tracking", "entry": id }))
    }

    pub async fn check_finality(entry: &str, current_block: u64, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let record = storage.get("chain_final", entry).await?;
        if record.is_none() { return Ok(json!({ "variant": "not_found", "entry": entry })); }
        let rec = record.unwrap();

        let required = rec.get("requiredConfirmations").and_then(|v| v.as_u64()).unwrap_or(12);
        let submitted = rec.get("submittedBlock").and_then(|v| v.as_u64()).unwrap_or(0);
        let confirmations = if current_block > submitted { current_block - submitted } else { 0 };

        if confirmations >= required {
            let mut updated = rec.clone();
            updated["status"] = json!("Finalized");
            storage.put("chain_final", entry, updated).await?;
            Ok(json!({ "variant": "finalized", "entry": entry, "currentConfirmations": confirmations, "required": required }))
        } else {
            Ok(json!({ "variant": "pending", "entry": entry, "currentConfirmations": confirmations, "required": required }))
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  BftFinality
// ══════════════════════════════════════════════════════════════

pub struct BftFinalityHandler;

impl BftFinalityHandler {
    pub async fn configure_committee(
        validators: &[String],
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("bft-{}", chrono::Utc::now().timestamp_millis());
        storage.put("bft", &id, json!({
            "id": id, "validators": validators, "validatorCount": validators.len(),
        })).await?;
        Ok(json!({ "variant": "configured", "committee": id }))
    }

    pub async fn propose_finality(
        committee: &str,
        operation_ref: &str,
        proposer: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let record = storage.get("bft", committee).await?;
        if record.is_none() { return Ok(json!({ "variant": "not_found", "committee": committee })); }

        let round = chrono::Utc::now().timestamp_millis();
        let key = format!("{}:{}", committee, round);
        storage.put("bft_round", &key, json!({
            "committee": committee, "roundNumber": round, "operationRef": operation_ref,
            "proposer": proposer, "votes": {}, "status": "proposed",
        })).await?;
        Ok(json!({ "variant": "proposed", "committee": committee, "roundNumber": round }))
    }

    pub async fn vote(
        committee: &str,
        round_number: i64,
        validator: &str,
        approve: bool,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let key = format!("{}:{}", committee, round_number);
        let round = storage.get("bft_round", &key).await?;
        if round.is_none() { return Ok(json!({ "variant": "not_found", "committee": committee })); }
        let mut round = round.unwrap();

        let rec = storage.get("bft", committee).await?;
        if rec.is_none() { return Ok(json!({ "variant": "not_found", "committee": committee })); }
        let validators = rec.unwrap().get("validators").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        if !validators.iter().any(|v| v.as_str() == Some(validator)) {
            return Ok(json!({ "variant": "not_a_validator", "validator": validator }));
        }

        let votes = round.get_mut("votes").unwrap();
        votes[validator] = json!(approve);
        storage.put("bft_round", &key, round).await?;
        Ok(json!({ "variant": "voted", "committee": committee, "roundNumber": round_number, "validator": validator }))
    }

    pub async fn check_consensus(
        committee: &str,
        round_number: i64,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let key = format!("{}:{}", committee, round_number);
        let round = storage.get("bft_round", &key).await?;
        if round.is_none() { return Ok(json!({ "variant": "not_found", "committee": committee })); }
        let round = round.unwrap();

        let rec = storage.get("bft", committee).await?;
        let validator_count = rec.as_ref()
            .and_then(|r| r.get("validatorCount").and_then(|v| v.as_u64()))
            .unwrap_or(0);
        let required = ((validator_count * 2) as f64 / 3.0).ceil() as u64;

        let votes = round.get("votes").and_then(|v| v.as_object()).cloned().unwrap_or_default();
        let approvals = votes.values().filter(|v| v.as_bool() == Some(true)).count() as u64;
        let rejections = votes.values().filter(|v| v.as_bool() == Some(false)).count() as u64;

        if approvals >= required {
            Ok(json!({ "variant": "finalized", "committee": committee, "currentVotes": approvals, "required": required }))
        } else if rejections > validator_count - required {
            Ok(json!({ "variant": "rejected", "committee": committee, "rejections": rejections, "required": required }))
        } else {
            Ok(json!({ "variant": "insufficient", "committee": committee, "currentVotes": approvals, "required": required }))
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  OptimisticOracleFinality
// ══════════════════════════════════════════════════════════════

pub struct OptimisticOracleFinalityHandler;

impl OptimisticOracleFinalityHandler {
    pub async fn assert_finality(
        operation_ref: &str,
        asserter: &str,
        bond: f64,
        challenge_window_hours: f64,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("oo-{}", chrono::Utc::now().timestamp_millis());
        let expires_ms = chrono::Utc::now().timestamp_millis() + (challenge_window_hours * 3600000.0) as i64;
        storage.put("oo_final", &id, json!({
            "id": id, "operationRef": operation_ref, "asserter": asserter,
            "bond": bond, "expiresAtMs": expires_ms, "status": "Pending",
            "challenger": null, "challengeBond": null,
        })).await?;
        Ok(json!({ "variant": "asserted", "assertion": id }))
    }

    pub async fn challenge(assertion: &str, challenger: &str, bond: Option<f64>, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let record = storage.get("oo_final", assertion).await?;
        if record.is_none() { return Ok(json!({ "variant": "not_found", "assertion": assertion })); }
        let mut rec = record.unwrap();

        if rec.get("status").and_then(|v| v.as_str()) != Some("Pending") {
            return Ok(json!({ "variant": "not_pending", "assertion": assertion }));
        }

        rec["status"] = json!("Challenged");
        rec["challenger"] = json!(challenger);
        rec["challengeBond"] = json!(bond.unwrap_or(rec.get("bond").and_then(|v| v.as_f64()).unwrap_or(0.0)));
        storage.put("oo_final", assertion, rec).await?;
        Ok(json!({ "variant": "challenged", "assertion": assertion }))
    }

    pub async fn resolve(assertion: &str, valid_assertion: bool, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let record = storage.get("oo_final", assertion).await?;
        if record.is_none() { return Ok(json!({ "variant": "not_found", "assertion": assertion })); }
        let mut rec = record.unwrap();

        let bond = rec.get("bond").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let challenge_bond = rec.get("challengeBond").and_then(|v| v.as_f64()).unwrap_or(0.0);

        if valid_assertion {
            rec["status"] = json!("Finalized");
            rec["bondRecipient"] = rec.get("asserter").cloned().unwrap_or(json!(null));
            storage.put("oo_final", assertion, rec).await?;
            Ok(json!({ "variant": "finalized", "assertion": assertion, "totalBond": bond + challenge_bond }))
        } else {
            rec["status"] = json!("Rejected");
            rec["bondRecipient"] = rec.get("challenger").cloned().unwrap_or(json!(null));
            storage.put("oo_final", assertion, rec).await?;
            Ok(json!({ "variant": "rejected", "assertion": assertion, "totalBond": bond + challenge_bond }))
        }
    }
}
