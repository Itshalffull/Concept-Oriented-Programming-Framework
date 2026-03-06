// Governance Suite — Rust Modules
//
// Core concepts and pluggable provider implementations for governance systems.

// Core concept types (existing)
pub mod governance_decision;
pub mod governance_execution;
pub mod governance_identity;
pub mod governance_resources;
pub mod governance_rules;
pub mod governance_structure;
pub mod governance_transparency;

// Provider implementations
pub mod weight_providers;
pub mod counting_method_providers;
pub mod sybil_providers;
pub mod reputation_providers;
pub mod policy_evaluator_providers;
pub mod finality_providers;
