// ExpressionLanguage -- parse and evaluate expressions in pluggable language
// grammars with typed functions, operators, and autocompletion.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ExpressionLanguageHandler;
use serde_json::json;

pub struct ExpressionLanguageHandlerImpl;

/// Tokenize an arithmetic expression into a list of tokens.
fn tokenize(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i].is_whitespace() {
            i += 1;
            continue;
        }
        if "+-*/(),%".contains(chars[i]) {
            tokens.push(chars[i].to_string());
            i += 1;
            continue;
        }
        if chars[i].is_ascii_digit() || chars[i] == '.' {
            let mut num = String::new();
            while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.') {
                num.push(chars[i]);
                i += 1;
            }
            tokens.push(num);
            continue;
        }
        if chars[i].is_alphabetic() || chars[i] == '_' {
            let mut id = String::new();
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                id.push(chars[i]);
                i += 1;
            }
            tokens.push(id);
            continue;
        }
        i += 1;
    }
    tokens
}

/// Simple recursive-descent parser and evaluator for arithmetic expressions.
fn parse_and_evaluate(tokens: &[String]) -> (f64, String) {
    let mut pos = 0;

    fn peek<'a>(tokens: &'a [String], pos: usize) -> Option<&'a str> {
        tokens.get(pos).map(|s| s.as_str())
    }

    fn parse_expression(tokens: &[String], pos: &mut usize) -> (f64, String) {
        let mut left = parse_term(tokens, pos);
        while matches!(peek(tokens, *pos), Some("+") | Some("-")) {
            let op = tokens[*pos].clone();
            *pos += 1;
            let right = parse_term(tokens, pos);
            let op_name = if op == "+" { "add" } else { "sub" };
            let value = if op == "+" { left.0 + right.0 } else { left.0 - right.0 };
            left = (value, format!("{}({}, {})", op_name, left.1, right.1));
        }
        left
    }

    fn parse_term(tokens: &[String], pos: &mut usize) -> (f64, String) {
        let mut left = parse_factor(tokens, pos);
        while matches!(peek(tokens, *pos), Some("*") | Some("/") | Some("%")) {
            let op = tokens[*pos].clone();
            *pos += 1;
            let right = parse_factor(tokens, pos);
            let op_name = match op.as_str() {
                "*" => "mul",
                "/" => "div",
                _ => "mod",
            };
            let value = match op.as_str() {
                "*" => left.0 * right.0,
                "/" => if right.0 != 0.0 { left.0 / right.0 } else { f64::NAN },
                _ => left.0 % right.0,
            };
            left = (value, format!("{}({}, {})", op_name, left.1, right.1));
        }
        left
    }

    fn parse_factor(tokens: &[String], pos: &mut usize) -> (f64, String) {
        if peek(tokens, *pos) == Some("(") {
            *pos += 1;
            let inner = parse_expression(tokens, pos);
            if peek(tokens, *pos) == Some(")") {
                *pos += 1;
            }
            return inner;
        }
        if let Some(token) = peek(tokens, *pos) {
            if token.chars().next().map(|c| c.is_alphabetic() || c == '_').unwrap_or(false) {
                let name = tokens[*pos].clone();
                *pos += 1;
                if peek(tokens, *pos) == Some("(") {
                    *pos += 1;
                    let mut args = Vec::new();
                    if peek(tokens, *pos) != Some(")") {
                        args.push(parse_expression(tokens, pos));
                        while peek(tokens, *pos) == Some(",") {
                            *pos += 1;
                            args.push(parse_expression(tokens, pos));
                        }
                    }
                    if peek(tokens, *pos) == Some(")") {
                        *pos += 1;
                    }
                    let arg_vals: Vec<f64> = args.iter().map(|a| a.0).collect();
                    let arg_asts: Vec<String> = args.iter().map(|a| a.1.clone()).collect();
                    let value = match name.as_str() {
                        "abs" => arg_vals.first().copied().unwrap_or(0.0).abs(),
                        "max" => arg_vals.iter().copied().fold(f64::NEG_INFINITY, f64::max),
                        "min" => arg_vals.iter().copied().fold(f64::INFINITY, f64::min),
                        "sqrt" => arg_vals.first().copied().unwrap_or(0.0).sqrt(),
                        "pow" => {
                            let base = arg_vals.first().copied().unwrap_or(0.0);
                            let exp = arg_vals.get(1).copied().unwrap_or(0.0);
                            base.powf(exp)
                        }
                        "round" => arg_vals.first().copied().unwrap_or(0.0).round(),
                        "floor" => arg_vals.first().copied().unwrap_or(0.0).floor(),
                        "ceil" => arg_vals.first().copied().unwrap_or(0.0).ceil(),
                        _ => arg_vals.first().copied().unwrap_or(0.0),
                    };
                    return (value, format!("{}({})", name, arg_asts.join(", ")));
                }
                return (0.0, name);
            }
        }
        // Numeric literal
        let num_str = tokens.get(*pos).cloned().unwrap_or_default();
        *pos += 1;
        let value = num_str.parse::<f64>().unwrap_or(0.0);
        (value, num_str)
    }

    parse_expression(tokens, &mut pos)
}

#[async_trait]
impl ExpressionLanguageHandler for ExpressionLanguageHandlerImpl {
    async fn register_language(
        &self,
        input: ExpressionLanguageRegisterLanguageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageRegisterLanguageOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("grammar", &input.name).await?;
        if existing.is_some() {
            return Ok(ExpressionLanguageRegisterLanguageOutput::Exists);
        }

        storage.put("grammar", &input.name, json!({
            "name": input.name,
            "grammar": input.grammar,
        })).await?;

        Ok(ExpressionLanguageRegisterLanguageOutput::Ok)
    }

    async fn register_function(
        &self,
        input: ExpressionLanguageRegisterFunctionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageRegisterFunctionOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("function", &input.name).await?;
        if existing.is_some() {
            return Ok(ExpressionLanguageRegisterFunctionOutput::Exists);
        }

        storage.put("function", &input.name, json!({
            "name": input.name,
            "implementation": input.implementation,
        })).await?;

        Ok(ExpressionLanguageRegisterFunctionOutput::Ok)
    }

    async fn register_operator(
        &self,
        input: ExpressionLanguageRegisterOperatorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageRegisterOperatorOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("operator", &input.name).await?;
        if existing.is_some() {
            return Ok(ExpressionLanguageRegisterOperatorOutput::Exists);
        }

        storage.put("operator", &input.name, json!({
            "name": input.name,
            "implementation": input.implementation,
        })).await?;

        Ok(ExpressionLanguageRegisterOperatorOutput::Ok)
    }

    async fn parse(
        &self,
        input: ExpressionLanguageParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageParseOutput, Box<dyn std::error::Error>> {
        // Verify language is registered
        let lang = storage.get("grammar", &input.language).await?;
        if lang.is_none() {
            return Ok(ExpressionLanguageParseOutput::Error);
        }

        let tokens = tokenize(&input.text);
        if tokens.is_empty() {
            return Ok(ExpressionLanguageParseOutput::Error);
        }

        let (result, ast) = parse_and_evaluate(&tokens);

        storage.put("expression", &input.expression, json!({
            "expression": input.expression,
            "text": input.text,
            "language": input.language,
            "ast": ast,
            "result": result.to_string(),
        })).await?;

        Ok(ExpressionLanguageParseOutput::Ok { ast })
    }

    async fn evaluate(
        &self,
        input: ExpressionLanguageEvaluateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageEvaluateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("expression", &input.expression).await?;
        match existing {
            Some(record) => {
                let result = record["result"].as_str().unwrap_or("0").to_string();
                Ok(ExpressionLanguageEvaluateOutput::Ok { result })
            }
            None => Ok(ExpressionLanguageEvaluateOutput::Notfound),
        }
    }

    async fn type_check(
        &self,
        input: ExpressionLanguageTypeCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageTypeCheckOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("expression", &input.expression).await?;
        match existing {
            Some(record) => {
                let result = record["result"].as_str().unwrap_or("0");
                let mut errors = Vec::new();

                if result == "NaN" {
                    errors.push("Expression evaluates to NaN (possible division by zero)".to_string());
                }
                if result == "inf" || result == "-inf" {
                    errors.push("Expression evaluates to Infinity".to_string());
                }

                let valid = errors.is_empty();
                Ok(ExpressionLanguageTypeCheckOutput::Ok {
                    valid,
                    errors: serde_json::to_string(&errors)?,
                })
            }
            None => Ok(ExpressionLanguageTypeCheckOutput::Notfound),
        }
    }

    async fn get_completions(
        &self,
        input: ExpressionLanguageGetCompletionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageGetCompletionsOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("expression", &input.expression).await?;
        if existing.is_none() {
            return Ok(ExpressionLanguageGetCompletionsOutput::Notfound);
        }

        let all_functions = storage.find("function", "{}").await?;
        let all_operators = storage.find("operator", "{}").await?;

        let mut completions: Vec<String> = Vec::new();
        for func in &all_functions {
            if let Some(name) = func["name"].as_str() {
                completions.push(format!("{}()", name));
            }
        }
        for op in &all_operators {
            if let Some(name) = op["name"].as_str() {
                completions.push(name.to_string());
            }
        }

        // Built-in math functions
        let builtins = ["abs", "max", "min", "sqrt", "pow", "round", "floor", "ceil"];
        for b in &builtins {
            completions.push(format!("{}()", b));
        }

        Ok(ExpressionLanguageGetCompletionsOutput::Ok {
            completions: serde_json::to_string(&completions)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_language() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandlerImpl;
        let result = handler.register_language(
            ExpressionLanguageRegisterLanguageInput {
                name: "arithmetic".to_string(),
                grammar: "expr = term (('+' | '-') term)*".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExpressionLanguageRegisterLanguageOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_language_exists() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandlerImpl;
        handler.register_language(
            ExpressionLanguageRegisterLanguageInput {
                name: "arithmetic".to_string(),
                grammar: "expr = term".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register_language(
            ExpressionLanguageRegisterLanguageInput {
                name: "arithmetic".to_string(),
                grammar: "expr = term".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExpressionLanguageRegisterLanguageOutput::Exists => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_register_function() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandlerImpl;
        let result = handler.register_function(
            ExpressionLanguageRegisterFunctionInput {
                name: "clamp".to_string(),
                implementation: "native".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExpressionLanguageRegisterFunctionOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_operator() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandlerImpl;
        let result = handler.register_operator(
            ExpressionLanguageRegisterOperatorInput {
                name: "**".to_string(),
                implementation: "native".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExpressionLanguageRegisterOperatorOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_no_language() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandlerImpl;
        let result = handler.parse(
            ExpressionLanguageParseInput {
                expression: "expr-1".to_string(),
                text: "1 + 2".to_string(),
                language: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExpressionLanguageParseOutput::Error => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_and_evaluate() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandlerImpl;
        storage.put("grammar", "arith", json!({"name": "arith", "grammar": ""})).await.unwrap();
        let result = handler.parse(
            ExpressionLanguageParseInput {
                expression: "expr-1".to_string(),
                text: "3 + 4 * 2".to_string(),
                language: "arith".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExpressionLanguageParseOutput::Ok { ast } => {
                assert!(!ast.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_evaluate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandlerImpl;
        let result = handler.evaluate(
            ExpressionLanguageEvaluateInput {
                expression: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExpressionLanguageEvaluateOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_type_check_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandlerImpl;
        let result = handler.type_check(
            ExpressionLanguageTypeCheckInput {
                expression: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExpressionLanguageTypeCheckOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
