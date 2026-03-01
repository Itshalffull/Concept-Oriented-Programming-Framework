// Validator handler implementation
// Constraint registration, field rule validation, custom validators,
// and per-field validation with rules like required, email, string,
// number, min:N, max:N.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ValidatorHandler;
use serde_json::{json, Value};

pub struct ValidatorHandlerImpl;

#[async_trait]
impl ValidatorHandler for ValidatorHandlerImpl {
    async fn register_constraint(
        &self,
        input: ValidatorRegisterConstraintInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ValidatorRegisterConstraintOutput, Box<dyn std::error::Error>> {
        let validator = &input.validator;
        let constraint = &input.constraint;

        let entry = storage.get("validator", validator).await?;
        let mut constraints: Vec<String> = if let Some(ref e) = entry {
            serde_json::from_value(e.get("constraints").cloned().unwrap_or(json!([]))).unwrap_or_default()
        } else {
            Vec::new()
        };

        if constraints.contains(constraint) {
            return Ok(ValidatorRegisterConstraintOutput::Exists);
        }

        constraints.push(constraint.clone());

        let field_rules = entry.as_ref()
            .and_then(|e| e.get("fieldRules").cloned())
            .unwrap_or(json!({}));
        let custom_validators = entry.as_ref()
            .and_then(|e| e.get("customValidators").cloned())
            .unwrap_or(json!({}));

        storage.put("validator", validator, json!({
            "validator": validator,
            "constraints": constraints,
            "fieldRules": field_rules,
            "customValidators": custom_validators,
        })).await?;

        Ok(ValidatorRegisterConstraintOutput::Ok)
    }

    async fn add_rule(
        &self,
        input: ValidatorAddRuleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ValidatorAddRuleOutput, Box<dyn std::error::Error>> {
        let validator = &input.validator;
        let field = &input.field;
        let rule = &input.rule;

        let entry = storage.get("validator", validator).await?;
        let entry = match entry {
            Some(e) => e,
            None => return Ok(ValidatorAddRuleOutput::Notfound),
        };

        let mut field_rules: serde_json::Map<String, Value> = entry
            .get("fieldRules")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();

        field_rules.insert(field.clone(), json!(rule));

        let mut updated = entry.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("fieldRules".to_string(), Value::Object(field_rules));
        }
        storage.put("validator", validator, updated).await?;

        Ok(ValidatorAddRuleOutput::Ok)
    }

    async fn validate(
        &self,
        input: ValidatorValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ValidatorValidateOutput, Box<dyn std::error::Error>> {
        let validator_name = &input.validator;
        let data = &input.data;

        let entry = storage.get("validator", validator_name).await?;
        let constraints: Vec<String> = entry.as_ref()
            .and_then(|e| e.get("constraints"))
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();
        let field_rules: serde_json::Map<String, Value> = entry.as_ref()
            .and_then(|e| e.get("fieldRules"))
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();

        let parsed: Value = serde_json::from_str(data)?;
        let parsed_obj = parsed.as_object();
        let mut errors: Vec<String> = Vec::new();

        // Validate each field against its rules
        for (field, rule_val) in &field_rules {
            let rule_str = rule_val.as_str().unwrap_or("");
            let rules: Vec<&str> = rule_str.split('|').map(|r| r.trim()).collect();
            let value = parsed_obj.and_then(|o| o.get(field));

            for rule in &rules {
                if *rule == "required" {
                    if value.is_none() || value == Some(&Value::Null) || value == Some(&json!("")) {
                        errors.push(format!("{} is required", field));
                    }
                }
                if *rule == "email" {
                    if let Some(Value::String(s)) = value {
                        if !s.is_empty() && !s.contains('@') {
                            errors.push(format!("{} must be a valid email", field));
                        }
                    }
                }
                if *rule == "string" {
                    if let Some(v) = value {
                        if !v.is_null() && !v.is_string() {
                            errors.push(format!("{} must be a string", field));
                        }
                    }
                }
                if *rule == "number" {
                    if let Some(v) = value {
                        if !v.is_null() && !v.is_number() {
                            errors.push(format!("{} must be a number", field));
                        }
                    }
                }
                if rule.starts_with("min:") {
                    if let Some(Value::String(s)) = value {
                        if let Ok(min_len) = rule[4..].parse::<usize>() {
                            if s.len() < min_len {
                                errors.push(format!("{} must be at least {} characters", field, min_len));
                            }
                        }
                    }
                }
                if rule.starts_with("max:") {
                    if let Some(Value::String(s)) = value {
                        if let Ok(max_len) = rule[4..].parse::<usize>() {
                            if s.len() > max_len {
                                errors.push(format!("{} must be at most {} characters", field, max_len));
                            }
                        }
                    }
                }
            }
        }

        // Check global constraints
        for constraint in &constraints {
            if constraint == "required" {
                for field in field_rules.keys() {
                    let value = parsed_obj.and_then(|o| o.get(field));
                    if value.is_none() || value == Some(&Value::Null) || value == Some(&json!("")) {
                        let msg = format!("{} is required", field);
                        if !errors.contains(&msg) {
                            errors.push(msg);
                        }
                    }
                }
            }
        }

        let valid = errors.is_empty();
        let errors_str = if errors.is_empty() {
            String::new()
        } else {
            errors.join(", ")
        };

        Ok(ValidatorValidateOutput::Ok { valid, errors: errors_str })
    }

    async fn validate_field(
        &self,
        input: ValidatorValidateFieldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ValidatorValidateFieldOutput, Box<dyn std::error::Error>> {
        let field = &input.field;
        let value = &input.value;

        let entry = storage.get("validator", &input.validator).await?;
        let field_rules: serde_json::Map<String, Value> = entry.as_ref()
            .and_then(|e| e.get("fieldRules"))
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();

        let rule_str = field_rules.get(field)
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let rules: Vec<&str> = rule_str.split('|').map(|r| r.trim()).filter(|r| !r.is_empty()).collect();
        let mut errors: Vec<String> = Vec::new();

        for rule in &rules {
            if *rule == "required" && value.is_empty() {
                errors.push(format!("{} is required", field));
            }
            if *rule == "email" && !value.is_empty() && !value.contains('@') {
                errors.push(format!("{} must be a valid email", field));
            }
            if rule.starts_with("min:") {
                if let Ok(min_len) = rule[4..].parse::<usize>() {
                    if value.len() < min_len {
                        errors.push(format!("{} must be at least {} characters", field, min_len));
                    }
                }
            }
            if rule.starts_with("max:") {
                if let Ok(max_len) = rule[4..].parse::<usize>() {
                    if value.len() > max_len {
                        errors.push(format!("{} must be at most {} characters", field, max_len));
                    }
                }
            }
        }

        let valid = errors.is_empty();
        Ok(ValidatorValidateFieldOutput::Ok {
            valid,
            errors: serde_json::to_string(&errors)?,
        })
    }

    async fn add_custom_validator(
        &self,
        input: ValidatorAddCustomValidatorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ValidatorAddCustomValidatorOutput, Box<dyn std::error::Error>> {
        let validator_name = &input.validator;
        let name = &input.name;
        let implementation = &input.implementation;

        let entry = storage.get("validator", validator_name).await?;
        let mut custom_validators: serde_json::Map<String, Value> = entry.as_ref()
            .and_then(|e| e.get("customValidators"))
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();

        if custom_validators.contains_key(name) {
            return Ok(ValidatorAddCustomValidatorOutput::Exists);
        }

        custom_validators.insert(name.clone(), json!(implementation));

        if let Some(mut e) = entry {
            if let Some(obj) = e.as_object_mut() {
                obj.insert("customValidators".to_string(), Value::Object(custom_validators));
            }
            storage.put("validator", validator_name, e).await?;
        } else {
            storage.put("validator", validator_name, json!({
                "validator": validator_name,
                "constraints": [],
                "fieldRules": {},
                "customValidators": Value::Object(custom_validators),
            })).await?;
        }

        Ok(ValidatorAddCustomValidatorOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_constraint_success() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandlerImpl;
        let result = handler.register_constraint(
            ValidatorRegisterConstraintInput {
                validator: "v1".to_string(),
                constraint: "required".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ValidatorRegisterConstraintOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_constraint_exists() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandlerImpl;
        handler.register_constraint(
            ValidatorRegisterConstraintInput {
                validator: "v1".to_string(),
                constraint: "required".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register_constraint(
            ValidatorRegisterConstraintInput {
                validator: "v1".to_string(),
                constraint: "required".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ValidatorRegisterConstraintOutput::Exists => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_add_rule_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandlerImpl;
        let result = handler.add_rule(
            ValidatorAddRuleInput {
                validator: "nonexistent".to_string(),
                field: "email".to_string(),
                rule: "required|email".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ValidatorAddRuleOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_add_rule_success() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandlerImpl;
        handler.register_constraint(
            ValidatorRegisterConstraintInput {
                validator: "v1".to_string(),
                constraint: "required".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.add_rule(
            ValidatorAddRuleInput {
                validator: "v1".to_string(),
                field: "email".to_string(),
                rule: "required|email".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ValidatorAddRuleOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_valid_data() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandlerImpl;
        handler.register_constraint(
            ValidatorRegisterConstraintInput {
                validator: "v1".to_string(),
                constraint: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.add_rule(
            ValidatorAddRuleInput {
                validator: "v1".to_string(),
                field: "email".to_string(),
                rule: "required|email".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.validate(
            ValidatorValidateInput {
                validator: "v1".to_string(),
                data: r#"{"email":"alice@example.com"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ValidatorValidateOutput::Ok { valid, errors } => {
                assert!(valid);
                assert!(errors.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_validate_field_success() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandlerImpl;
        handler.register_constraint(
            ValidatorRegisterConstraintInput {
                validator: "v1".to_string(),
                constraint: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.add_rule(
            ValidatorAddRuleInput {
                validator: "v1".to_string(),
                field: "name".to_string(),
                rule: "required|min:3".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.validate_field(
            ValidatorValidateFieldInput {
                validator: "v1".to_string(),
                field: "name".to_string(),
                value: "Alice".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ValidatorValidateFieldOutput::Ok { valid, .. } => {
                assert!(valid);
            },
        }
    }

    #[tokio::test]
    async fn test_add_custom_validator_success() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandlerImpl;
        let result = handler.add_custom_validator(
            ValidatorAddCustomValidatorInput {
                validator: "v1".to_string(),
                name: "isPositive".to_string(),
                implementation: "value > 0".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ValidatorAddCustomValidatorOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_add_custom_validator_exists() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandlerImpl;
        handler.add_custom_validator(
            ValidatorAddCustomValidatorInput {
                validator: "v1".to_string(),
                name: "isPositive".to_string(),
                implementation: "value > 0".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.add_custom_validator(
            ValidatorAddCustomValidatorInput {
                validator: "v1".to_string(),
                name: "isPositive".to_string(),
                implementation: "value > 0".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ValidatorAddCustomValidatorOutput::Exists => {},
            _ => panic!("Expected Exists variant"),
        }
    }
}
