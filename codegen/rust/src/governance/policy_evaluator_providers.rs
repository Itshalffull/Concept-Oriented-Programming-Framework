// Policy Evaluator Provider Implementations
//
// CustomEvaluator, AdicoEvaluator, CedarEvaluator, RegoEvaluator

use crate::storage::{ConceptStorage, StorageResult};
use serde_json::{json, Value};

// ══════════════════════════════════════════════════════════════
//  Shared predicate evaluation
// ══════════════════════════════════════════════════════════════

fn resolve_path(path: &str, obj: &Value) -> Option<Value> {
    let mut current = obj;
    for part in path.split('.') {
        current = current.get(part)?;
    }
    Some(current.clone())
}

fn evaluate_predicate(node: &Value, context: &Value) -> bool {
    let op = node.get("op").and_then(|v| v.as_str()).unwrap_or("");

    match op {
        "and" => {
            node.get("args").and_then(|a| a.as_array())
                .map(|args| args.iter().all(|arg| evaluate_predicate(arg, context)))
                .unwrap_or(false)
        }
        "or" => {
            node.get("args").and_then(|a| a.as_array())
                .map(|args| args.iter().any(|arg| evaluate_predicate(arg, context)))
                .unwrap_or(false)
        }
        "not" => {
            node.get("args").and_then(|a| a.as_array())
                .and_then(|args| args.first())
                .map(|arg| !evaluate_predicate(arg, context))
                .unwrap_or(false)
        }
        "eq" => {
            let field = node.get("field").and_then(|v| v.as_str()).unwrap_or("");
            let value = node.get("value");
            resolve_path(field, context).as_ref() == value
        }
        "neq" => {
            let field = node.get("field").and_then(|v| v.as_str()).unwrap_or("");
            let value = node.get("value");
            resolve_path(field, context).as_ref() != value
        }
        "gt" => {
            let field = node.get("field").and_then(|v| v.as_str()).unwrap_or("");
            let value = node.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
            resolve_path(field, context).and_then(|v| v.as_f64()).unwrap_or(0.0) > value
        }
        "gte" => {
            let field = node.get("field").and_then(|v| v.as_str()).unwrap_or("");
            let value = node.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
            resolve_path(field, context).and_then(|v| v.as_f64()).unwrap_or(0.0) >= value
        }
        "lt" => {
            let field = node.get("field").and_then(|v| v.as_str()).unwrap_or("");
            let value = node.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
            resolve_path(field, context).and_then(|v| v.as_f64()).unwrap_or(0.0) < value
        }
        "in" => {
            let field = node.get("field").and_then(|v| v.as_str()).unwrap_or("");
            let value = node.get("value").and_then(|v| v.as_array());
            let resolved = resolve_path(field, context);
            match (resolved, value) {
                (Some(v), Some(list)) => list.contains(&v),
                _ => false,
            }
        }
        "contains" => {
            let field = node.get("field").and_then(|v| v.as_str()).unwrap_or("");
            let value = node.get("value");
            let arr = resolve_path(field, context);
            match (arr, value) {
                (Some(Value::Array(arr)), Some(v)) => arr.contains(v),
                _ => false,
            }
        }
        _ => false,
    }
}

// ══════════════════════════════════════════════════════════════
//  CustomEvaluator
// ══════════════════════════════════════════════════════════════

pub struct CustomEvaluatorHandler;

impl CustomEvaluatorHandler {
    pub async fn register(name: &str, source: &Value, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let id = format!("custom-{}", chrono::Utc::now().timestamp_millis());
        storage.put("custom_eval", &id, json!({ "id": id, "name": name, "predicateTree": source })).await?;
        Ok(json!({ "variant": "registered", "evaluator": id }))
    }

    pub async fn evaluate(evaluator: &str, context: &Value, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let record = storage.get("custom_eval", evaluator).await?;
        if record.is_none() { return Ok(json!({ "variant": "not_found", "evaluator": evaluator })); }
        let rec = record.unwrap();
        let tree = rec.get("predicateTree").unwrap_or(&json!({}));
        let result = evaluate_predicate(tree, context);
        Ok(json!({ "variant": "result", "evaluator": evaluator, "output": result, "decision": if result { "allow" } else { "deny" } }))
    }

    pub async fn deregister(evaluator: &str, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        storage.del("custom_eval", evaluator).await?;
        Ok(json!({ "variant": "deregistered", "evaluator": evaluator }))
    }
}

// ══════════════════════════════════════════════════════════════
//  CedarEvaluator
// ══════════════════════════════════════════════════════════════

pub struct CedarEvaluatorHandler;

impl CedarEvaluatorHandler {
    pub async fn load_policies(policies: &Value, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let id = format!("cedar-{}", chrono::Utc::now().timestamp_millis());
        storage.put("cedar", &id, json!({ "id": id, "policies": policies })).await?;
        Ok(json!({ "variant": "loaded", "store": id }))
    }

    pub async fn authorize(store: &str, principal: &str, action: &str, resource: &str, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let record = storage.get("cedar", store).await?;
        if record.is_none() { return Ok(json!({ "variant": "not_found", "store": store })); }
        let rec = record.unwrap();
        let policies = rec.get("policies").and_then(|v| v.as_array()).cloned().unwrap_or_default();

        let mut has_permit = false;
        for policy in &policies {
            let p_effect = policy.get("effect").and_then(|v| v.as_str()).unwrap_or("");
            let p_principal = policy.get("principal").and_then(|v| v.as_str()).unwrap_or("*");
            let p_action = policy.get("action").and_then(|v| v.as_str()).unwrap_or("*");
            let p_resource = policy.get("resource").and_then(|v| v.as_str()).unwrap_or("*");

            let matches = (p_principal == "*" || p_principal == principal)
                && (p_action == "*" || p_action == action)
                && (p_resource == "*" || p_resource == resource);

            if !matches { continue; }
            if p_effect == "forbid" {
                return Ok(json!({ "variant": "deny", "store": store, "reason": "Forbidden by policy" }));
            }
            if p_effect == "permit" { has_permit = true; }
        }

        if has_permit {
            Ok(json!({ "variant": "allow", "store": store }))
        } else {
            Ok(json!({ "variant": "deny", "store": store, "reason": "No matching permit policy" }))
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  AdicoEvaluator
// ══════════════════════════════════════════════════════════════

pub struct AdicoEvaluatorHandler;

impl AdicoEvaluatorHandler {
    pub async fn parse(rule_text: &str, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let id = format!("adico-{}", chrono::Utc::now().timestamp_millis());
        // Parse A(attrs) D(deontic) I(aim) C(conditions) [O(orElse)]
        // Simplified: store raw text, structured fields expected in input
        storage.put("adico", &id, json!({ "id": id, "sourceText": rule_text })).await?;
        Ok(json!({ "variant": "parsed", "rule": id }))
    }

    pub async fn evaluate(rule: &str, context: &Value, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let record = storage.get("adico", rule).await?;
        if record.is_none() { return Ok(json!({ "variant": "not_found", "rule": rule })); }
        let rec = record.unwrap();
        let deontic = rec.get("deontic").and_then(|v| v.as_str()).unwrap_or("may");

        match deontic {
            "must" => Ok(json!({ "variant": "obligated", "rule": rule })),
            "must not" => Ok(json!({ "variant": "forbidden", "rule": rule })),
            "should" => Ok(json!({ "variant": "recommended", "rule": rule })),
            _ => Ok(json!({ "variant": "permitted", "rule": rule })),
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  RegoEvaluator
// ══════════════════════════════════════════════════════════════

pub struct RegoEvaluatorHandler;

impl RegoEvaluatorHandler {
    pub async fn load_bundle(policy_source: &Value, data_source: &Value, package_name: &str, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let id = format!("rego-{}", chrono::Utc::now().timestamp_millis());
        storage.put("rego", &id, json!({
            "id": id, "rules": policy_source, "data": data_source, "packageName": package_name,
        })).await?;
        Ok(json!({ "variant": "loaded", "bundle": id }))
    }

    pub async fn evaluate(bundle: &str, eval_input: &Value, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let record = storage.get("rego", bundle).await?;
        if record.is_none() { return Ok(json!({ "variant": "not_found", "bundle": bundle })); }
        let rec = record.unwrap();
        let rules = rec.get("rules").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        let data = rec.get("data").cloned().unwrap_or(json!({}));

        let mut bindings = json!({});
        let mut decision = "deny";

        for rule in &rules {
            let name = rule.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let body = rule.get("body").and_then(|v| v.as_array()).cloned().unwrap_or_default();

            let mut pass = true;
            for clause in &body {
                let op = clause.get("op").and_then(|v| v.as_str()).unwrap_or("");
                let path = clause.get("path").and_then(|v| v.as_str()).unwrap_or("");
                let value = clause.get("value");

                let resolved = if path.starts_with("data.") {
                    resolve_path(&path[5..], &data)
                } else {
                    resolve_path(path, eval_input)
                };

                match op {
                    "eq" => if resolved.as_ref() != value { pass = false; break; },
                    "neq" => if resolved.as_ref() == value { pass = false; break; },
                    "exists" => if resolved.is_none() { pass = false; break; },
                    "in" => {
                        let list = if let Some(dp) = clause.get("dataPath").and_then(|v| v.as_str()) {
                            resolve_path(dp, &data)
                        } else {
                            value.cloned()
                        };
                        match (resolved.as_ref(), list.and_then(|l| if l.is_array() { Some(l) } else { None })) {
                            (Some(v), Some(Value::Array(list))) => if !list.contains(v) { pass = false; break; },
                            _ => { pass = false; break; }
                        }
                    }
                    _ => { pass = false; break; }
                }
            }

            bindings[name] = json!(pass);
            if name == "allow" && pass { decision = "allow"; }
        }

        Ok(json!({ "variant": "result", "decision": decision, "bindings": bindings }))
    }

    pub async fn update_data(bundle: &str, new_data: &Value, storage: &dyn ConceptStorage) -> StorageResult<Value> {
        let record = storage.get("rego", bundle).await?;
        if record.is_none() { return Ok(json!({ "variant": "not_found", "bundle": bundle })); }
        let mut rec = record.unwrap();
        let existing = rec.get("data").cloned().unwrap_or(json!({}));
        if let (Value::Object(mut existing_map), Value::Object(new_map)) = (existing, new_data.clone()) {
            for (k, v) in new_map { existing_map.insert(k, v); }
            rec["data"] = Value::Object(existing_map);
        }
        storage.put("rego", bundle, rec).await?;
        Ok(json!({ "variant": "updated", "bundle": bundle }))
    }
}
