// Symbol registry: registers, resolves, queries, and renames symbols.
// Maintains indices by kind, file, and namespace for fast lookups.
// Supports visibility scoping and ambiguity detection.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SymbolHandler;
use serde_json::json;

pub struct SymbolHandlerImpl;

fn generate_symbol_id(symbol_string: &str) -> String {
    format!("sym-{:x}", symbol_string.bytes().fold(0u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64)))
}

/// Extract namespace from a symbol string (e.g., "foo::bar::baz" -> "foo::bar").
fn extract_namespace(symbol_string: &str) -> String {
    if let Some(pos) = symbol_string.rfind("::") {
        symbol_string[..pos].to_string()
    } else if let Some(pos) = symbol_string.rfind('/') {
        symbol_string[..pos].to_string()
    } else {
        String::new()
    }
}

#[async_trait]
impl SymbolHandler for SymbolHandlerImpl {
    async fn register(
        &self,
        input: SymbolRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRegisterOutput, Box<dyn std::error::Error>> {
        let symbol_id = generate_symbol_id(&input.symbol_string);

        // Check for existing symbol
        let existing = storage.get("symbol", &symbol_id).await?;
        if let Some(existing_record) = existing {
            return Ok(SymbolRegisterOutput::AlreadyExists {
                existing: existing_record["symbolId"].as_str().unwrap_or(&symbol_id).to_string(),
            });
        }

        let namespace = extract_namespace(&input.symbol_string);

        storage.put("symbol", &symbol_id, json!({
            "symbolId": &symbol_id,
            "symbolString": &input.symbol_string,
            "kind": &input.kind,
            "displayName": &input.display_name,
            "definingFile": &input.defining_file,
            "namespace": &namespace,
            "visibility": "public",
        })).await?;

        // Index by kind
        let kind_key = format!("kind-{}", &input.kind);
        let kind_index = storage.get("symbolKindIndex", &kind_key).await?;
        let mut symbols: Vec<String> = kind_index
            .and_then(|v| serde_json::from_value(v["symbols"].clone()).ok())
            .unwrap_or_default();
        if !symbols.contains(&symbol_id) {
            symbols.push(symbol_id.clone());
        }
        storage.put("symbolKindIndex", &kind_key, json!({"symbols": symbols})).await?;

        // Index by file
        let file_key = format!("file-{}", &input.defining_file);
        let file_index = storage.get("symbolFileIndex", &file_key).await?;
        let mut file_symbols: Vec<String> = file_index
            .and_then(|v| serde_json::from_value(v["symbols"].clone()).ok())
            .unwrap_or_default();
        if !file_symbols.contains(&symbol_id) {
            file_symbols.push(symbol_id.clone());
        }
        storage.put("symbolFileIndex", &file_key, json!({"symbols": file_symbols})).await?;

        // Index by symbol string for resolution
        storage.put("symbolStringIndex", &input.symbol_string, json!({
            "symbolId": &symbol_id,
        })).await?;

        Ok(SymbolRegisterOutput::Ok { symbol: symbol_id })
    }

    async fn resolve(
        &self,
        input: SymbolResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolResolveOutput, Box<dyn std::error::Error>> {
        // Look up by exact symbol string first
        let index_entry = storage.get("symbolStringIndex", &input.symbol_string).await?;
        if let Some(entry) = index_entry {
            let symbol_id = entry["symbolId"].as_str().unwrap_or("").to_string();
            return Ok(SymbolResolveOutput::Ok { symbol: symbol_id });
        }

        // Try finding by partial match (suffix match for unqualified names)
        let all_symbols = storage.find("symbol", None).await?;
        let mut candidates: Vec<String> = Vec::new();
        for sym in &all_symbols {
            let sym_str = sym["symbolString"].as_str().unwrap_or("");
            if sym_str.ends_with(&input.symbol_string) || sym_str.contains(&input.symbol_string) {
                candidates.push(sym["symbolId"].as_str().unwrap_or("").to_string());
            }
        }

        match candidates.len() {
            0 => Ok(SymbolResolveOutput::Notfound),
            1 => Ok(SymbolResolveOutput::Ok { symbol: candidates.remove(0) }),
            _ => Ok(SymbolResolveOutput::Ambiguous {
                candidates: serde_json::to_string(&candidates).unwrap_or_else(|_| "[]".to_string()),
            }),
        }
    }

    async fn find_by_kind(
        &self,
        input: SymbolFindByKindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolFindByKindOutput, Box<dyn std::error::Error>> {
        let kind_key = format!("kind-{}", &input.kind);
        let kind_index = storage.get("symbolKindIndex", &kind_key).await?;
        let mut symbols: Vec<String> = kind_index
            .and_then(|v| serde_json::from_value(v["symbols"].clone()).ok())
            .unwrap_or_default();

        // Filter by namespace if specified
        if !input.namespace.is_empty() {
            let mut filtered = Vec::new();
            for sym_id in &symbols {
                if let Some(record) = storage.get("symbol", sym_id).await? {
                    let ns = record["namespace"].as_str().unwrap_or("");
                    if ns == input.namespace || ns.starts_with(&input.namespace) {
                        filtered.push(sym_id.clone());
                    }
                }
            }
            symbols = filtered;
        }

        Ok(SymbolFindByKindOutput::Ok {
            symbols: serde_json::to_string(&symbols).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn find_by_file(
        &self,
        input: SymbolFindByFileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolFindByFileOutput, Box<dyn std::error::Error>> {
        let file_key = format!("file-{}", &input.file);
        let file_index = storage.get("symbolFileIndex", &file_key).await?;
        let symbols: Vec<String> = file_index
            .and_then(|v| serde_json::from_value(v["symbols"].clone()).ok())
            .unwrap_or_default();

        Ok(SymbolFindByFileOutput::Ok {
            symbols: serde_json::to_string(&symbols).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn rename(
        &self,
        input: SymbolRenameInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRenameOutput, Box<dyn std::error::Error>> {
        let record = storage.get("symbol", &input.symbol).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(SymbolRenameOutput::Notfound),
        };

        let old_name = record["displayName"].as_str().unwrap_or("").to_string();

        // Check for naming conflicts
        let all_symbols = storage.find("symbol", None).await?;
        for sym in &all_symbols {
            if sym["displayName"].as_str() == Some(&input.new_name)
                && sym["symbolId"].as_str() != Some(&input.symbol)
            {
                return Ok(SymbolRenameOutput::Conflict {
                    conflicting: sym["symbolId"].as_str().unwrap_or("").to_string(),
                });
            }
        }

        // Count occurrences that will be updated
        let occurrences = storage.find("symbolOccurrence", None).await?;
        let occurrences_updated = occurrences.iter()
            .filter(|o| o["symbol"].as_str() == Some(&input.symbol))
            .count() as i64;

        // Update the symbol record
        let mut updated = record.clone();
        updated["displayName"] = json!(input.new_name);
        storage.put("symbol", &input.symbol, updated).await?;

        Ok(SymbolRenameOutput::Ok {
            old_name,
            occurrences_updated,
        })
    }

    async fn get(
        &self,
        input: SymbolGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("symbol", &input.symbol).await?;

        match record {
            Some(v) => Ok(SymbolGetOutput::Ok {
                symbol: input.symbol,
                symbol_string: v["symbolString"].as_str().unwrap_or("").to_string(),
                kind: v["kind"].as_str().unwrap_or("").to_string(),
                display_name: v["displayName"].as_str().unwrap_or("").to_string(),
                visibility: v["visibility"].as_str().unwrap_or("public").to_string(),
                defining_file: v["definingFile"].as_str().unwrap_or("").to_string(),
                namespace: v["namespace"].as_str().unwrap_or("").to_string(),
            }),
            None => Ok(SymbolGetOutput::Notfound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_symbol() {
        let storage = InMemoryStorage::new();
        let handler = SymbolHandlerImpl;
        let result = handler.register(
            SymbolRegisterInput {
                symbol_string: "core::User".to_string(),
                kind: "struct".to_string(),
                display_name: "User".to_string(),
                defining_file: "src/user.rs".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SymbolRegisterOutput::Ok { symbol } => {
                assert!(symbol.starts_with("sym-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = SymbolHandlerImpl;
        handler.register(
            SymbolRegisterInput {
                symbol_string: "core::User".to_string(),
                kind: "struct".to_string(),
                display_name: "User".to_string(),
                defining_file: "src/user.rs".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register(
            SymbolRegisterInput {
                symbol_string: "core::User".to_string(),
                kind: "struct".to_string(),
                display_name: "User".to_string(),
                defining_file: "src/user.rs".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SymbolRegisterOutput::AlreadyExists { .. } => {},
            _ => panic!("Expected AlreadyExists variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_exact() {
        let storage = InMemoryStorage::new();
        let handler = SymbolHandlerImpl;
        handler.register(
            SymbolRegisterInput {
                symbol_string: "core::User".to_string(),
                kind: "struct".to_string(),
                display_name: "User".to_string(),
                defining_file: "src/user.rs".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.resolve(
            SymbolResolveInput { symbol_string: "core::User".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SymbolResolveOutput::Ok { symbol } => {
                assert!(symbol.starts_with("sym-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SymbolHandlerImpl;
        let result = handler.resolve(
            SymbolResolveInput { symbol_string: "nonexistent::Symbol".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SymbolResolveOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_existing() {
        let storage = InMemoryStorage::new();
        let handler = SymbolHandlerImpl;
        let sym_id = match handler.register(
            SymbolRegisterInput {
                symbol_string: "core::User".to_string(),
                kind: "struct".to_string(),
                display_name: "User".to_string(),
                defining_file: "src/user.rs".to_string(),
            },
            &storage,
        ).await.unwrap() {
            SymbolRegisterOutput::Ok { symbol } => symbol,
            _ => panic!("Expected Ok"),
        };
        let result = handler.get(
            SymbolGetInput { symbol: sym_id },
            &storage,
        ).await.unwrap();
        match result {
            SymbolGetOutput::Ok { kind, display_name, .. } => {
                assert_eq!(kind, "struct");
                assert_eq!(display_name, "User");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SymbolHandlerImpl;
        let result = handler.get(
            SymbolGetInput { symbol: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SymbolGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_rename_symbol() {
        let storage = InMemoryStorage::new();
        let handler = SymbolHandlerImpl;
        let sym_id = match handler.register(
            SymbolRegisterInput {
                symbol_string: "core::User".to_string(),
                kind: "struct".to_string(),
                display_name: "User".to_string(),
                defining_file: "src/user.rs".to_string(),
            },
            &storage,
        ).await.unwrap() {
            SymbolRegisterOutput::Ok { symbol } => symbol,
            _ => panic!("Expected Ok"),
        };
        let result = handler.rename(
            SymbolRenameInput { symbol: sym_id, new_name: "Account".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SymbolRenameOutput::Ok { old_name, .. } => {
                assert_eq!(old_name, "User");
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
