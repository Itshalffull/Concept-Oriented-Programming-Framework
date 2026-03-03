// Sybil Resistance Provider Implementations
//
// ProofOfPersonhood, StakeThreshold, SocialGraphVerification, AttestationSybil

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

// ══════════════════════════════════════════════════════════════
//  ProofOfPersonhood
// ══════════════════════════════════════════════════════════════

pub struct ProofOfPersonhoodHandler;

impl ProofOfPersonhoodHandler {
    pub async fn request_verification(
        candidate: &str,
        method: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("pop-{}", chrono::Utc::now().timestamp_millis());
        storage.put("pop", &id, json!({
            "id": id, "candidate": candidate, "method": method, "status": "Pending",
        })).await?;
        Ok(json!({ "variant": "verification_requested", "verification": id }))
    }

    pub async fn confirm_verification(
        verification: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let record = storage.get("pop", verification).await?;
        if record.is_none() { return Ok(json!({ "variant": "not_found", "verification": verification })); }
        let mut rec = record.unwrap();
        rec["status"] = json!("Verified");
        let candidate = rec.get("candidate").and_then(|v| v.as_str()).unwrap_or("").to_string();
        storage.put("pop", verification, rec).await?;
        Ok(json!({ "variant": "verified", "verification": verification, "candidate": candidate }))
    }

    pub async fn reject_verification(
        verification: &str,
        reason: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let record = storage.get("pop", verification).await?;
        if record.is_none() { return Ok(json!({ "variant": "not_found", "verification": verification })); }
        let mut rec = record.unwrap();
        rec["status"] = json!("Rejected");
        rec["rejectionReason"] = json!(reason);
        storage.put("pop", verification, rec).await?;
        Ok(json!({ "variant": "rejected", "verification": verification, "reason": reason }))
    }
}

// ══════════════════════════════════════════════════════════════
//  StakeThreshold
// ══════════════════════════════════════════════════════════════

pub struct StakeThresholdHandler;

impl StakeThresholdHandler {
    pub async fn configure(
        minimum_stake: f64,
        token: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("stake-cfg-{}", chrono::Utc::now().timestamp_millis());
        storage.put("stake_cfg", &id, json!({
            "id": id, "minimumStake": minimum_stake, "token": token,
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn deposit(
        config: &str,
        candidate: &str,
        amount: f64,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let key = format!("{}:{}", config, candidate);
        let existing = storage.get("stake_balance", &key).await?;
        let current = existing.and_then(|r| r.get("balance").and_then(|v| v.as_f64())).unwrap_or(0.0);
        let new_balance = current + amount;
        storage.put("stake_balance", &key, json!({
            "config": config, "candidate": candidate, "balance": new_balance,
        })).await?;
        Ok(json!({ "variant": "deposited", "candidate": candidate, "balance": new_balance }))
    }

    pub async fn check(
        config: &str,
        candidate: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let cfg = storage.get("stake_cfg", config).await?;
        let minimum = cfg.as_ref().and_then(|c| c.get("minimumStake").and_then(|v| v.as_f64())).unwrap_or(0.0);
        let key = format!("{}:{}", config, candidate);
        let balance_rec = storage.get("stake_balance", &key).await?;
        let balance = balance_rec.and_then(|r| r.get("balance").and_then(|v| v.as_f64())).unwrap_or(0.0);

        if balance >= minimum {
            Ok(json!({ "variant": "qualified", "candidate": candidate, "balance": balance, "minimumStake": minimum }))
        } else {
            Ok(json!({ "variant": "insufficient", "candidate": candidate, "balance": balance, "minimumStake": minimum, "shortfall": minimum - balance }))
        }
    }

    pub async fn slash(
        config: &str,
        candidate: &str,
        amount: f64,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let key = format!("{}:{}", config, candidate);
        let existing = storage.get("stake_balance", &key).await?;
        if existing.is_none() { return Ok(json!({ "variant": "no_balance", "candidate": candidate })); }
        let current = existing.unwrap().get("balance").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let slash = amount.min(current);
        let new_balance = current - slash;
        storage.put("stake_balance", &key, json!({
            "config": config, "candidate": candidate, "balance": new_balance,
        })).await?;
        Ok(json!({ "variant": "slashed", "candidate": candidate, "slashedAmount": slash, "remainingBalance": new_balance }))
    }
}

// ══════════════════════════════════════════════════════════════
//  SocialGraphVerification
// ══════════════════════════════════════════════════════════════

pub struct SocialGraphVerificationHandler;

impl SocialGraphVerificationHandler {
    pub async fn configure(
        minimum_vouchers: u32,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("sg-cfg-{}", chrono::Utc::now().timestamp_millis());
        storage.put("sg_cfg", &id, json!({
            "id": id, "minimumVouchers": minimum_vouchers, "trustAlgorithm": "count",
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn add_vouch(
        config: &str,
        voucher: &str,
        candidate: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        if voucher == candidate {
            return Ok(json!({ "variant": "self_vouch", "voucher": voucher }));
        }
        let key = format!("{}:{}:{}", config, voucher, candidate);
        let existing = storage.get("sg_vouch", &key).await?;
        if existing.is_some() {
            return Ok(json!({ "variant": "already_vouched", "voucher": voucher, "candidate": candidate }));
        }
        storage.put("sg_vouch", &key, json!({
            "config": config, "voucher": voucher, "candidate": candidate,
        })).await?;
        Ok(json!({ "variant": "vouched", "voucher": voucher, "candidate": candidate }))
    }

    pub async fn verify(
        config: &str,
        candidate: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let cfg = storage.get("sg_cfg", config).await?;
        let min_vouchers = cfg.as_ref()
            .and_then(|c| c.get("minimumVouchers").and_then(|v| v.as_u64()))
            .unwrap_or(3) as usize;

        let vouches = storage.find("sg_vouch", Some(&json!({
            "config": config, "candidate": candidate,
        }))).await?;
        let count = vouches.len();
        let trust_score = count as f64 / min_vouchers as f64;

        if count >= min_vouchers {
            Ok(json!({ "variant": "verified", "candidate": candidate, "voucherCount": count, "trustScore": trust_score }))
        } else {
            Ok(json!({ "variant": "insufficient", "candidate": candidate, "voucherCount": count, "required": min_vouchers, "trustScore": trust_score }))
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  AttestationSybil
// ══════════════════════════════════════════════════════════════

pub struct AttestationSybilHandler;

impl AttestationSybilHandler {
    pub async fn configure(
        required_schema: &str,
        required_attester: Option<&str>,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let id = format!("att-sybil-{}", chrono::Utc::now().timestamp_millis());
        storage.put("att_sybil", &id, json!({
            "id": id, "requiredSchema": required_schema, "requiredAttester": required_attester,
        })).await?;
        Ok(json!({ "variant": "configured", "config": id }))
    }

    pub async fn submit_attestation(
        config: &str,
        candidate: &str,
        attestation_ref: &str,
        schema: &str,
        attester: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let key = format!("{}:{}", config, candidate);
        storage.put("att_sybil_credential", &key, json!({
            "config": config, "candidate": candidate, "attestationRef": attestation_ref,
            "schema": schema, "attester": attester,
        })).await?;
        Ok(json!({ "variant": "submitted", "candidate": candidate, "attestationRef": attestation_ref }))
    }

    pub async fn verify(
        config: &str,
        candidate: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Value> {
        let cfg = storage.get("att_sybil", config).await?;
        if cfg.is_none() { return Ok(json!({ "variant": "not_found", "config": config })); }
        let cfg = cfg.unwrap();

        let key = format!("{}:{}", config, candidate);
        let credential = storage.get("att_sybil_credential", &key).await?;
        if credential.is_none() { return Ok(json!({ "variant": "no_attestation", "candidate": candidate })); }
        let credential = credential.unwrap();

        let required_schema = cfg.get("requiredSchema").and_then(|v| v.as_str());
        let cred_schema = credential.get("schema").and_then(|v| v.as_str());
        if let (Some(req), Some(actual)) = (required_schema, cred_schema) {
            if req != actual {
                return Ok(json!({ "variant": "schema_mismatch", "candidate": candidate, "expected": req, "actual": actual }));
            }
        }

        let required_attester = cfg.get("requiredAttester").and_then(|v| v.as_str());
        let cred_attester = credential.get("attester").and_then(|v| v.as_str());
        if let (Some(req), Some(actual)) = (required_attester, cred_attester) {
            if req != actual {
                return Ok(json!({ "variant": "attester_mismatch", "candidate": candidate, "expected": req, "actual": actual }));
            }
        }

        let att_ref = credential.get("attestationRef").and_then(|v| v.as_str()).unwrap_or("");
        Ok(json!({ "variant": "verified", "candidate": candidate, "attestationRef": att_ref }))
    }
}
