// generated: conduit-widgets/rust/login_widget.rs
//
// Login form widget for the Conduit application.
// Binds to Password/check and JWT/generate concepts.

use std::collections::HashMap;

use crate::widget_spec::{
    A11ySpec, AnatomySpec, ConceptBinding, ElementKind, ElementNode, MachineSpec, MachineState,
    MachineTransition, WidgetCategory, WidgetSpec,
};

/// Returns the widget specification for the login form.
pub fn spec() -> WidgetSpec {
    WidgetSpec {
        name: "LoginWidget".to_string(),
        version: "1.0.0".to_string(),
        category: WidgetCategory::Form,
        concepts: vec![
            ConceptBinding {
                concept: "concept://conduit/Password".to_string(),
                actions: vec!["check".to_string()],
                queries: vec![],
            },
            ConceptBinding {
                concept: "concept://conduit/JWT".to_string(),
                actions: vec!["generate".to_string()],
                queries: vec![],
            },
        ],
        anatomy: AnatomySpec {
            component: "LoginWidget".to_string(),
            parts: vec![
                "root".to_string(),
                "form".to_string(),
                "email_field".to_string(),
                "password_field".to_string(),
                "submit_button".to_string(),
                "error_banner".to_string(),
            ],
            slots: vec![],
        },
        elements: vec![
            ElementNode {
                id: "login.email".to_string(),
                kind: ElementKind::InputText,
                label: "Email".to_string(),
                data_type: "string".to_string(),
                required: true,
                scope: "#/properties/email".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "login.password".to_string(),
                kind: ElementKind::InputText,
                label: "Password".to_string(),
                data_type: "string".to_string(),
                required: true,
                scope: "#/properties/password".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "login.submit".to_string(),
                kind: ElementKind::Trigger,
                label: "Sign in".to_string(),
                data_type: "void".to_string(),
                required: false,
                scope: "#/actions/login".to_string(),
                constraints: None,
                children: None,
            },
        ],
        machine: MachineSpec {
            initial: "idle".to_string(),
            states: HashMap::from([
                (
                    "idle".to_string(),
                    MachineState {
                        name: "idle".to_string(),
                        on: HashMap::from([(
                            "SUBMIT".to_string(),
                            MachineTransition {
                                target: "submitting".to_string(),
                                guard: None,
                                action: Some("submitCredentials".to_string()),
                            },
                        )]),
                    },
                ),
                (
                    "submitting".to_string(),
                    MachineState {
                        name: "submitting".to_string(),
                        on: HashMap::from([
                            (
                                "AUTHENTICATED".to_string(),
                                MachineTransition {
                                    target: "success".to_string(),
                                    guard: None,
                                    action: Some("storeToken".to_string()),
                                },
                            ),
                            (
                                "FAILED".to_string(),
                                MachineTransition {
                                    target: "error".to_string(),
                                    guard: None,
                                    action: Some("showError".to_string()),
                                },
                            ),
                        ]),
                    },
                ),
                (
                    "success".to_string(),
                    MachineState {
                        name: "success".to_string(),
                        on: HashMap::new(),
                    },
                ),
                (
                    "error".to_string(),
                    MachineState {
                        name: "error".to_string(),
                        on: HashMap::from([(
                            "RETRY".to_string(),
                            MachineTransition {
                                target: "idle".to_string(),
                                guard: None,
                                action: Some("clearError".to_string()),
                            },
                        )]),
                    },
                ),
            ]),
            context: serde_json::json!({
                "email": "",
                "password": "",
                "errors": []
            }),
        },
        a11y: A11ySpec {
            role: "form".to_string(),
            label: "Sign In".to_string(),
            description: Some("Log in to your Conduit account".to_string()),
            keyboard: HashMap::from([
                ("Enter".to_string(), "Submit form".to_string()),
                ("Tab".to_string(), "Move to next field".to_string()),
                ("Shift+Tab".to_string(), "Move to previous field".to_string()),
            ]),
            live_regions: Some(vec!["error_banner".to_string()]),
        },
    }
}
