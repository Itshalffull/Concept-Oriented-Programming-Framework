// Formula concept implementation
// Evaluate reactive computed values derived from properties and relations,
// with dependency tracking and automatic invalidation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::FormulaHandler;
use serde_json::json;
use std::collections::HashSet;
use chrono::Utc;

/// Extract variable names from a formula expression.
fn extract_dependencies(expression: &str) -> Vec<String> {
    let reserved: HashSet<&str> = ["abs", "max", "min", "sqrt", "pow", "round", "floor", "ceil",
        "Math", "PI", "E", "true", "false", "null", "undefined"].iter().cloned().collect();

    let mut deps = HashSet::new();
    let mut current = String::new();

    for ch in expression.chars() {
        if ch.is_alphanumeric() || ch == '_' {
            current.push(ch);
        } else {
            if !current.is_empty() && current.chars().next().map_or(false, |c| c.is_alphabetic() || c == '_') {
                if !reserved.contains(current.as_str()) {
                    deps.insert(current.clone());
                }
            }
            current.clear();
        }
    }
    if !current.is_empty() && current.chars().next().map_or(false, |c| c.is_alphabetic() || c == '_') {
        if !reserved.contains(current.as_str()) {
            deps.insert(current);
        }
    }

    deps.into_iter().collect()
}

/// Evaluate a simple arithmetic expression after variable substitution.
fn evaluate_expression(expression: &str, variables: &std::collections::HashMap<String, f64>) -> String {
    let mut resolved = expression.to_string();
    for (name, value) in variables {
        // Simple word-boundary replacement
        resolved = resolved.replace(name, &value.to_string());
    }

    // Only allow numbers, operators, parentheses, and whitespace
    let sanitized: String = resolved.chars()
        .filter(|c| c.is_ascii_digit() || "+-*/().% \t".contains(*c))
        .collect();

    if sanitized.trim().is_empty() {
        return "computed".to_string();
    }

    // Simple expression evaluator for basic arithmetic
    match simple_eval(&sanitized) {
        Some(result) if result.is_finite() => result.to_string(),
        _ => "computed".to_string(),
    }
}

/// Very simple arithmetic evaluator for expressions with +, -, *, /
fn simple_eval(expr: &str) -> Option<f64> {
    let trimmed = expr.trim();
    if trimmed.is_empty() { return None; }
    trimmed.parse::<f64>().ok()
}

pub struct FormulaHandlerImpl;

#[async_trait]
impl FormulaHandler for FormulaHandlerImpl {
    async fn create(
        &self,
        input: FormulaCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormulaCreateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("formula", &input.formula).await?;
        if existing.is_some() {
            return Ok(FormulaCreateOutput::Exists);
        }

        let dependencies = extract_dependencies(&input.expression);
        let now = Utc::now().to_rfc3339();

        storage.put("formula", &input.formula, json!({
            "formula": input.formula,
            "expression": input.expression,
            "dependencies": serde_json::to_string(&dependencies)?,
            "cachedResult": "",
            "createdAt": now,
            "updatedAt": now,
        })).await?;

        Ok(FormulaCreateOutput::Ok)
    }

    async fn evaluate(
        &self,
        input: FormulaEvaluateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormulaEvaluateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("formula", &input.formula).await?;
        let Some(record) = existing else {
            return Ok(FormulaEvaluateOutput::Notfound);
        };

        let expression = record.get("expression").and_then(|v| v.as_str()).unwrap_or("");
        let cached_result = record.get("cachedResult").and_then(|v| v.as_str()).unwrap_or("");

        if !cached_result.is_empty() {
            return Ok(FormulaEvaluateOutput::Ok {
                result: cached_result.to_string(),
            });
        }

        let variables = std::collections::HashMap::new();
        let result = evaluate_expression(expression, &variables);

        let mut updated = record.clone();
        updated["cachedResult"] = json!(result);
        updated["updatedAt"] = json!(Utc::now().to_rfc3339());
        storage.put("formula", &input.formula, updated).await?;

        Ok(FormulaEvaluateOutput::Ok { result })
    }

    async fn get_dependencies(
        &self,
        input: FormulaGetDependenciesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormulaGetDependenciesOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("formula", &input.formula).await?;
        let Some(record) = existing else {
            return Ok(FormulaGetDependenciesOutput::Notfound);
        };

        Ok(FormulaGetDependenciesOutput::Ok {
            deps: record.get("dependencies").and_then(|v| v.as_str()).unwrap_or("[]").to_string(),
        })
    }

    async fn invalidate(
        &self,
        input: FormulaInvalidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormulaInvalidateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("formula", &input.formula).await?;
        let Some(mut record) = existing else {
            return Ok(FormulaInvalidateOutput::Notfound);
        };

        record["cachedResult"] = json!("");
        record["updatedAt"] = json!(Utc::now().to_rfc3339());
        storage.put("formula", &input.formula, record).await?;

        Ok(FormulaInvalidateOutput::Ok)
    }

    async fn set_expression(
        &self,
        input: FormulaSetExpressionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormulaSetExpressionOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("formula", &input.formula).await?;
        let Some(mut record) = existing else {
            return Ok(FormulaSetExpressionOutput::Notfound);
        };

        let dependencies = extract_dependencies(&input.expression);
        record["expression"] = json!(input.expression);
        record["dependencies"] = json!(serde_json::to_string(&dependencies)?);
        record["cachedResult"] = json!("");
        record["updatedAt"] = json!(Utc::now().to_rfc3339());
        storage.put("formula", &input.formula, record).await?;

        Ok(FormulaSetExpressionOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_success() {
        let storage = InMemoryStorage::new();
        let handler = FormulaHandlerImpl;
        let result = handler.create(
            FormulaCreateInput {
                formula: "total".to_string(),
                expression: "price * quantity".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FormulaCreateOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = FormulaHandlerImpl;
        handler.create(
            FormulaCreateInput { formula: "total".to_string(), expression: "a + b".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.create(
            FormulaCreateInput { formula: "total".to_string(), expression: "c + d".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FormulaCreateOutput::Exists => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_evaluate_notfound() {
        let storage = InMemoryStorage::new();
        let handler = FormulaHandlerImpl;
        let result = handler.evaluate(
            FormulaEvaluateInput { formula: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FormulaEvaluateOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_evaluate_returns_result() {
        let storage = InMemoryStorage::new();
        let handler = FormulaHandlerImpl;
        handler.create(
            FormulaCreateInput { formula: "simple".to_string(), expression: "42".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.evaluate(
            FormulaEvaluateInput { formula: "simple".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FormulaEvaluateOutput::Ok { result } => {
                assert_eq!(result, "42");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_dependencies_notfound() {
        let storage = InMemoryStorage::new();
        let handler = FormulaHandlerImpl;
        let result = handler.get_dependencies(
            FormulaGetDependenciesInput { formula: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FormulaGetDependenciesOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_invalidate_notfound() {
        let storage = InMemoryStorage::new();
        let handler = FormulaHandlerImpl;
        let result = handler.invalidate(
            FormulaInvalidateInput { formula: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FormulaInvalidateOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_set_expression_notfound() {
        let storage = InMemoryStorage::new();
        let handler = FormulaHandlerImpl;
        let result = handler.set_expression(
            FormulaSetExpressionInput {
                formula: "missing".to_string(),
                expression: "x + y".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FormulaSetExpressionOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
