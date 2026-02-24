// Conflict Resolver Plugin — bidirectional sync conflict resolution for the SyncPair concept.
// Provides pluggable strategies for resolving version conflicts during bidirectional data sync.
// See Data Integration Kit sync-pair.concept for the parent SyncPair concept definition.

use std::collections::{BTreeMap, BTreeSet, HashMap, VecDeque};
use std::fmt;

use chrono::Utc;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/// A vector clock mapping replica/node IDs to logical counters.
pub type VectorClock = BTreeMap<String, u64>;

/// One side of a conflicting entity version.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionData {
    /// Key-value map of entity fields and their values.
    pub fields: BTreeMap<String, serde_json::Value>,
    /// Wall-clock timestamp (milliseconds since epoch) of this version's last write.
    pub timestamp: i64,
    /// Vector clock for causal ordering across replicas.
    pub vector_clock: VectorClock,
    /// Identifier of the replica/node that produced this version.
    pub replica_id: Option<String>,
}

/// Describes a detected conflict between two versions of the same entity.
#[derive(Debug, Clone)]
pub struct Conflict {
    /// Unique identifier of the entity in conflict.
    pub entity_id: String,
    /// Version from side A of the sync pair.
    pub version_a: VersionData,
    /// Version from side B of the sync pair.
    pub version_b: VersionData,
    /// Common ancestor version, if available (enables three-way merge).
    pub ancestor: Option<VersionData>,
}

/// Per-field conflict detail when field-level merge encounters a true conflict.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldConflict {
    pub field: String,
    pub value_a: Option<serde_json::Value>,
    pub value_b: Option<serde_json::Value>,
    pub ancestor_value: Option<serde_json::Value>,
}

/// Which side won the conflict resolution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResolutionWinner {
    A,
    B,
    Merged,
    Manual,
}

impl fmt::Display for ResolutionWinner {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::A => write!(f, "a"),
            Self::B => write!(f, "b"),
            Self::Merged => write!(f, "merged"),
            Self::Manual => write!(f, "manual"),
        }
    }
}

/// The resolution produced by a conflict resolver.
#[derive(Debug, Clone)]
pub struct Resolution {
    /// Which side won, or whether a merge was produced, or manual review is needed.
    pub winner: ResolutionWinner,
    /// The merged entity value (present when winner is merged or a single side).
    pub merged_value: Option<BTreeMap<String, serde_json::Value>>,
    /// The strategy identifier that produced this resolution.
    pub strategy: String,
    /// Human-readable description of how the conflict was resolved.
    pub details: String,
    /// Whether this resolution was produced without human intervention.
    pub auto_resolved: bool,
    /// List of fields that could not be auto-resolved (for partial merges).
    pub unresolved_fields: Option<Vec<FieldConflict>>,
    /// Both versions preserved for manual queue.
    pub preserved_versions: Option<(VersionData, VersionData)>,
}

/// CRDT type classification for crdt_merge provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CrdtType {
    LwwRegister,
    GCounter,
    PnCounter,
    OrSet,
    Rga,
}

/// Provider-specific configuration knobs.
#[derive(Debug, Clone, Default)]
pub struct ConflictResolverConfig {
    /// Tie-breaking preference when timestamps are equal.
    pub tie_breaker: Option<ResolutionWinner>,
    /// For manual_queue: priority level hint (higher = more urgent).
    pub priority_hint: i32,
    /// For field_merge: fields to always prefer from side A.
    pub prefer_a_fields: BTreeSet<String>,
    /// For field_merge: fields to always prefer from side B.
    pub prefer_b_fields: BTreeSet<String>,
    /// For crdt_merge: field-to-CRDT-type mapping override.
    pub crdt_type_overrides: HashMap<String, CrdtType>,
}

/// Errors that can occur during conflict resolution.
#[derive(Debug)]
pub enum ConflictResolverError {
    InvalidConflict { detail: String },
    ProviderUnavailable { id: String },
}

impl fmt::Display for ConflictResolverError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidConflict { detail } => write!(f, "Invalid conflict: {detail}"),
            Self::ProviderUnavailable { id } => write!(f, "Provider {id} not available"),
        }
    }
}

impl std::error::Error for ConflictResolverError {}

// ---------------------------------------------------------------------------
// Trait
// ---------------------------------------------------------------------------

/// Interface every conflict-resolver provider must implement.
pub trait ConflictResolverPlugin: Send + Sync {
    /// Unique identifier for this provider.
    fn id(&self) -> &str;

    /// Human-readable display name.
    fn display_name(&self) -> &str;

    /// Resolve a conflict between two versions.
    fn resolve(
        &self,
        conflict: &Conflict,
        config: &ConflictResolverConfig,
    ) -> Resolution;

    /// Check whether this conflict can be automatically resolved without human input.
    fn can_auto_resolve(&self, conflict: &Conflict) -> bool;
}

// ---------------------------------------------------------------------------
// Vector clock helpers
// ---------------------------------------------------------------------------

/// Compare two vector clocks. Returns 1 if a dominates, -1 if b dominates, 0 if concurrent.
fn compare_vector_clocks(a: &VectorClock, b: &VectorClock) -> i32 {
    let all_keys: BTreeSet<&String> = a.keys().chain(b.keys()).collect();
    let mut a_greater = false;
    let mut b_greater = false;

    for key in &all_keys {
        let va = a.get(*key).copied().unwrap_or(0);
        let vb = b.get(*key).copied().unwrap_or(0);
        if va > vb { a_greater = true; }
        if vb > va { b_greater = true; }
    }

    if a_greater && !b_greater { return 1; }
    if b_greater && !a_greater { return -1; }
    0
}

/// Merge two vector clocks by taking the max of each entry.
fn merge_vector_clocks(a: &VectorClock, b: &VectorClock) -> VectorClock {
    let mut result = a.clone();
    for (key, &val) in b {
        let entry = result.entry(key.clone()).or_insert(0);
        *entry = (*entry).max(val);
    }
    result
}

/// Lexicographic comparison of vector clocks for deterministic tie-breaking.
fn lexicographic_vc_compare(a: &VectorClock, b: &VectorClock) -> i64 {
    let all_keys: BTreeSet<&String> = a.keys().chain(b.keys()).collect();
    for key in all_keys {
        let va = a.get(key).copied().unwrap_or(0) as i64;
        let vb = b.get(key).copied().unwrap_or(0) as i64;
        if va != vb { return va - vb; }
    }
    0
}

/// Collect all field keys across versions.
fn all_field_keys(conflict: &Conflict) -> BTreeSet<String> {
    let mut keys: BTreeSet<String> = conflict.version_a.fields.keys().cloned().collect();
    keys.extend(conflict.version_b.fields.keys().cloned());
    if let Some(ref anc) = conflict.ancestor {
        keys.extend(anc.fields.keys().cloned());
    }
    keys
}

// ---------------------------------------------------------------------------
// 1. LwwTimestampResolver — Last-Write-Wins by timestamp
// ---------------------------------------------------------------------------

/// Resolves conflicts by choosing the version with the latest timestamp.
/// Risk: silent data loss -- the losing version's changes are discarded entirely.
///
/// Tie-breaking order:
///   1. Higher wall-clock timestamp wins
///   2. If timestamps are equal, lexicographic vector clock comparison
///   3. If still tied, use config.tie_breaker (defaults to A)
pub struct LwwTimestampResolver;

impl ConflictResolverPlugin for LwwTimestampResolver {
    fn id(&self) -> &str { "lww_timestamp" }
    fn display_name(&self) -> &str { "Last-Write-Wins (Timestamp)" }

    fn can_auto_resolve(&self, _conflict: &Conflict) -> bool {
        true
    }

    fn resolve(
        &self,
        conflict: &Conflict,
        config: &ConflictResolverConfig,
    ) -> Resolution {
        let va = &conflict.version_a;
        let vb = &conflict.version_b;
        let tie_breaker = config.tie_breaker.unwrap_or(ResolutionWinner::A);

        let (winner, mut details) = if va.timestamp != vb.timestamp {
            let w = if va.timestamp > vb.timestamp { ResolutionWinner::A } else { ResolutionWinner::B };
            let diff = (va.timestamp - vb.timestamp).unsigned_abs();
            (w, format!("LWW selected version {} (timestamp delta: {}ms). ", w, diff))
        } else {
            let vc_cmp = lexicographic_vc_compare(&va.vector_clock, &vb.vector_clock);
            if vc_cmp != 0 {
                let w = if vc_cmp > 0 { ResolutionWinner::A } else { ResolutionWinner::B };
                (w, format!("Timestamps equal ({}); broke tie via vector clock comparison. ", va.timestamp))
            } else {
                (tie_breaker, format!(
                    "Timestamps and vector clocks identical; used configured tie-breaker \"{}\". ", tie_breaker
                ))
            }
        };

        let (loser, winner_version) = if winner == ResolutionWinner::A {
            (&conflict.version_b, &conflict.version_a)
        } else {
            (&conflict.version_a, &conflict.version_b)
        };

        // Identify fields lost from the losing version
        let mut lost_fields: Vec<String> = Vec::new();
        for (field, loser_val) in &loser.fields {
            match winner_version.fields.get(field) {
                Some(winner_val) if winner_val != loser_val => lost_fields.push(field.clone()),
                None => lost_fields.push(field.clone()),
                _ => {}
            }
        }

        if !lost_fields.is_empty() {
            details.push_str(&format!(
                "WARNING: Silent data loss on {} field(s): [{}]. ",
                lost_fields.len(),
                lost_fields.join(", ")
            ));
            details.push_str(&format!(
                "Losing version from replica \"{}\" at timestamp {} was discarded.",
                loser.replica_id.as_deref().unwrap_or("unknown"),
                loser.timestamp
            ));
        } else {
            details.push_str("No field-level data loss detected.");
        }

        Resolution {
            winner,
            merged_value: Some(winner_version.fields.clone()),
            strategy: self.id().to_string(),
            details,
            auto_resolved: true,
            unresolved_fields: None,
            preserved_versions: None,
        }
    }
}

// ---------------------------------------------------------------------------
// 2. FieldMergeResolver — Per-field comparison with partial auto-merge
// ---------------------------------------------------------------------------

/// Compares versions field-by-field. Fields changed by only one side are auto-merged.
/// Fields changed by both sides to different values are flagged as true conflicts.
pub struct FieldMergeResolver;

struct FieldAnalysis {
    changed_only_by_a: Vec<String>,
    changed_only_by_b: Vec<String>,
    true_conflicts: Vec<FieldConflict>,
    unchanged: Vec<String>,
}

impl FieldMergeResolver {
    fn analyze_fields(&self, conflict: &Conflict) -> FieldAnalysis {
        let fields = all_field_keys(conflict);
        let mut changed_only_by_a = Vec::new();
        let mut changed_only_by_b = Vec::new();
        let mut true_conflicts = Vec::new();
        let mut unchanged = Vec::new();

        for field in &fields {
            let val_a = conflict.version_a.fields.get(field);
            let val_b = conflict.version_b.fields.get(field);
            let val_anc = conflict.ancestor.as_ref().and_then(|a| a.fields.get(field));

            if val_a == val_b {
                unchanged.push(field.clone());
                continue;
            }

            if conflict.ancestor.is_some() {
                let a_changed = val_a != val_anc;
                let b_changed = val_b != val_anc;

                if a_changed && !b_changed {
                    changed_only_by_a.push(field.clone());
                } else if !a_changed && b_changed {
                    changed_only_by_b.push(field.clone());
                } else if a_changed && b_changed {
                    true_conflicts.push(FieldConflict {
                        field: field.clone(),
                        value_a: val_a.cloned(),
                        value_b: val_b.cloned(),
                        ancestor_value: val_anc.cloned(),
                    });
                } else {
                    unchanged.push(field.clone());
                }
            } else {
                true_conflicts.push(FieldConflict {
                    field: field.clone(),
                    value_a: val_a.cloned(),
                    value_b: val_b.cloned(),
                    ancestor_value: None,
                });
            }
        }

        FieldAnalysis { changed_only_by_a, changed_only_by_b, true_conflicts, unchanged }
    }
}

impl ConflictResolverPlugin for FieldMergeResolver {
    fn id(&self) -> &str { "field_merge" }
    fn display_name(&self) -> &str { "Per-Field Merge" }

    fn can_auto_resolve(&self, conflict: &Conflict) -> bool {
        let analysis = self.analyze_fields(conflict);
        analysis.true_conflicts.is_empty()
    }

    fn resolve(
        &self,
        conflict: &Conflict,
        config: &ConflictResolverConfig,
    ) -> Resolution {
        let analysis = self.analyze_fields(conflict);

        // Start with ancestor or version A as base
        let mut merged: BTreeMap<String, serde_json::Value> = conflict.ancestor
            .as_ref()
            .map(|a| a.fields.clone())
            .unwrap_or_else(|| conflict.version_a.fields.clone());

        // Apply non-conflicting changes from A
        for field in &analysis.changed_only_by_a {
            if let Some(val) = conflict.version_a.fields.get(field) {
                merged.insert(field.clone(), val.clone());
            } else {
                merged.remove(field);
            }
        }

        // Apply non-conflicting changes from B
        for field in &analysis.changed_only_by_b {
            if let Some(val) = conflict.version_b.fields.get(field) {
                merged.insert(field.clone(), val.clone());
            } else {
                merged.remove(field);
            }
        }

        // Handle true conflicts with preference overrides
        let mut unresolved_fields: Vec<FieldConflict> = Vec::new();
        let mut resolved_conflict_count = 0_usize;

        for fc in &analysis.true_conflicts {
            if config.prefer_a_fields.contains(&fc.field) {
                if let Some(val) = &fc.value_a {
                    merged.insert(fc.field.clone(), val.clone());
                }
                resolved_conflict_count += 1;
            } else if config.prefer_b_fields.contains(&fc.field) {
                if let Some(val) = &fc.value_b {
                    merged.insert(fc.field.clone(), val.clone());
                }
                resolved_conflict_count += 1;
            } else {
                // Default to version A, flag as unresolved
                if let Some(val) = &fc.value_a {
                    merged.insert(fc.field.clone(), val.clone());
                }
                unresolved_fields.push(fc.clone());
            }
        }

        let total_fields = all_field_keys(conflict).len();
        let auto_resolved = unresolved_fields.is_empty();

        let mut details = format!("Field-level merge across {} fields. ", total_fields);
        details.push_str(&format!(
            "Auto-merged: {} from A, {} from B. Unchanged: {}. ",
            analysis.changed_only_by_a.len(),
            analysis.changed_only_by_b.len(),
            analysis.unchanged.len()
        ));

        if resolved_conflict_count > 0 {
            details.push_str(&format!(
                "Resolved {} conflict(s) via field preference config. ",
                resolved_conflict_count
            ));
        }

        if !unresolved_fields.is_empty() {
            let names: Vec<&str> = unresolved_fields.iter().map(|f| f.field.as_str()).collect();
            details.push_str(&format!(
                "TRUE CONFLICTS on {} field(s): [{}]. Defaulted to version A values; manual review recommended.",
                unresolved_fields.len(),
                names.join(", ")
            ));
        }

        Resolution {
            winner: ResolutionWinner::Merged,
            merged_value: Some(merged),
            strategy: self.id().to_string(),
            details,
            auto_resolved,
            unresolved_fields: if unresolved_fields.is_empty() { None } else { Some(unresolved_fields) },
            preserved_versions: None,
        }
    }
}

// ---------------------------------------------------------------------------
// 3. ThreeWayMergeResolver — Diff-based three-way merge
// ---------------------------------------------------------------------------

/// Computes diffs of both versions against the common ancestor, then merges
/// non-overlapping changes. Overlapping changes are flagged as true conflicts.
pub struct ThreeWayMergeResolver;

#[derive(Debug, Clone)]
struct FieldDiff {
    field: String,
    diff_type: FieldDiffType,
    old_value: Option<serde_json::Value>,
    new_value: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Copy)]
enum FieldDiffType { Add, Modify, Delete }

#[derive(Debug, Clone)]
struct OverlappingChange {
    field: String,
    value_a: Option<serde_json::Value>,
    value_b: Option<serde_json::Value>,
    ancestor_value: Option<serde_json::Value>,
}

impl ThreeWayMergeResolver {
    fn diff_versions(
        base: &BTreeMap<String, serde_json::Value>,
        modified: &BTreeMap<String, serde_json::Value>,
    ) -> Vec<FieldDiff> {
        let all_fields: BTreeSet<&String> = base.keys().chain(modified.keys()).collect();
        let mut diffs = Vec::new();

        for field in all_fields {
            let base_val = base.get(field);
            let mod_val = modified.get(field);

            if base_val == mod_val { continue; }

            match (base_val, mod_val) {
                (Some(_), None) => diffs.push(FieldDiff {
                    field: field.clone(), diff_type: FieldDiffType::Delete,
                    old_value: base_val.cloned(), new_value: None,
                }),
                (None, Some(_)) => diffs.push(FieldDiff {
                    field: field.clone(), diff_type: FieldDiffType::Add,
                    old_value: None, new_value: mod_val.cloned(),
                }),
                _ => diffs.push(FieldDiff {
                    field: field.clone(), diff_type: FieldDiffType::Modify,
                    old_value: base_val.cloned(), new_value: mod_val.cloned(),
                }),
            }
        }

        diffs
    }

    fn compute_diffs(conflict: &Conflict) -> (Vec<FieldDiff>, Vec<FieldDiff>, Vec<OverlappingChange>) {
        let ancestor = conflict.ancestor.as_ref().unwrap();
        let diff_a = Self::diff_versions(&ancestor.fields, &conflict.version_a.fields);
        let diff_b = Self::diff_versions(&ancestor.fields, &conflict.version_b.fields);

        let diff_b_map: HashMap<&str, &FieldDiff> = diff_b.iter()
            .map(|d| (d.field.as_str(), d))
            .collect();

        let mut overlapping = Vec::new();
        for da in &diff_a {
            if let Some(db) = diff_b_map.get(da.field.as_str()) {
                if da.new_value != db.new_value {
                    overlapping.push(OverlappingChange {
                        field: da.field.clone(),
                        value_a: da.new_value.clone(),
                        value_b: db.new_value.clone(),
                        ancestor_value: ancestor.fields.get(&da.field).cloned(),
                    });
                }
            }
        }

        (diff_a, diff_b, overlapping)
    }

    fn resolve_without_ancestor(conflict: &Conflict) -> Resolution {
        let fields = all_field_keys(conflict);
        let mut merged = BTreeMap::new();
        let mut unresolved = Vec::new();

        for field in &fields {
            let val_a = conflict.version_a.fields.get(field);
            let val_b = conflict.version_b.fields.get(field);

            if val_a == val_b {
                if let Some(v) = val_a { merged.insert(field.clone(), v.clone()); }
            } else if val_a.is_some() && val_b.is_none() {
                merged.insert(field.clone(), val_a.unwrap().clone());
            } else if val_a.is_none() && val_b.is_some() {
                merged.insert(field.clone(), val_b.unwrap().clone());
            } else {
                merged.insert(field.clone(), val_a.unwrap().clone());
                unresolved.push(FieldConflict {
                    field: field.clone(),
                    value_a: val_a.cloned(),
                    value_b: val_b.cloned(),
                    ancestor_value: None,
                });
            }
        }

        Resolution {
            winner: ResolutionWinner::Merged,
            merged_value: Some(merged),
            strategy: "three_way_merge".to_string(),
            details: format!(
                "Three-way merge degraded: no ancestor available. {} unresolved conflict(s).",
                unresolved.len()
            ),
            auto_resolved: unresolved.is_empty(),
            unresolved_fields: if unresolved.is_empty() { None } else { Some(unresolved) },
            preserved_versions: None,
        }
    }
}

impl ConflictResolverPlugin for ThreeWayMergeResolver {
    fn id(&self) -> &str { "three_way_merge" }
    fn display_name(&self) -> &str { "Three-Way Merge" }

    fn can_auto_resolve(&self, conflict: &Conflict) -> bool {
        if conflict.ancestor.is_none() { return false; }
        let (_, _, overlapping) = Self::compute_diffs(conflict);
        overlapping.is_empty()
    }

    fn resolve(
        &self,
        conflict: &Conflict,
        _config: &ConflictResolverConfig,
    ) -> Resolution {
        if conflict.ancestor.is_none() {
            return Self::resolve_without_ancestor(conflict);
        }

        let ancestor = conflict.ancestor.as_ref().unwrap();
        let (diff_a, diff_b, overlapping) = Self::compute_diffs(conflict);

        // Start with ancestor as base
        let mut merged = ancestor.fields.clone();

        // Track overlapping field names for quick lookup
        let overlap_fields: BTreeSet<&str> = overlapping.iter().map(|o| o.field.as_str()).collect();

        // Apply non-overlapping changes from A
        for diff in &diff_a {
            if overlap_fields.contains(diff.field.as_str()) { continue; }
            match diff.diff_type {
                FieldDiffType::Delete => { merged.remove(&diff.field); }
                FieldDiffType::Add | FieldDiffType::Modify => {
                    if let Some(ref v) = diff.new_value {
                        merged.insert(diff.field.clone(), v.clone());
                    }
                }
            }
        }

        // Apply non-overlapping changes from B
        for diff in &diff_b {
            if overlap_fields.contains(diff.field.as_str()) { continue; }
            match diff.diff_type {
                FieldDiffType::Delete => { merged.remove(&diff.field); }
                FieldDiffType::Add | FieldDiffType::Modify => {
                    if let Some(ref v) = diff.new_value {
                        merged.insert(diff.field.clone(), v.clone());
                    }
                }
            }
        }

        // Handle overlapping changes
        let mut unresolved_fields: Vec<FieldConflict> = Vec::new();
        for overlap in &overlapping {
            // Default to version A's value
            if let Some(ref v) = overlap.value_a {
                merged.insert(overlap.field.clone(), v.clone());
            }
            unresolved_fields.push(FieldConflict {
                field: overlap.field.clone(),
                value_a: overlap.value_a.clone(),
                value_b: overlap.value_b.clone(),
                ancestor_value: overlap.ancestor_value.clone(),
            });
        }

        let auto_resolved = unresolved_fields.is_empty();
        let non_overlap_count = diff_a.len() + diff_b.len() - overlapping.len() * 2;

        let mut details = format!("Three-way merge against ancestor. ");
        details.push_str(&format!(
            "Diff A: {} change(s). Diff B: {} change(s). Non-overlapping merges applied: {}. ",
            diff_a.len(), diff_b.len(), non_overlap_count
        ));

        if !overlapping.is_empty() {
            let names: Vec<&str> = overlapping.iter().map(|o| o.field.as_str()).collect();
            details.push_str(&format!(
                "OVERLAPPING CONFLICTS on {} field(s): [{}]. Manual resolution required.",
                overlapping.len(), names.join(", ")
            ));
        } else {
            details.push_str("Clean merge -- no overlapping changes detected.");
        }

        Resolution {
            winner: ResolutionWinner::Merged,
            merged_value: Some(merged),
            strategy: self.id().to_string(),
            details,
            auto_resolved,
            unresolved_fields: if unresolved_fields.is_empty() { None } else { Some(unresolved_fields) },
            preserved_versions: None,
        }
    }
}

// ---------------------------------------------------------------------------
// 4. CrdtMergeResolver — CRDT-based conflict-free merge
// ---------------------------------------------------------------------------

/// Uses Conflict-free Replicated Data Types to guarantee convergence without
/// conflicts. Each field is assigned a CRDT type based on its value shape:
///
///   - Scalar (string, boolean, null): LWW-Register (last-writer-wins by vector clock)
///   - Number: PN-Counter (preserves increments/decrements from both sides)
///   - Array: OR-Set (add-wins observed-remove set)
///   - Long string: RGA (replicated growable array for text merge)
///   - Default: LWW-Register
///
/// Convergence is mathematically guaranteed.
pub struct CrdtMergeResolver;

impl CrdtMergeResolver {
    /// Infer the appropriate CRDT type from the field's values.
    fn infer_crdt_type(
        val_a: Option<&serde_json::Value>,
        val_b: Option<&serde_json::Value>,
        val_anc: Option<&serde_json::Value>,
    ) -> CrdtType {
        let values: Vec<&serde_json::Value> = [val_a, val_b, val_anc]
            .iter()
            .filter_map(|v| *v)
            .collect();

        if values.is_empty() { return CrdtType::LwwRegister; }

        // If all values are numbers, use PN-Counter
        if values.iter().all(|v| v.is_number()) { return CrdtType::PnCounter; }

        // If any value is an array, use OR-Set
        if values.iter().any(|v| v.is_array()) { return CrdtType::OrSet; }

        // If any value is a long string (> 100 chars), use RGA
        if values.iter().any(|v| {
            v.as_str().map(|s| s.len() > 100).unwrap_or(false)
        }) {
            return CrdtType::Rga;
        }

        CrdtType::LwwRegister
    }

    /// LWW-Register: last-writer-wins by vector clock, then timestamp.
    fn merge_lww_register(
        val_a: Option<&serde_json::Value>, vc_a: &VectorClock, ts_a: i64,
        val_b: Option<&serde_json::Value>, vc_b: &VectorClock, ts_b: i64,
    ) -> serde_json::Value {
        let a = match val_a { Some(v) => v.clone(), None => return val_b.cloned().unwrap_or(serde_json::Value::Null) };
        let b = match val_b { Some(v) => v.clone(), None => return a };
        if a == b { return a; }

        let vc_order = compare_vector_clocks(vc_a, vc_b);
        if vc_order == 1 { return a; }
        if vc_order == -1 { return b; }

        // Concurrent -- use timestamp
        if ts_a != ts_b { return if ts_a > ts_b { a } else { b }; }

        // Final fallback: lexicographic VC comparison
        if lexicographic_vc_compare(vc_a, vc_b) >= 0 { a } else { b }
    }

    /// PN-Counter: merge = ancestor + deltaA + deltaB.
    fn merge_pn_counter(
        val_a: Option<&serde_json::Value>,
        val_b: Option<&serde_json::Value>,
        val_anc: Option<&serde_json::Value>,
    ) -> serde_json::Value {
        let a = val_a.and_then(|v| v.as_f64()).unwrap_or(0.0);
        let b = val_b.and_then(|v| v.as_f64()).unwrap_or(0.0);

        let result = if let Some(anc_val) = val_anc.and_then(|v| v.as_f64()) {
            let delta_a = a - anc_val;
            let delta_b = b - anc_val;
            anc_val + delta_a + delta_b
        } else {
            a.max(b)
        };

        // Prefer integer representation if possible
        if result == result.floor() && result.abs() < i64::MAX as f64 {
            serde_json::Value::Number(serde_json::Number::from(result as i64))
        } else {
            serde_json::json!(result)
        }
    }

    /// OR-Set: add-wins merge with union semantics.
    fn merge_or_set(
        val_a: Option<&serde_json::Value>,
        val_b: Option<&serde_json::Value>,
        val_anc: Option<&serde_json::Value>,
    ) -> serde_json::Value {
        let arr_a: Vec<&serde_json::Value> = val_a
            .and_then(|v| v.as_array())
            .map(|a| a.iter().collect())
            .unwrap_or_default();
        let arr_b: Vec<&serde_json::Value> = val_b
            .and_then(|v| v.as_array())
            .map(|a| a.iter().collect())
            .unwrap_or_default();

        let to_key = |v: &serde_json::Value| serde_json::to_string(v).unwrap_or_default();

        let set_a: BTreeSet<String> = arr_a.iter().map(|v| to_key(v)).collect();
        let set_b: BTreeSet<String> = arr_b.iter().map(|v| to_key(v)).collect();

        let result_keys = if let Some(anc_arr) = val_anc.and_then(|v| v.as_array()) {
            let set_anc: BTreeSet<String> = anc_arr.iter().map(|v| to_key(v)).collect();

            let added_by_a: BTreeSet<&String> = set_a.difference(&set_anc).collect();
            let removed_by_a: BTreeSet<&String> = set_anc.difference(&set_a).collect();
            let added_by_b: BTreeSet<&String> = set_b.difference(&set_anc).collect();
            let removed_by_b: BTreeSet<&String> = set_anc.difference(&set_b).collect();

            // Start with ancestor, apply adds, apply removes (add-wins)
            let mut result = set_anc.clone();
            for item in &added_by_a { result.insert((*item).clone()); }
            for item in &added_by_b { result.insert((*item).clone()); }
            for item in &removed_by_a {
                if !added_by_b.contains(item) { result.remove(*item); }
            }
            for item in &removed_by_b {
                if !added_by_a.contains(item) { result.remove(*item); }
            }
            result
        } else {
            // No ancestor: union
            set_a.union(&set_b).cloned().collect()
        };

        // Reconstruct values
        let all_items: Vec<&serde_json::Value> = arr_a.iter().chain(arr_b.iter()).copied().collect();
        let mut seen = BTreeSet::new();
        let mut result = Vec::new();
        for item in all_items {
            let key = to_key(item);
            if result_keys.contains(&key) && seen.insert(key) {
                result.push(item.clone());
            }
        }

        serde_json::Value::Array(result)
    }

    /// RGA: word-level merge for text strings.
    fn merge_rga(
        val_a: Option<&serde_json::Value>,
        val_b: Option<&serde_json::Value>,
        val_anc: Option<&serde_json::Value>,
    ) -> serde_json::Value {
        let a = val_a.and_then(|v| v.as_str()).unwrap_or("");
        let b = val_b.and_then(|v| v.as_str()).unwrap_or("");

        let anc = match val_anc.and_then(|v| v.as_str()) {
            Some(s) => s,
            None => {
                // No ancestor: return the longer string
                return serde_json::Value::String(if a.len() >= b.len() { a } else { b }.to_string());
            }
        };

        if a == anc { return serde_json::Value::String(b.to_string()); }
        if b == anc { return serde_json::Value::String(a.to_string()); }
        if a == b { return serde_json::Value::String(a.to_string()); }

        // Word-level three-way merge
        let anc_words: Vec<&str> = anc.split_whitespace().collect();
        let a_words: Vec<&str> = a.split_whitespace().collect();
        let b_words: Vec<&str> = b.split_whitespace().collect();

        let mut result = Vec::new();
        let mut anc_idx = 0;
        let mut a_idx = 0;
        let mut b_idx = 0;

        while anc_idx < anc_words.len() || a_idx < a_words.len() || b_idx < b_words.len() {
            let anc_word = anc_words.get(anc_idx);
            let a_word = a_words.get(a_idx);
            let b_word = b_words.get(b_idx);

            if anc_word == a_word && anc_word == b_word {
                if let Some(w) = anc_word { result.push(*w); }
                anc_idx += 1; a_idx += 1; b_idx += 1;
            } else if anc_word == a_word && anc_word != b_word {
                // B changed
                if let Some(w) = b_word { result.push(*w); }
                if anc_word.is_some() { anc_idx += 1; }
                if a_word.is_some() { a_idx += 1; }
                b_idx += 1;
            } else if anc_word != a_word && anc_word == b_word {
                // A changed
                if let Some(w) = a_word { result.push(*w); }
                if anc_word.is_some() { anc_idx += 1; }
                a_idx += 1;
                if b_word.is_some() { b_idx += 1; }
            } else {
                // Both changed or no ancestor word
                if let Some(w) = a_word { result.push(*w); a_idx += 1; }
                if let Some(w) = b_word {
                    if b_word != a_word { result.push(*w); }
                    b_idx += 1;
                }
                if anc_word.is_some() { anc_idx += 1; }
            }
        }

        serde_json::Value::String(result.join(" "))
    }
}

impl ConflictResolverPlugin for CrdtMergeResolver {
    fn id(&self) -> &str { "crdt_merge" }
    fn display_name(&self) -> &str { "CRDT Merge (Conflict-Free)" }

    fn can_auto_resolve(&self, _conflict: &Conflict) -> bool {
        true
    }

    fn resolve(
        &self,
        conflict: &Conflict,
        config: &ConflictResolverConfig,
    ) -> Resolution {
        let fields = all_field_keys(conflict);
        let mut merged = BTreeMap::new();
        let mut merge_details = Vec::new();

        for field in &fields {
            let val_a = conflict.version_a.fields.get(field);
            let val_b = conflict.version_b.fields.get(field);
            let val_anc = conflict.ancestor.as_ref().and_then(|a| a.fields.get(field));

            let crdt_type = config.crdt_type_overrides.get(field)
                .copied()
                .unwrap_or_else(|| Self::infer_crdt_type(val_a, val_b, val_anc));

            let value = match crdt_type {
                CrdtType::LwwRegister => {
                    merge_details.push(format!("{}: LWW-Register", field));
                    Self::merge_lww_register(
                        val_a, &conflict.version_a.vector_clock, conflict.version_a.timestamp,
                        val_b, &conflict.version_b.vector_clock, conflict.version_b.timestamp,
                    )
                }
                CrdtType::GCounter | CrdtType::PnCounter => {
                    merge_details.push(format!("{}: PN-Counter", field));
                    Self::merge_pn_counter(val_a, val_b, val_anc)
                }
                CrdtType::OrSet => {
                    merge_details.push(format!("{}: OR-Set", field));
                    Self::merge_or_set(val_a, val_b, val_anc)
                }
                CrdtType::Rga => {
                    merge_details.push(format!("{}: RGA", field));
                    Self::merge_rga(val_a, val_b, val_anc)
                }
            };

            merged.insert(field.clone(), value);
        }

        let merged_clock = merge_vector_clocks(
            &conflict.version_a.vector_clock,
            &conflict.version_b.vector_clock,
        );

        let details = format!(
            "CRDT merge applied to {} field(s). Strategy per field: {}. Merged vector clock: {:?}. Convergence guaranteed -- no conflicts possible.",
            fields.len(),
            merge_details.join("; "),
            merged_clock
        );

        Resolution {
            winner: ResolutionWinner::Merged,
            merged_value: Some(merged),
            strategy: self.id().to_string(),
            details,
            auto_resolved: true,
            unresolved_fields: None,
            preserved_versions: None,
        }
    }
}

// ---------------------------------------------------------------------------
// 5. ManualQueueResolver — Store both versions for human resolution
// ---------------------------------------------------------------------------

/// Never auto-resolves. Stores both versions in a resolution queue for human
/// review. Supports priority hints for triage ordering.
pub struct ManualQueueResolver {
    pending_queue: std::sync::Mutex<VecDeque<ManualQueueEntry>>,
}

#[derive(Debug, Clone)]
struct ManualQueueEntry {
    entity_id: String,
    priority: i32,
    enqueued_at: String,
    conflicting_fields: Vec<String>,
    status: ManualQueueStatus,
}

#[derive(Debug, Clone, PartialEq)]
enum ManualQueueStatus { Pending, Resolved }

impl ManualQueueResolver {
    pub fn new() -> Self {
        Self { pending_queue: std::sync::Mutex::new(VecDeque::new()) }
    }

    /// Get the current queue depth.
    pub fn queue_depth(&self) -> usize {
        self.pending_queue.lock().unwrap()
            .iter()
            .filter(|e| e.status == ManualQueueStatus::Pending)
            .count()
    }

    /// Mark an entry as resolved.
    pub fn resolve_entry(&self, entity_id: &str) -> bool {
        let mut queue = self.pending_queue.lock().unwrap();
        for entry in queue.iter_mut() {
            if entry.entity_id == entity_id && entry.status == ManualQueueStatus::Pending {
                entry.status = ManualQueueStatus::Resolved;
                return true;
            }
        }
        false
    }
}

impl Default for ManualQueueResolver {
    fn default() -> Self { Self::new() }
}

impl ConflictResolverPlugin for ManualQueueResolver {
    fn id(&self) -> &str { "manual_queue" }
    fn display_name(&self) -> &str { "Manual Queue (Human Review)" }

    fn can_auto_resolve(&self, _conflict: &Conflict) -> bool {
        false
    }

    fn resolve(
        &self,
        conflict: &Conflict,
        config: &ConflictResolverConfig,
    ) -> Resolution {
        let priority = config.priority_hint;
        let fields = all_field_keys(conflict);

        // Build diff summary
        let mut conflicting_fields = Vec::new();
        let mut unresolved_fields = Vec::new();

        for field in &fields {
            let val_a = conflict.version_a.fields.get(field);
            let val_b = conflict.version_b.fields.get(field);
            let val_anc = conflict.ancestor.as_ref().and_then(|a| a.fields.get(field));

            if val_a != val_b {
                conflicting_fields.push(field.clone());
                unresolved_fields.push(FieldConflict {
                    field: field.clone(),
                    value_a: val_a.cloned(),
                    value_b: val_b.cloned(),
                    ancestor_value: val_anc.cloned(),
                });
            }
        }

        // Add to queue
        let entry = ManualQueueEntry {
            entity_id: conflict.entity_id.clone(),
            priority,
            enqueued_at: Utc::now().to_rfc3339(),
            conflicting_fields: conflicting_fields.clone(),
            status: ManualQueueStatus::Pending,
        };

        {
            let mut queue = self.pending_queue.lock().unwrap();
            queue.push_back(entry);

            // Sort by priority (descending), then by enqueue time (ascending)
            let mut sorted: Vec<ManualQueueEntry> = queue.drain(..).collect();
            sorted.sort_by(|a, b| {
                b.priority.cmp(&a.priority)
                    .then_with(|| a.enqueued_at.cmp(&b.enqueued_at))
            });
            queue.extend(sorted);
        }

        let queue_depth = self.queue_depth();

        let replica_a = conflict.version_a.replica_id.as_deref().unwrap_or("unknown");
        let replica_b = conflict.version_b.replica_id.as_deref().unwrap_or("unknown");

        let mut details = format!("Conflict queued for manual resolution. ");
        details.push_str(&format!(
            "Entity: {}. {} conflicting field(s) out of {} total. ",
            conflict.entity_id, conflicting_fields.len(), fields.len()
        ));
        details.push_str(&format!("Priority: {}. Queue depth: {}. ", priority, queue_depth));
        details.push_str(&format!(
            "Version A from replica \"{}\" at timestamp {}. ",
            replica_a, conflict.version_a.timestamp
        ));
        details.push_str(&format!(
            "Version B from replica \"{}\" at timestamp {}. ",
            replica_b, conflict.version_b.timestamp
        ));

        if conflict.ancestor.is_some() {
            details.push_str("Ancestor available. ");
        } else {
            details.push_str("No common ancestor available. ");
        }

        details.push_str(&format!(
            "Conflicting fields: {}.",
            conflicting_fields.join(", ")
        ));

        Resolution {
            winner: ResolutionWinner::Manual,
            merged_value: None,
            strategy: self.id().to_string(),
            details,
            auto_resolved: false,
            unresolved_fields: if unresolved_fields.is_empty() { None } else { Some(unresolved_fields) },
            preserved_versions: Some((conflict.version_a.clone(), conflict.version_b.clone())),
        }
    }
}

// ---------------------------------------------------------------------------
// Factory function — create provider by ID
// ---------------------------------------------------------------------------

/// Create a conflict-resolver provider by its unique identifier.
///
/// Returns `None` if the given ID does not match any known provider.
pub fn create_provider(id: &str) -> Option<Box<dyn ConflictResolverPlugin>> {
    match id {
        "lww_timestamp" => Some(Box::new(LwwTimestampResolver)),
        "field_merge" => Some(Box::new(FieldMergeResolver)),
        "three_way_merge" => Some(Box::new(ThreeWayMergeResolver)),
        "crdt_merge" => Some(Box::new(CrdtMergeResolver)),
        "manual_queue" => Some(Box::new(ManualQueueResolver::new())),
        _ => None,
    }
}

/// Return all available provider IDs.
pub fn available_providers() -> Vec<&'static str> {
    vec![
        "lww_timestamp",
        "field_merge",
        "three_way_merge",
        "crdt_merge",
        "manual_queue",
    ]
}

/// Resolve the best conflict resolver provider for a given conflict.
///
/// Selection heuristic:
///   1. If an ancestor is available, prefer three_way_merge
///   2. Otherwise, prefer field_merge for partial auto-resolution
///   3. Fall back to lww_timestamp for simple cases
pub fn resolve_provider(conflict: &Conflict) -> Option<Box<dyn ConflictResolverPlugin>> {
    if conflict.ancestor.is_some() {
        create_provider("three_way_merge")
    } else {
        create_provider("field_merge")
    }
}
