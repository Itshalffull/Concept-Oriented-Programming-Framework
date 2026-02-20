// generated: conduit-widgets/rust/widget_spec.rs
//
// Shared COIF widget abstraction types for the Conduit application.
// Each widget is described by a WidgetSpec containing concept bindings,
// anatomy, abstract element trees, finite state machines, and accessibility metadata.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// The kind of abstract UI element.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ElementKind {
    InputText,
    InputNumber,
    InputDate,
    InputBool,
    SelectionSingle,
    SelectionMulti,
    Trigger,
    Navigation,
    OutputText,
    OutputNumber,
    OutputDate,
    OutputBool,
    Group,
    Container,
    RichText,
    FileUpload,
    MediaDisplay,
}

/// A single option within a selection element.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SelectionOption {
    pub value: String,
    pub label: String,
}

/// Validation and range constraints for an element.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ElementConstraints {
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub min_length: Option<usize>,
    pub max_length: Option<usize>,
    pub pattern: Option<String>,
    pub options: Option<Vec<SelectionOption>>,
}

/// A node in the abstract element tree. Nodes may contain children for
/// composite layouts (groups, containers).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ElementNode {
    pub id: String,
    pub kind: ElementKind,
    pub label: String,
    pub data_type: String,
    pub required: bool,
    pub scope: String,
    pub constraints: Option<ElementConstraints>,
    pub children: Option<Vec<ElementNode>>,
}

/// Which concept URIs and actions/queries the widget connects to.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConceptBinding {
    pub concept: String,
    pub actions: Vec<String>,
    pub queries: Vec<String>,
}

/// Named structural parts and slots for the widget anatomy.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnatomySpec {
    pub component: String,
    pub parts: Vec<String>,
    pub slots: Vec<String>,
}

/// A single transition in the finite state machine.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MachineTransition {
    pub target: String,
    pub guard: Option<String>,
    pub action: Option<String>,
}

/// A named state with its event-to-transition map.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MachineState {
    pub name: String,
    pub on: HashMap<String, MachineTransition>,
}

/// The finite state machine governing the widget lifecycle.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MachineSpec {
    pub initial: String,
    pub states: HashMap<String, MachineState>,
    pub context: serde_json::Value,
}

/// Accessibility metadata: ARIA role, keyboard interactions, live regions.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct A11ySpec {
    pub role: String,
    pub label: String,
    pub description: Option<String>,
    pub keyboard: HashMap<String, String>,
    pub live_regions: Option<Vec<String>>,
}

/// High-level widget classification.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WidgetCategory {
    Form,
    Display,
    Composite,
    Navigation,
}

/// The complete specification for a single COIF widget.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetSpec {
    pub name: String,
    pub version: String,
    pub category: WidgetCategory,
    pub concepts: Vec<ConceptBinding>,
    pub anatomy: AnatomySpec,
    pub elements: Vec<ElementNode>,
    pub machine: MachineSpec,
    pub a11y: A11ySpec,
}
