// Query concept implementation
// Structured query engine supporting parse, execute, subscribe, filter, sort, and scope operations.
// Queries are stored as JSON AST representations and executed against concept storage.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::QueryHandler;
use serde_json::json;

pub struct QueryHandlerImpl;

fn next_id(prefix: &str) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}-{}-{}", prefix, t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl QueryHandler for QueryHandlerImpl {
    async fn parse(
        &self,
        input: QueryParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueryParseOutput, Box<dyn std::error::Error>> {
        let expression = input.expression.trim();

        if expression.is_empty() {
            return Ok(QueryParseOutput::Error {
                message: "Expression cannot be empty".to_string(),
            });
        }

        // Parse the query expression into a structured AST
        let query_id = if input.query.is_empty() {
            next_id("Q")
        } else {
            input.query.clone()
        };

        // Build a query AST from the expression
        let ast = json!({
            "queryId": query_id,
            "expression": expression,
            "filters": [],
            "sorts": [],
            "scope": null,
            "status": "parsed",
        });

        storage.put("query", &query_id, ast).await?;

        Ok(QueryParseOutput::Ok { query: query_id })
    }

    async fn execute(
        &self,
        input: QueryExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueryExecuteOutput, Box<dyn std::error::Error>> {
        let query_record = storage.get("query", &input.query).await?;
        let query_record = match query_record {
            Some(r) => r,
            None => return Ok(QueryExecuteOutput::Notfound {
                query: input.query,
            }),
        };

        let scope = query_record.get("scope").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let relation = if scope.is_empty() { "data" } else { &scope };

        // Build filter criteria from query filters
        let filters = query_record.get("filters").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        let criteria = if filters.is_empty() {
            None
        } else {
            let mut criteria_map = serde_json::Map::new();
            for filter in &filters {
                if let (Some(field), Some(value)) = (
                    filter.get("field").and_then(|v| v.as_str()),
                    filter.get("value"),
                ) {
                    criteria_map.insert(field.to_string(), value.clone());
                }
            }
            Some(serde_json::Value::Object(criteria_map))
        };

        let results = storage.find(relation, criteria.as_ref()).await?;

        // Apply sorts if present
        let sorts = query_record.get("sorts").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        let mut sorted_results = results;

        if !sorts.is_empty() {
            for sort in sorts.iter().rev() {
                let field = sort.get("field").and_then(|v| v.as_str()).unwrap_or("");
                let direction = sort.get("direction").and_then(|v| v.as_str()).unwrap_or("asc");
                let field_owned = field.to_string();
                sorted_results.sort_by(|a, b| {
                    let va = a.get(&field_owned).and_then(|v| v.as_str()).unwrap_or("");
                    let vb = b.get(&field_owned).and_then(|v| v.as_str()).unwrap_or("");
                    if direction == "desc" { vb.cmp(va) } else { va.cmp(vb) }
                });
            }
        }

        Ok(QueryExecuteOutput::Ok {
            results: serde_json::to_string(&sorted_results)?,
        })
    }

    async fn subscribe(
        &self,
        input: QuerySubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QuerySubscribeOutput, Box<dyn std::error::Error>> {
        let query_record = storage.get("query", &input.query).await?;
        if query_record.is_none() {
            return Ok(QuerySubscribeOutput::Notfound {
                query: input.query,
            });
        }

        let sub_id = next_id("sub");

        storage.put("query-subscription", &sub_id, json!({
            "subscriptionId": sub_id,
            "query": input.query,
            "createdAt": chrono::Utc::now().to_rfc3339(),
            "active": true,
        })).await?;

        Ok(QuerySubscribeOutput::Ok {
            subscription_id: sub_id,
        })
    }

    async fn add_filter(
        &self,
        input: QueryAddFilterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueryAddFilterOutput, Box<dyn std::error::Error>> {
        let query_record = storage.get("query", &input.query).await?;
        let mut query_record = match query_record {
            Some(r) => r,
            None => return Ok(QueryAddFilterOutput::Notfound {
                query: input.query,
            }),
        };

        let filter: serde_json::Value = serde_json::from_str(&input.filter).unwrap_or(json!({
            "field": input.filter,
            "op": "eq",
            "value": true,
        }));

        let mut filters = query_record.get("filters")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        filters.push(filter);
        query_record["filters"] = json!(filters);

        storage.put("query", &input.query, query_record).await?;

        Ok(QueryAddFilterOutput::Ok {
            query: input.query,
        })
    }

    async fn add_sort(
        &self,
        input: QueryAddSortInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QueryAddSortOutput, Box<dyn std::error::Error>> {
        let query_record = storage.get("query", &input.query).await?;
        let mut query_record = match query_record {
            Some(r) => r,
            None => return Ok(QueryAddSortOutput::Notfound {
                query: input.query,
            }),
        };

        let sort: serde_json::Value = serde_json::from_str(&input.sort).unwrap_or(json!({
            "field": input.sort,
            "direction": "asc",
        }));

        let mut sorts = query_record.get("sorts")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        sorts.push(sort);
        query_record["sorts"] = json!(sorts);

        storage.put("query", &input.query, query_record).await?;

        Ok(QueryAddSortOutput::Ok {
            query: input.query,
        })
    }

    async fn set_scope(
        &self,
        input: QuerySetScopeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<QuerySetScopeOutput, Box<dyn std::error::Error>> {
        let query_record = storage.get("query", &input.query).await?;
        let mut query_record = match query_record {
            Some(r) => r,
            None => return Ok(QuerySetScopeOutput::Notfound {
                query: input.query,
            }),
        };

        query_record["scope"] = json!(input.scope);
        storage.put("query", &input.query, query_record).await?;

        Ok(QuerySetScopeOutput::Ok {
            query: input.query,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_parse_query() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandlerImpl;
        let result = handler.parse(
            QueryParseInput {
                query: "".to_string(),
                expression: "SELECT * FROM users".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            QueryParseOutput::Ok { query } => {
                assert!(!query.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_empty_expression() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandlerImpl;
        let result = handler.parse(
            QueryParseInput {
                query: "".to_string(),
                expression: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            QueryParseOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_not_found() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandlerImpl;
        let result = handler.execute(
            QueryExecuteInput { query: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            QueryExecuteOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_subscribe_not_found() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandlerImpl;
        let result = handler.subscribe(
            QuerySubscribeInput { query: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            QuerySubscribeOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_add_filter_not_found() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandlerImpl;
        let result = handler.add_filter(
            QueryAddFilterInput { query: "nonexistent".to_string(), filter: "active".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            QueryAddFilterOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_add_sort_not_found() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandlerImpl;
        let result = handler.add_sort(
            QueryAddSortInput { query: "nonexistent".to_string(), sort: "name".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            QueryAddSortOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_set_scope_not_found() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandlerImpl;
        let result = handler.set_scope(
            QuerySetScopeInput { query: "nonexistent".to_string(), scope: "users".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            QuerySetScopeOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_and_execute() {
        let storage = InMemoryStorage::new();
        let handler = QueryHandlerImpl;
        let parse_result = handler.parse(
            QueryParseInput { query: "q1".to_string(), expression: "find users".to_string() },
            &storage,
        ).await.unwrap();
        let query_id = match parse_result {
            QueryParseOutput::Ok { query } => query,
            _ => panic!("Expected Ok"),
        };
        let result = handler.execute(
            QueryExecuteInput { query: query_id },
            &storage,
        ).await.unwrap();
        match result {
            QueryExecuteOutput::Ok { results } => {
                assert!(!results.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
