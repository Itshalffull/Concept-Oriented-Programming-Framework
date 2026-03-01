// Symbol occurrence tracker: records and queries symbol occurrences (definitions,
// references, imports) across source files with precise byte-range positions.
// Supports go-to-definition, find-references, and find-at-position queries.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SymbolOccurrenceHandler;
use serde_json::json;

pub struct SymbolOccurrenceHandlerImpl;

fn generate_occurrence_id(symbol: &str, file: &str, start_byte: i64) -> String {
    format!("occ-{}-{}-{}", symbol, file.replace('/', "_"), start_byte)
}

#[async_trait]
impl SymbolOccurrenceHandler for SymbolOccurrenceHandlerImpl {
    async fn record(
        &self,
        input: SymbolOccurrenceRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolOccurrenceRecordOutput, Box<dyn std::error::Error>> {
        let occ_id = generate_occurrence_id(&input.symbol, &input.file, input.start_byte);

        storage.put("symbolOccurrence", &occ_id, json!({
            "occurrenceId": &occ_id,
            "symbol": &input.symbol,
            "file": &input.file,
            "startRow": input.start_row,
            "startCol": input.start_col,
            "endRow": input.end_row,
            "endCol": input.end_col,
            "startByte": input.start_byte,
            "endByte": input.end_byte,
            "role": &input.role,
        })).await?;

        // Index by symbol for find_definitions and find_references
        let sym_key = format!("sym-occs-{}", &input.symbol);
        let existing = storage.get("symbolOccurrenceIndex", &sym_key).await?;
        let mut occs: Vec<String> = existing
            .and_then(|v| serde_json::from_value(v["occurrences"].clone()).ok())
            .unwrap_or_default();
        if !occs.contains(&occ_id) {
            occs.push(occ_id.clone());
        }
        storage.put("symbolOccurrenceIndex", &sym_key, json!({"occurrences": occs})).await?;

        // Index by file for find_in_file
        let file_key = format!("file-occs-{}", &input.file);
        let file_existing = storage.get("fileOccurrenceIndex", &file_key).await?;
        let mut file_occs: Vec<String> = file_existing
            .and_then(|v| serde_json::from_value(v["occurrences"].clone()).ok())
            .unwrap_or_default();
        if !file_occs.contains(&occ_id) {
            file_occs.push(occ_id.clone());
        }
        storage.put("fileOccurrenceIndex", &file_key, json!({"occurrences": file_occs})).await?;

        Ok(SymbolOccurrenceRecordOutput::Ok { occurrence: occ_id })
    }

    async fn find_definitions(
        &self,
        input: SymbolOccurrenceFindDefinitionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolOccurrenceFindDefinitionsOutput, Box<dyn std::error::Error>> {
        let sym_key = format!("sym-occs-{}", &input.symbol);
        let index = storage.get("symbolOccurrenceIndex", &sym_key).await?;
        let occ_ids: Vec<String> = index
            .and_then(|v| serde_json::from_value(v["occurrences"].clone()).ok())
            .unwrap_or_default();

        let mut definitions = Vec::new();
        for occ_id in &occ_ids {
            if let Some(record) = storage.get("symbolOccurrence", occ_id).await? {
                let role = record["role"].as_str().unwrap_or("");
                if role == "definition" || role == "declaration" {
                    definitions.push(record);
                }
            }
        }

        if definitions.is_empty() {
            return Ok(SymbolOccurrenceFindDefinitionsOutput::NoDefinitions);
        }

        Ok(SymbolOccurrenceFindDefinitionsOutput::Ok {
            occurrences: serde_json::to_string(&definitions).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn find_references(
        &self,
        input: SymbolOccurrenceFindReferencesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolOccurrenceFindReferencesOutput, Box<dyn std::error::Error>> {
        let sym_key = format!("sym-occs-{}", &input.symbol);
        let index = storage.get("symbolOccurrenceIndex", &sym_key).await?;
        let occ_ids: Vec<String> = index
            .and_then(|v| serde_json::from_value(v["occurrences"].clone()).ok())
            .unwrap_or_default();

        let mut references = Vec::new();
        for occ_id in &occ_ids {
            if let Some(record) = storage.get("symbolOccurrence", occ_id).await? {
                let role = record["role"].as_str().unwrap_or("");
                if input.role_filter.is_empty() || role == input.role_filter {
                    references.push(record);
                }
            }
        }

        if references.is_empty() {
            return Ok(SymbolOccurrenceFindReferencesOutput::NoReferences);
        }

        Ok(SymbolOccurrenceFindReferencesOutput::Ok {
            occurrences: serde_json::to_string(&references).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn find_at_position(
        &self,
        input: SymbolOccurrenceFindAtPositionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolOccurrenceFindAtPositionOutput, Box<dyn std::error::Error>> {
        let file_key = format!("file-occs-{}", &input.file);
        let index = storage.get("fileOccurrenceIndex", &file_key).await?;
        let occ_ids: Vec<String> = index
            .and_then(|v| serde_json::from_value(v["occurrences"].clone()).ok())
            .unwrap_or_default();

        for occ_id in &occ_ids {
            if let Some(record) = storage.get("symbolOccurrence", occ_id).await? {
                let start_row = record["startRow"].as_i64().unwrap_or(-1);
                let end_row = record["endRow"].as_i64().unwrap_or(-1);
                let start_col = record["startCol"].as_i64().unwrap_or(-1);
                let end_col = record["endCol"].as_i64().unwrap_or(-1);

                // Check if position falls within this occurrence
                if input.row >= start_row && input.row <= end_row {
                    if (input.row > start_row || input.col >= start_col)
                        && (input.row < end_row || input.col <= end_col)
                    {
                        let symbol = record["symbol"].as_str().unwrap_or("").to_string();
                        return Ok(SymbolOccurrenceFindAtPositionOutput::Ok {
                            occurrence: occ_id.clone(),
                            symbol,
                        });
                    }
                }
            }
        }

        Ok(SymbolOccurrenceFindAtPositionOutput::NoSymbolAtPosition)
    }

    async fn find_in_file(
        &self,
        input: SymbolOccurrenceFindInFileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolOccurrenceFindInFileOutput, Box<dyn std::error::Error>> {
        let file_key = format!("file-occs-{}", &input.file);
        let index = storage.get("fileOccurrenceIndex", &file_key).await?;
        let occ_ids: Vec<String> = index
            .and_then(|v| serde_json::from_value(v["occurrences"].clone()).ok())
            .unwrap_or_default();

        let mut occurrences = Vec::new();
        for occ_id in &occ_ids {
            if let Some(record) = storage.get("symbolOccurrence", occ_id).await? {
                occurrences.push(record);
            }
        }

        Ok(SymbolOccurrenceFindInFileOutput::Ok {
            occurrences: serde_json::to_string(&occurrences).unwrap_or_else(|_| "[]".to_string()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_record_occurrence() {
        let storage = InMemoryStorage::new();
        let handler = SymbolOccurrenceHandlerImpl;
        let result = handler.record(
            SymbolOccurrenceRecordInput {
                symbol: "sym-abc".to_string(),
                file: "src/main.rs".to_string(),
                start_row: 10,
                start_col: 4,
                end_row: 10,
                end_col: 12,
                start_byte: 100,
                end_byte: 108,
                role: "definition".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SymbolOccurrenceRecordOutput::Ok { occurrence } => {
                assert!(occurrence.starts_with("occ-"));
            },
        }
    }

    #[tokio::test]
    async fn test_find_definitions() {
        let storage = InMemoryStorage::new();
        let handler = SymbolOccurrenceHandlerImpl;
        handler.record(
            SymbolOccurrenceRecordInput {
                symbol: "sym-def".to_string(),
                file: "src/lib.rs".to_string(),
                start_row: 5, start_col: 0, end_row: 5, end_col: 10,
                start_byte: 50, end_byte: 60,
                role: "definition".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.find_definitions(
            SymbolOccurrenceFindDefinitionsInput { symbol: "sym-def".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SymbolOccurrenceFindDefinitionsOutput::Ok { occurrences } => {
                assert!(occurrences.contains("definition"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_find_definitions_none() {
        let storage = InMemoryStorage::new();
        let handler = SymbolOccurrenceHandlerImpl;
        let result = handler.find_definitions(
            SymbolOccurrenceFindDefinitionsInput { symbol: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SymbolOccurrenceFindDefinitionsOutput::NoDefinitions => {},
            _ => panic!("Expected NoDefinitions variant"),
        }
    }

    #[tokio::test]
    async fn test_find_references_none() {
        let storage = InMemoryStorage::new();
        let handler = SymbolOccurrenceHandlerImpl;
        let result = handler.find_references(
            SymbolOccurrenceFindReferencesInput {
                symbol: "nonexistent".to_string(),
                role_filter: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SymbolOccurrenceFindReferencesOutput::NoReferences => {},
            _ => panic!("Expected NoReferences variant"),
        }
    }

    #[tokio::test]
    async fn test_find_at_position_no_symbol() {
        let storage = InMemoryStorage::new();
        let handler = SymbolOccurrenceHandlerImpl;
        let result = handler.find_at_position(
            SymbolOccurrenceFindAtPositionInput {
                file: "src/main.rs".to_string(),
                row: 1,
                col: 1,
            },
            &storage,
        ).await.unwrap();
        match result {
            SymbolOccurrenceFindAtPositionOutput::NoSymbolAtPosition => {},
            _ => panic!("Expected NoSymbolAtPosition variant"),
        }
    }
}
