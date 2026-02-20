// generated: conduit-widgets/rust/settings_widget.rs
//
// User settings widget for the Conduit application.
// Binds to Profile/update and Password/validate+set concepts.

use std::collections::HashMap;

use crate::widget_spec::{
    A11ySpec, AnatomySpec, ConceptBinding, ElementConstraints, ElementKind, ElementNode,
    MachineSpec, MachineState, MachineTransition, WidgetCategory, WidgetSpec,
};

/// Returns the widget specification for user settings.
pub fn spec() -> WidgetSpec {
    WidgetSpec {
        name: "SettingsWidget".to_string(),
        version: "1.0.0".to_string(),
        category: WidgetCategory::Form,
        concepts: vec![
            ConceptBinding {
                concept: "concept://conduit/Profile".to_string(),
                actions: vec!["update".to_string()],
                queries: vec![],
            },
            ConceptBinding {
                concept: "concept://conduit/Password".to_string(),
                actions: vec!["validate".to_string(), "set".to_string()],
                queries: vec![],
            },
        ],
        anatomy: AnatomySpec {
            component: "SettingsWidget".to_string(),
            parts: vec![
                "root".to_string(),
                "profile_section".to_string(),
                "image_field".to_string(),
                "username_field".to_string(),
                "bio_field".to_string(),
                "password_section".to_string(),
                "current_password_field".to_string(),
                "new_password_field".to_string(),
                "save_button".to_string(),
                "logout_button".to_string(),
                "success_message".to_string(),
                "error_banner".to_string(),
            ],
            slots: vec![],
        },
        elements: vec![
            ElementNode {
                id: "settings.image".to_string(),
                kind: ElementKind::InputText,
                label: "URL of profile picture".to_string(),
                data_type: "string".to_string(),
                required: false,
                scope: "#/properties/image".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "settings.username".to_string(),
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
                id: "settings.bio".to_string(),
                kind: ElementKind::InputText,
                label: "Short bio about you".to_string(),
                data_type: "string".to_string(),
                required: false,
                scope: "#/properties/bio".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "settings.email".to_string(),
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
                id: "settings.current_password".to_string(),
                kind: ElementKind::InputText,
                label: "Current Password".to_string(),
                data_type: "string".to_string(),
                required: false,
                scope: "#/properties/currentPassword".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "settings.new_password".to_string(),
                kind: ElementKind::InputText,
                label: "New Password".to_string(),
                data_type: "string".to_string(),
                required: false,
                scope: "#/properties/newPassword".to_string(),
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
                id: "settings.save".to_string(),
                kind: ElementKind::Trigger,
                label: "Update Settings".to_string(),
                data_type: "void".to_string(),
                required: false,
                scope: "#/actions/save".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "settings.logout".to_string(),
                kind: ElementKind::Trigger,
                label: "Or click here to logout.".to_string(),
                data_type: "void".to_string(),
                required: false,
                scope: "#/actions/logout".to_string(),
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
                            "EDIT".to_string(),
                            MachineTransition {
                                target: "editing".to_string(),
                                guard: None,
                                action: Some("loadCurrentSettings".to_string()),
                            },
                        )]),
                    },
                ),
                (
                    "editing".to_string(),
                    MachineState {
                        name: "editing".to_string(),
                        on: HashMap::from([
                            (
                                "SAVE".to_string(),
                                MachineTransition {
                                    target: "validating".to_string(),
                                    guard: None,
                                    action: Some("validateFields".to_string()),
                                },
                            ),
                            (
                                "LOGOUT".to_string(),
                                MachineTransition {
                                    target: "idle".to_string(),
                                    guard: None,
                                    action: Some("performLogout".to_string()),
                                },
                            ),
                        ]),
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
                                    target: "saving".to_string(),
                                    guard: None,
                                    action: Some("submitSettings".to_string()),
                                },
                            ),
                            (
                                "INVALID".to_string(),
                                MachineTransition {
                                    target: "editing".to_string(),
                                    guard: None,
                                    action: Some("showValidationErrors".to_string()),
                                },
                            ),
                        ]),
                    },
                ),
                (
                    "saving".to_string(),
                    MachineState {
                        name: "saving".to_string(),
                        on: HashMap::from([
                            (
                                "SAVED".to_string(),
                                MachineTransition {
                                    target: "success".to_string(),
                                    guard: None,
                                    action: Some("onSettingsSaved".to_string()),
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
                        on: HashMap::from([(
                            "EDIT".to_string(),
                            MachineTransition {
                                target: "editing".to_string(),
                                guard: None,
                                action: Some("clearSuccess".to_string()),
                            },
                        )]),
                    },
                ),
                (
                    "error".to_string(),
                    MachineState {
                        name: "error".to_string(),
                        on: HashMap::from([(
                            "RETRY".to_string(),
                            MachineTransition {
                                target: "editing".to_string(),
                                guard: None,
                                action: Some("clearError".to_string()),
                            },
                        )]),
                    },
                ),
            ]),
            context: serde_json::json!({
                "image": "",
                "username": "",
                "bio": "",
                "email": "",
                "currentPassword": "",
                "newPassword": "",
                "errors": []
            }),
        },
        a11y: A11ySpec {
            role: "form".to_string(),
            label: "Settings".to_string(),
            description: Some("Update your Conduit account settings".to_string()),
            keyboard: HashMap::from([
                ("Enter".to_string(), "Save settings".to_string()),
                ("Tab".to_string(), "Move to next field".to_string()),
                ("Shift+Tab".to_string(), "Move to previous field".to_string()),
            ]),
            live_regions: Some(vec![
                "success_message".to_string(),
                "error_banner".to_string(),
            ]),
        },
    }
}
