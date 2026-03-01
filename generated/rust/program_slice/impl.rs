// ProgramSlice -- compute forward and backward program slices from a criterion
// symbol, tracking files, symbols, and dependence edges in the slice.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ProgramSliceHandler;
use serde_json::json;

pub struct ProgramSliceHandlerImpl;

#[async_trait]
impl ProgramSliceHandler for ProgramSliceHandlerImpl {
    async fn compute(
        &self,
        input: ProgramSliceComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgramSliceComputeOutput, Box<dyn std::error::Error>> {
        // Check that dependence data is available
        let dep_data = storage.find("dependence", "{}").await?;
        if dep_data.is_empty() {
            return Ok(ProgramSliceComputeOutput::NoDependenceData {
                message: "No dependence graph data available. Run dependence analysis first.".to_string(),
            });
        }

        let slice_id = format!("slice-{}-{}", input.criterion, input.direction);

        // Walk the dependence graph from the criterion symbol in the given direction
        let mut files = Vec::new();
        let mut symbols = Vec::new();
        let mut edges: Vec<serde_json::Value> = Vec::new();

        for dep in &dep_data {
            let from = dep["from"].as_str().unwrap_or("");
            let to = dep["to"].as_str().unwrap_or("");
            let file = dep["file"].as_str().unwrap_or("");

            let relevant = match input.direction.as_str() {
                "backward" => to == input.criterion || symbols.contains(&to.to_string()),
                "forward" => from == input.criterion || symbols.contains(&from.to_string()),
                _ => from == input.criterion || to == input.criterion,
            };

            if relevant {
                if !symbols.contains(&from.to_string()) {
                    symbols.push(from.to_string());
                }
                if !symbols.contains(&to.to_string()) {
                    symbols.push(to.to_string());
                }
                if !file.is_empty() && !files.contains(&file.to_string()) {
                    files.push(file.to_string());
                }
                edges.push(json!({"from": from, "to": to}));
            }
        }

        // If no edges were found, add the criterion symbol itself
        if symbols.is_empty() {
            symbols.push(input.criterion.clone());
        }

        storage.put("programSlice", &slice_id, json!({
            "slice": slice_id,
            "criterion": input.criterion,
            "direction": input.direction,
            "files": files,
            "symbols": symbols,
            "edges": edges,
        })).await?;

        Ok(ProgramSliceComputeOutput::Ok {
            slice: slice_id,
        })
    }

    async fn files_in_slice(
        &self,
        input: ProgramSliceFilesInSliceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgramSliceFilesInSliceOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("programSlice", &input.slice).await?;
        let files = match existing {
            Some(record) => {
                let arr = record["files"].as_array().cloned().unwrap_or_default();
                serde_json::to_string(&arr)?
            }
            None => "[]".to_string(),
        };

        Ok(ProgramSliceFilesInSliceOutput::Ok { files })
    }

    async fn symbols_in_slice(
        &self,
        input: ProgramSliceSymbolsInSliceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgramSliceSymbolsInSliceOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("programSlice", &input.slice).await?;
        let symbols = match existing {
            Some(record) => {
                let arr = record["symbols"].as_array().cloned().unwrap_or_default();
                serde_json::to_string(&arr)?
            }
            None => "[]".to_string(),
        };

        Ok(ProgramSliceSymbolsInSliceOutput::Ok { symbols })
    }

    async fn get(
        &self,
        input: ProgramSliceGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgramSliceGetOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("programSlice", &input.slice).await?;
        match existing {
            Some(record) => {
                let criterion_symbol = record["criterion"].as_str().unwrap_or("").to_string();
                let direction = record["direction"].as_str().unwrap_or("").to_string();
                let symbol_count = record["symbols"].as_array().map(|a| a.len()).unwrap_or(0) as i64;
                let file_count = record["files"].as_array().map(|a| a.len()).unwrap_or(0) as i64;
                let edge_count = record["edges"].as_array().map(|a| a.len()).unwrap_or(0) as i64;

                Ok(ProgramSliceGetOutput::Ok {
                    slice: input.slice,
                    criterion_symbol,
                    direction,
                    symbol_count,
                    file_count,
                    edge_count,
                })
            }
            None => Ok(ProgramSliceGetOutput::Notfound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_compute_no_dependence_data() {
        let storage = InMemoryStorage::new();
        let handler = ProgramSliceHandlerImpl;
        let result = handler.compute(
            ProgramSliceComputeInput {
                criterion: "symbolA".to_string(),
                direction: "forward".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProgramSliceComputeOutput::NoDependenceData { .. } => {}
            _ => panic!("Expected NoDependenceData variant"),
        }
    }

    #[tokio::test]
    async fn test_files_in_slice_empty() {
        let storage = InMemoryStorage::new();
        let handler = ProgramSliceHandlerImpl;
        let result = handler.files_in_slice(
            ProgramSliceFilesInSliceInput { slice: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProgramSliceFilesInSliceOutput::Ok { files } => {
                assert_eq!(files, "[]");
            }
        }
    }

    #[tokio::test]
    async fn test_symbols_in_slice_empty() {
        let storage = InMemoryStorage::new();
        let handler = ProgramSliceHandlerImpl;
        let result = handler.symbols_in_slice(
            ProgramSliceSymbolsInSliceInput { slice: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProgramSliceSymbolsInSliceOutput::Ok { symbols } => {
                assert_eq!(symbols, "[]");
            }
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProgramSliceHandlerImpl;
        let result = handler.get(
            ProgramSliceGetInput { slice: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProgramSliceGetOutput::Notfound => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
