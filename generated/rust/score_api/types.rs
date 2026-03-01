// generated: score_api/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiListFilesInput {
    pub pattern: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiListFilesOutput {
    Ok {
        files: Vec<{ path: String, language: String, role: String, size: i64 }>,
    },
    Empty {
        pattern: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetFileTreeInput {
    pub path: String,
    pub depth: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetFileTreeOutput {
    Ok {
        tree: String,
        file_count: i64,
        dir_count: i64,
    },
    NotFound {
        path: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetFileContentInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetFileContentOutput {
    Ok {
        content: String,
        language: String,
        definitions: Vec<String>,
    },
    NotFound {
        path: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetDefinitionsInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetDefinitionsOutput {
    Ok {
        definitions: Vec<{ name: String, kind: String, line: i64, span: String }>,
    },
    NotFound {
        path: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiMatchPatternInput {
    pub pattern: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiMatchPatternOutput {
    Ok {
        matches: Vec<{ file: String, line: i64, text: String, context: String }>,
    },
    InvalidPattern {
        pattern: String,
        error: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiFindSymbolInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiFindSymbolOutput {
    Ok {
        symbols: Vec<{ name: String, kind: String, file: String, line: i64, scope: String }>,
    },
    NotFound {
        name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetReferencesInput {
    pub symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetReferencesOutput {
    Ok {
        definition: { file: String, line: i64 },
        references: Vec<{ file: String, line: i64, kind: String }>,
    },
    NotFound {
        symbol: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetScopeInput {
    pub file: String,
    pub line: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetScopeOutput {
    Ok {
        scope: String,
        symbols: Vec<{ name: String, kind: String }>,
        parent: Option<String>,
    },
    NotFound {
        file: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetRelationshipsInput {
    pub symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetRelationshipsOutput {
    Ok {
        relationships: Vec<{ from: String, to: String, kind: String, file: String }>,
    },
    NotFound {
        symbol: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiListConceptsInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiListConceptsOutput {
    Ok {
        concepts: Vec<{ name: String, purpose: String, actions: Vec<String>, state_fields: Vec<String>, file: String }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetConceptInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetConceptOutput {
    Ok {
        concept: { name: String, purpose: String, type_params: Vec<String>, actions: Vec<{ name: String, params: Vec<String>, variants: Vec<String> }>, state_fields: Vec<{ name: String, type: String, relation: String }>, invariants: Vec<String>, file: String },
    },
    NotFound {
        name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetActionInput {
    pub concept: String,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetActionOutput {
    Ok {
        action: { name: String, params: Vec<{ name: String, type: String }>, variants: Vec<{ name: String, fields: Vec<String>, prose: String }>, description: String },
    },
    NotFound {
        concept: String,
        action: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiListSyncsInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiListSyncsOutput {
    Ok {
        syncs: Vec<{ name: String, annotation: String, triggers: Vec<String>, effects: Vec<String>, file: String }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetSyncInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetSyncOutput {
    Ok {
        sync: { name: String, annotation: String, when: Vec<{ concept: String, action: String, bindings: Vec<String> }>, where: Vec<String>, then: Vec<{ concept: String, action: String, bindings: Vec<String> }>, file: String },
    },
    NotFound {
        name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetFlowInput {
    pub start_concept: String,
    pub start_action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetFlowOutput {
    Ok {
        flow: Vec<{ step: i64, concept: String, action: String, sync: String, variant: String }>,
    },
    NotFound {
        concept: String,
        action: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetDependenciesInput {
    pub symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetDependenciesOutput {
    Ok {
        direct_deps: Vec<{ name: String, kind: String, file: String }>,
        transitive_deps: Vec<{ name: String, kind: String, file: String }>,
    },
    NotFound {
        symbol: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetDependentsInput {
    pub symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetDependentsOutput {
    Ok {
        direct_deps: Vec<{ name: String, kind: String, file: String }>,
        transitive_deps: Vec<{ name: String, kind: String, file: String }>,
    },
    NotFound {
        symbol: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetImpactInput {
    pub file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetImpactOutput {
    Ok {
        direct_impact: Vec<{ file: String, reason: String }>,
        transitive_impact: Vec<{ file: String, reason: String }>,
    },
    NotFound {
        file: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiGetDataFlowInput {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiGetDataFlowOutput {
    Ok {
        paths: Vec<{ hops: Vec<{ symbol: String, file: String, kind: String }>, length: i64 }>,
    },
    NoPath {
        from: String,
        to: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiSearchInput {
    pub query: String,
    pub limit: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiSearchOutput {
    Ok {
        results: Vec<{ name: String, kind: String, file: String, line: i64, score: f64, snippet: String }>,
    },
    Empty {
        query: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiExplainInput {
    pub symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiExplainOutput {
    Ok {
        summary: String,
        kind: String,
        defined_in: String,
        used_by: Vec<String>,
        relationships: Vec<String>,
    },
    NotFound {
        symbol: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiStatusInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiStatusOutput {
    Ok {
        indexed: bool,
        concept_count: i64,
        symbol_count: i64,
        file_count: i64,
        sync_count: i64,
        last_indexed: DateTime<Utc>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreApiReindexInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreApiReindexOutput {
    Ok {
        concept_count: i64,
        symbol_count: i64,
        file_count: i64,
        sync_count: i64,
        duration: i64,
    },
    InProgress {
        started_at: DateTime<Utc>,
    },
}

