// generated: conduit-widgets/rust/profile_widget.rs
//
// User profile view/edit widget for the Conduit application.
// Binds to Profile/get+update and Follow/isFollowing+follow+unfollow concepts.

use std::collections::HashMap;

use crate::widget_spec::{
    A11ySpec, AnatomySpec, ConceptBinding, ElementKind, ElementNode, MachineSpec, MachineState,
    MachineTransition, WidgetCategory, WidgetSpec,
};

/// Returns the widget specification for the user profile.
pub fn spec() -> WidgetSpec {
    WidgetSpec {
        name: "ProfileWidget".to_string(),
        version: "1.0.0".to_string(),
        category: WidgetCategory::Composite,
        concepts: vec![
            ConceptBinding {
                concept: "concept://conduit/Profile".to_string(),
                actions: vec!["update".to_string()],
                queries: vec!["get".to_string()],
            },
            ConceptBinding {
                concept: "concept://conduit/Follow".to_string(),
                actions: vec!["follow".to_string(), "unfollow".to_string()],
                queries: vec!["isFollowing".to_string()],
            },
        ],
        anatomy: AnatomySpec {
            component: "ProfileWidget".to_string(),
            parts: vec![
                "root".to_string(),
                "header".to_string(),
                "avatar".to_string(),
                "username".to_string(),
                "bio".to_string(),
                "edit_button".to_string(),
                "form".to_string(),
                "bio_input".to_string(),
                "image_input".to_string(),
                "save_button".to_string(),
                "cancel_button".to_string(),
                "follow_button".to_string(),
                "error_banner".to_string(),
            ],
            slots: vec![],
        },
        elements: vec![
            ElementNode {
                id: "profile.avatar".to_string(),
                kind: ElementKind::MediaDisplay,
                label: "Profile Image".to_string(),
                data_type: "string".to_string(),
                required: false,
                scope: "#/properties/image".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "profile.username".to_string(),
                kind: ElementKind::OutputText,
                label: "Username".to_string(),
                data_type: "string".to_string(),
                required: true,
                scope: "#/properties/username".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "profile.bio".to_string(),
                kind: ElementKind::OutputText,
                label: "Bio".to_string(),
                data_type: "string".to_string(),
                required: false,
                scope: "#/properties/bio".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "profile.bio_input".to_string(),
                kind: ElementKind::InputText,
                label: "Bio".to_string(),
                data_type: "string".to_string(),
                required: false,
                scope: "#/properties/bio".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "profile.image_input".to_string(),
                kind: ElementKind::InputText,
                label: "Profile Image URL".to_string(),
                data_type: "string".to_string(),
                required: false,
                scope: "#/properties/image".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "profile.edit_button".to_string(),
                kind: ElementKind::Trigger,
                label: "Edit Profile".to_string(),
                data_type: "void".to_string(),
                required: false,
                scope: "#/actions/edit".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "profile.save_button".to_string(),
                kind: ElementKind::Trigger,
                label: "Save".to_string(),
                data_type: "void".to_string(),
                required: false,
                scope: "#/actions/save".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "profile.cancel_button".to_string(),
                kind: ElementKind::Trigger,
                label: "Cancel".to_string(),
                data_type: "void".to_string(),
                required: false,
                scope: "#/actions/cancel".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "profile.follow_button".to_string(),
                kind: ElementKind::Trigger,
                label: "Follow".to_string(),
                data_type: "void".to_string(),
                required: false,
                scope: "#/actions/follow".to_string(),
                constraints: None,
                children: None,
            },
        ],
        machine: MachineSpec {
            initial: "loading".to_string(),
            states: HashMap::from([
                (
                    "loading".to_string(),
                    MachineState {
                        name: "loading".to_string(),
                        on: HashMap::from([(
                            "LOADED".to_string(),
                            MachineTransition {
                                target: "viewing".to_string(),
                                guard: None,
                                action: Some("populateProfile".to_string()),
                            },
                        )]),
                    },
                ),
                (
                    "viewing".to_string(),
                    MachineState {
                        name: "viewing".to_string(),
                        on: HashMap::from([
                            (
                                "EDIT".to_string(),
                                MachineTransition {
                                    target: "editing".to_string(),
                                    guard: Some("isOwnProfile".to_string()),
                                    action: Some("enterEditMode".to_string()),
                                },
                            ),
                            (
                                "FOLLOW".to_string(),
                                MachineTransition {
                                    target: "toggling".to_string(),
                                    guard: Some("isNotOwnProfile".to_string()),
                                    action: Some("toggleFollow".to_string()),
                                },
                            ),
                        ]),
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
                                    target: "saving".to_string(),
                                    guard: None,
                                    action: Some("submitProfile".to_string()),
                                },
                            ),
                            (
                                "CANCEL".to_string(),
                                MachineTransition {
                                    target: "viewing".to_string(),
                                    guard: None,
                                    action: Some("discardChanges".to_string()),
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
                                    target: "viewing".to_string(),
                                    guard: None,
                                    action: Some("onProfileSaved".to_string()),
                                },
                            ),
                            (
                                "ERROR".to_string(),
                                MachineTransition {
                                    target: "editing".to_string(),
                                    guard: None,
                                    action: Some("showError".to_string()),
                                },
                            ),
                        ]),
                    },
                ),
                (
                    "toggling".to_string(),
                    MachineState {
                        name: "toggling".to_string(),
                        on: HashMap::from([
                            (
                                "TOGGLED".to_string(),
                                MachineTransition {
                                    target: "viewing".to_string(),
                                    guard: None,
                                    action: Some("updateFollowState".to_string()),
                                },
                            ),
                            (
                                "ERROR".to_string(),
                                MachineTransition {
                                    target: "viewing".to_string(),
                                    guard: None,
                                    action: Some("showError".to_string()),
                                },
                            ),
                        ]),
                    },
                ),
            ]),
            context: serde_json::json!({
                "username": "",
                "bio": "",
                "image": "",
                "isFollowing": false,
                "isOwnProfile": false,
                "errors": []
            }),
        },
        a11y: A11ySpec {
            role: "region".to_string(),
            label: "User Profile".to_string(),
            description: Some("View or edit a user profile on Conduit".to_string()),
            keyboard: HashMap::from([
                ("e".to_string(), "Edit profile".to_string()),
                ("f".to_string(), "Toggle follow".to_string()),
                ("Enter".to_string(), "Save changes".to_string()),
                ("Escape".to_string(), "Cancel editing".to_string()),
                ("Tab".to_string(), "Move to next element".to_string()),
                ("Shift+Tab".to_string(), "Move to previous element".to_string()),
            ]),
            live_regions: Some(vec!["error_banner".to_string()]),
        },
    }
}
