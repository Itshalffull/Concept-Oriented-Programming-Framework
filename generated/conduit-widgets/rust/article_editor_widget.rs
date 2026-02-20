// generated: conduit-widgets/rust/article_editor_widget.rs
//
// Article editor widget for the Conduit application.
// Binds to Article/create+update and Tag/add+remove concepts.

use std::collections::HashMap;

use crate::widget_spec::{
    A11ySpec, AnatomySpec, ConceptBinding, ElementConstraints, ElementKind, ElementNode,
    MachineSpec, MachineState, MachineTransition, WidgetCategory, WidgetSpec,
};

/// Returns the widget specification for the article editor.
pub fn spec() -> WidgetSpec {
    WidgetSpec {
        name: "ArticleEditorWidget".to_string(),
        version: "1.0.0".to_string(),
        category: WidgetCategory::Form,
        concepts: vec![
            ConceptBinding {
                concept: "concept://conduit/Article".to_string(),
                actions: vec!["create".to_string(), "update".to_string()],
                queries: vec![],
            },
            ConceptBinding {
                concept: "concept://conduit/Tag".to_string(),
                actions: vec!["add".to_string(), "remove".to_string()],
                queries: vec![],
            },
        ],
        anatomy: AnatomySpec {
            component: "ArticleEditorWidget".to_string(),
            parts: vec![
                "root".to_string(),
                "form".to_string(),
                "title_field".to_string(),
                "description_field".to_string(),
                "body_editor".to_string(),
                "tag_input".to_string(),
                "tag_list".to_string(),
                "tag_item".to_string(),
                "publish_button".to_string(),
                "error_banner".to_string(),
            ],
            slots: vec![],
        },
        elements: vec![
            ElementNode {
                id: "article_editor.title".to_string(),
                kind: ElementKind::InputText,
                label: "Article Title".to_string(),
                data_type: "string".to_string(),
                required: true,
                scope: "#/properties/title".to_string(),
                constraints: Some(ElementConstraints {
                    min: None,
                    max: None,
                    min_length: None,
                    max_length: Some(200),
                    pattern: None,
                    options: None,
                }),
                children: None,
            },
            ElementNode {
                id: "article_editor.description".to_string(),
                kind: ElementKind::InputText,
                label: "What's this article about?".to_string(),
                data_type: "string".to_string(),
                required: true,
                scope: "#/properties/description".to_string(),
                constraints: Some(ElementConstraints {
                    min: None,
                    max: None,
                    min_length: None,
                    max_length: Some(500),
                    pattern: None,
                    options: None,
                }),
                children: None,
            },
            ElementNode {
                id: "article_editor.body".to_string(),
                kind: ElementKind::RichText,
                label: "Write your article (in markdown)".to_string(),
                data_type: "string".to_string(),
                required: true,
                scope: "#/properties/body".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "article_editor.tag_input".to_string(),
                kind: ElementKind::InputText,
                label: "Enter tags".to_string(),
                data_type: "string".to_string(),
                required: false,
                scope: "#/properties/tagInput".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "article_editor.tag_list".to_string(),
                kind: ElementKind::Container,
                label: "Tags".to_string(),
                data_type: "array".to_string(),
                required: false,
                scope: "#/properties/tagList".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "article_editor.publish".to_string(),
                kind: ElementKind::Trigger,
                label: "Publish Article".to_string(),
                data_type: "void".to_string(),
                required: false,
                scope: "#/actions/publish".to_string(),
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
                        on: HashMap::from([
                            (
                                "EDIT".to_string(),
                                MachineTransition {
                                    target: "editing".to_string(),
                                    guard: None,
                                    action: Some("initBlankForm".to_string()),
                                },
                            ),
                            (
                                "LOAD".to_string(),
                                MachineTransition {
                                    target: "loading".to_string(),
                                    guard: None,
                                    action: Some("fetchArticle".to_string()),
                                },
                            ),
                        ]),
                    },
                ),
                (
                    "loading".to_string(),
                    MachineState {
                        name: "loading".to_string(),
                        on: HashMap::from([(
                            "LOADED".to_string(),
                            MachineTransition {
                                target: "editing".to_string(),
                                guard: None,
                                action: Some("populateForm".to_string()),
                            },
                        )]),
                    },
                ),
                (
                    "editing".to_string(),
                    MachineState {
                        name: "editing".to_string(),
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
                                    target: "publishing".to_string(),
                                    guard: None,
                                    action: Some("submitArticle".to_string()),
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
                    "publishing".to_string(),
                    MachineState {
                        name: "publishing".to_string(),
                        on: HashMap::from([
                            (
                                "PUBLISHED".to_string(),
                                MachineTransition {
                                    target: "success".to_string(),
                                    guard: None,
                                    action: Some("onPublished".to_string()),
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
                                target: "editing".to_string(),
                                guard: None,
                                action: Some("clearError".to_string()),
                            },
                        )]),
                    },
                ),
            ]),
            context: serde_json::json!({
                "title": "",
                "description": "",
                "body": "",
                "tagInput": "",
                "tagList": [],
                "errors": []
            }),
        },
        a11y: A11ySpec {
            role: "form".to_string(),
            label: "Article Editor".to_string(),
            description: Some("Create or edit an article on Conduit".to_string()),
            keyboard: HashMap::from([
                ("Enter".to_string(), "Add tag (when tag input focused)".to_string()),
                ("Tab".to_string(), "Move to next field".to_string()),
                ("Shift+Tab".to_string(), "Move to previous field".to_string()),
                ("Ctrl+Enter".to_string(), "Publish article".to_string()),
            ]),
            live_regions: Some(vec!["error_banner".to_string()]),
        },
    }
}
