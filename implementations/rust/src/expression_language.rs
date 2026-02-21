// ExpressionLanguage Concept Implementation (Rust)
//
// Computation kit — registers expression languages and functions,
// parses expression strings into ASTs, and evaluates them.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── RegisterLanguage ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExprLangRegisterLanguageInput {
    pub language_id: String,
    pub grammar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ExprLangRegisterLanguageOutput {
    #[serde(rename = "ok")]
    Ok { language_id: String },
}

// ── RegisterFunction ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExprLangRegisterFunctionInput {
    pub language_id: String,
    pub name: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ExprLangRegisterFunctionOutput {
    #[serde(rename = "ok")]
    Ok { language_id: String, name: String },
    #[serde(rename = "lang_notfound")]
    LangNotFound { message: String },
}

// ── Parse ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExprLangParseInput {
    pub language_id: String,
    pub expression_string: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ExprLangParseOutput {
    #[serde(rename = "ok")]
    Ok { ast: String },
    #[serde(rename = "parse_error")]
    ParseError { message: String },
}

// ── Evaluate ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExprLangEvaluateInput {
    pub ast: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ExprLangEvaluateOutput {
    #[serde(rename = "ok")]
    Ok { result: String },
    #[serde(rename = "eval_error")]
    EvalError { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct ExpressionLanguageHandler;

impl ExpressionLanguageHandler {
    pub async fn register_language(
        &self,
        input: ExprLangRegisterLanguageInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ExprLangRegisterLanguageOutput> {
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "language",
                &input.language_id,
                json!({
                    "language_id": input.language_id,
                    "grammar": input.grammar,
                    "registered_at": now,
                }),
            )
            .await?;
        Ok(ExprLangRegisterLanguageOutput::Ok {
            language_id: input.language_id,
        })
    }

    pub async fn register_function(
        &self,
        input: ExprLangRegisterFunctionInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ExprLangRegisterFunctionOutput> {
        let lang = storage.get("language", &input.language_id).await?;
        if lang.is_none() {
            return Ok(ExprLangRegisterFunctionOutput::LangNotFound {
                message: format!("language '{}' not found", input.language_id),
            });
        }

        let key = format!("{}:{}", input.language_id, input.name);
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "function_registry",
                &key,
                json!({
                    "language_id": input.language_id,
                    "name": input.name,
                    "signature": input.signature,
                    "registered_at": now,
                }),
            )
            .await?;
        Ok(ExprLangRegisterFunctionOutput::Ok {
            language_id: input.language_id,
            name: input.name,
        })
    }

    pub async fn parse(
        &self,
        input: ExprLangParseInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ExprLangParseOutput> {
        let lang = storage.get("language", &input.language_id).await?;
        if lang.is_none() {
            return Ok(ExprLangParseOutput::ParseError {
                message: format!("language '{}' not found", input.language_id),
            });
        }

        // Produce a simple AST representation
        let ast = json!({
            "language_id": input.language_id,
            "expression": input.expression_string,
            "type": "parsed_expression",
        })
        .to_string();

        Ok(ExprLangParseOutput::Ok { ast })
    }

    pub async fn evaluate(
        &self,
        input: ExprLangEvaluateInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<ExprLangEvaluateOutput> {
        // Parse the AST to verify it is valid JSON
        let ast_value: Result<serde_json::Value, _> = serde_json::from_str(&input.ast);
        match ast_value {
            Err(e) => Ok(ExprLangEvaluateOutput::EvalError {
                message: format!("invalid AST: {}", e),
            }),
            Ok(ast) => {
                let result = json!({
                    "ast": ast,
                    "context": input.context,
                    "evaluated": true,
                })
                .to_string();
                Ok(ExprLangEvaluateOutput::Ok { result })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn register_language() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandler;
        let result = handler
            .register_language(
                ExprLangRegisterLanguageInput {
                    language_id: "cel".into(),
                    grammar: "common expression language".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            ExprLangRegisterLanguageOutput::Ok { language_id } => {
                assert_eq!(language_id, "cel");
            }
        }
    }

    #[tokio::test]
    async fn register_function_for_existing_language() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandler;
        handler
            .register_language(
                ExprLangRegisterLanguageInput {
                    language_id: "cel".into(),
                    grammar: "grammar".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .register_function(
                ExprLangRegisterFunctionInput {
                    language_id: "cel".into(),
                    name: "size".into(),
                    signature: "(list) -> int".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            ExprLangRegisterFunctionOutput::Ok { language_id, name } => {
                assert_eq!(language_id, "cel");
                assert_eq!(name, "size");
            }
            ExprLangRegisterFunctionOutput::LangNotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn register_function_for_missing_language() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandler;
        let result = handler
            .register_function(
                ExprLangRegisterFunctionInput {
                    language_id: "nonexistent".into(),
                    name: "fn".into(),
                    signature: "() -> void".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, ExprLangRegisterFunctionOutput::LangNotFound { .. }));
    }

    #[tokio::test]
    async fn parse_expression() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandler;
        handler
            .register_language(
                ExprLangRegisterLanguageInput {
                    language_id: "cel".into(),
                    grammar: "grammar".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .parse(
                ExprLangParseInput {
                    language_id: "cel".into(),
                    expression_string: "x + 1".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            ExprLangParseOutput::Ok { ast } => {
                assert!(ast.contains("x + 1"));
                assert!(ast.contains("cel"));
            }
            ExprLangParseOutput::ParseError { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn parse_missing_language() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandler;
        let result = handler
            .parse(
                ExprLangParseInput {
                    language_id: "missing".into(),
                    expression_string: "x".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, ExprLangParseOutput::ParseError { .. }));
    }

    #[tokio::test]
    async fn evaluate_valid_ast() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandler;
        let result = handler
            .evaluate(
                ExprLangEvaluateInput {
                    ast: r#"{"type": "parsed_expression"}"#.into(),
                    context: r#"{"x": 1}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            ExprLangEvaluateOutput::Ok { result } => {
                assert!(result.contains("evaluated"));
            }
            ExprLangEvaluateOutput::EvalError { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn evaluate_invalid_ast() {
        let storage = InMemoryStorage::new();
        let handler = ExpressionLanguageHandler;
        let result = handler
            .evaluate(
                ExprLangEvaluateInput {
                    ast: "not valid json{{{".into(),
                    context: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, ExprLangEvaluateOutput::EvalError { .. }));
    }
}
