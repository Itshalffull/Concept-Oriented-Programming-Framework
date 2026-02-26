// ============================================================
// Clef Concept Implementations — Rust
//
// Module declarations for all concept implementations plus storage.
// ============================================================

pub mod storage;

// App concepts
pub mod user;
pub mod password;
pub mod jwt;
pub mod profile;
pub mod article;
pub mod comment;
pub mod tag;
pub mod favorite;
pub mod follow;
pub mod echo;

// Foundation kit concepts
pub mod content_node;
pub mod content_storage;
pub mod outline;
pub mod property;
pub mod type_system;
pub mod page_as_record;
pub mod content_parser;
pub mod intent;

// Identity kit concepts
pub mod authentication;
pub mod authorization;
pub mod access_control;
pub mod session;

// Linking kit concepts
pub mod reference;
pub mod backlink;
pub mod relation;
pub mod alias;

// Classification kit concepts
pub mod classification_tag;
pub mod taxonomy;

// Schema and structure concepts
pub mod schema;
pub mod namespace;

// Query and search concepts
pub mod query;
pub mod search_index;
pub mod exposed_filter;

// View and display concepts
pub mod view;
pub mod display_mode;
pub mod form_builder;
pub mod renderer;

// Collection and graph concepts
pub mod collection;
pub mod graph;

// Content kit concepts
pub mod daily_note;
pub mod comment_threaded;
pub mod synced_content;
pub mod template;
pub mod canvas;
pub mod version;

// Computation kit concepts
pub mod formula;
pub mod computation_token;
pub mod expression_language;

// Automation kit concepts
pub mod workflow;
pub mod automation_rule;
pub mod queue;
pub mod control;

// Layout kit concepts
pub mod component;

// Infrastructure kit concepts
pub mod cache;
pub mod config_sync;
pub mod pathauto;
pub mod plugin_registry;
pub mod event_bus;
pub mod validator;

// Media kit concepts
pub mod file_management;
pub mod media_asset;

// Collaboration kit concepts
pub mod collaboration_flag;
pub mod group;

// Notification kit concepts
pub mod notification;

// Data integration kit concepts
pub mod data_source;
pub mod connector;
pub mod capture;
pub mod field_mapping;
pub mod transform;
pub mod enricher;
pub mod sync_pair;
pub mod data_quality;
pub mod provenance;
pub mod progressive_schema;
