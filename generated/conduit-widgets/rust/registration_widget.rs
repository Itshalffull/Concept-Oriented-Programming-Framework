// generated: conduit-widgets/rust/registration_widget.rs
//
// User registration form widget for the Conduit application.
// Binds to User/register and Password/validate+set concepts.

use std::collections::HashMap;

use crate::widget_spec::{
    A11ySpec, AnatomySpec, ConceptBinding, ElementConstraints, ElementKind, ElementNode,
    MachineSpec, MachineState, MachineTransition, WidgetCategory, WidgetSpec,
};

/// Returns the widget specification for the registration form.
pub fn spec() -> WidgetSpec {
    WidgetSpec {
        name: "RegistrationWidget".to_string(),
        version: "1.0.0".to_string(),
        category: WidgetCategory::Form,
        concepts: vec![
            ConceptBinding {
                concept: "concept://conduit/User".to_string(),
                actions: vec!["register".to_string()],
                queries: vec![],
            },
            ConceptBinding {
                concept: "concept://conduit/Password".to_string(),
                actions: vec!["validate".to_string(), "set".to_string()],
                queries: vec![],
            },
        ],
        anatomy: AnatomySpec {
            component: "RegistrationWidget".to_string(),
            parts: vec![
                "root".to_string(),
                "form".to_string(),
                "username_field".to_string(),
                "email_field".to_string(),
                "password_field".to_string(),
                "submit_button".to_string(),
                "error_banner".to_string(),
                "success_message".to_string(),
            ],
            slots: vec![],
        },
        elements: vec![
            ElementNode {
                id: "registration.username".to_string(),
                kind: ElementKind::InputText,
                label: "Username".to_string(),
                data_type: "string".to_string(),
                required: true,
                scope: "#/properties/username".to_string(),
                constraints: Some(ElementConstraints {
                    min: None,
                    max: None,
                    min_length: None,
                    max_length: Some(50),
                    pattern: None,
                    options: None,
                }),
                children: None,
            },
            ElementNode {
                id: "registration.email".to_string(),
                kind: ElementKind::InputText,
                label: "Email".to_string(),
                data_type: "string".to_string(),
                required: true,
                scope: "#/properties/email".to_string(),
                constraints: Some(ElementConstraints {
                    min: None,
                    max: None,
                    min_length: None,
                    max_length: None,
                    pattern: Some(r"^[^@\s]+@[^@\s]+\.[^@\s]+$".to_string()),
                    options: None,
                }),
                children: None,
            },
            ElementNode {
                id: "registration.password".to_string(),
                kind: ElementKind::InputText,
                label: "Password".to_string(),
                data_type: "string".to_string(),
                required: true,
                scope: "#/properties/password".to_string(),
                constraints: Some(ElementConstraints {
                    min: None,
                    max: None,
                    min_length: Some(8),
                    max_length: None,
                    pattern: None,
                    options: None,
                }),
                children: None,
            },
            ElementNode {
                id: "registration.submit".to_string(),
                kind: ElementKind::Trigger,
                label: "Sign up".to_string(),
                data_type: "void".to_string(),
                required: false,
                scope: "#/actions/register".to_string(),
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
                                target: "validating".to_string(),
                                guard: None,
                                action: Some("validateFields".to_string()),
                            },
                        )]),
                    },
                ),
                (
                    "validating".to_string(),
                    MachineState {
                        name: "validating".to_string(),
                        on: HashMap::from([
                            (
                                "VALID".to_string(),
                                MachineTransition {
                                    target: "registering".to_string(),
                                    guard: None,
                                    action: Some("submitRegistration".to_string()),
                                },
                            ),
                            (
                                "INVALID".to_string(),
                                MachineTransition {
                                    target: "idle".to_string(),
                                    guard: None,
                                    action: Some("showValidationErrors".to_string()),
                                },
                            ),
                        ]),
                    },
                ),
                (
                    "registering".to_string(),
                    MachineState {
                        name: "registering".to_string(),
                        on: HashMap::from([
                            (
                                "REGISTERED".to_string(),
                                MachineTransition {
                                    target: "success".to_string(),
                                    guard: None,
                                    action: Some("onRegistered".to_string()),
                                },
                            ),
                            (
                                "ERROR".to_string(),
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
                "username": "",
                "email": "",
                "password": "",
                "errors": []
            }),
        },
        a11y: A11ySpec {
            role: "form".to_string(),
            label: "User Registration".to_string(),
            description: Some("Create a new account on Conduit".to_string()),
            keyboard: HashMap::from([
                ("Enter".to_string(), "Submit form".to_string()),
                ("Tab".to_string(), "Move to next field".to_string()),
                ("Shift+Tab".to_string(), "Move to previous field".to_string()),
            ]),
            live_regions: Some(vec![
                "error_banner".to_string(),
                "success_message".to_string(),
            ]),
        },
    }
}
