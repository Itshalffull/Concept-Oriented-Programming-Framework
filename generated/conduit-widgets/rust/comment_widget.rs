// generated: conduit-widgets/rust/comment_widget.rs
//
// Comment list and form widget for the Conduit application.
// Binds to Comment/create+delete+list concepts.

use std::collections::HashMap;

use crate::widget_spec::{
    A11ySpec, AnatomySpec, ConceptBinding, ElementKind, ElementNode, MachineSpec, MachineState,
    MachineTransition, WidgetCategory, WidgetSpec,
};

/// Returns the widget specification for the comment list and form.
pub fn spec() -> WidgetSpec {
    WidgetSpec {
        name: "CommentWidget".to_string(),
        version: "1.0.0".to_string(),
        category: WidgetCategory::Composite,
        concepts: vec![ConceptBinding {
            concept: "concept://conduit/Comment".to_string(),
            actions: vec!["create".to_string(), "delete".to_string()],
            queries: vec!["list".to_string()],
        }],
        anatomy: AnatomySpec {
            component: "CommentWidget".to_string(),
            parts: vec![
                "root".to_string(),
                "list".to_string(),
                "comment_item".to_string(),
                "comment_body".to_string(),
                "comment_author".to_string(),
                "comment_date".to_string(),
                "delete_button".to_string(),
                "add_form".to_string(),
                "body_input".to_string(),
                "submit_button".to_string(),
                "error_banner".to_string(),
            ],
            slots: vec![],
        },
        elements: vec![
            ElementNode {
                id: "comment.list".to_string(),
                kind: ElementKind::Container,
                label: "Comments".to_string(),
                data_type: "array".to_string(),
                required: false,
                scope: "#/properties/comments".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "comment.item".to_string(),
                kind: ElementKind::Group,
                label: "Comment".to_string(),
                data_type: "object".to_string(),
                required: false,
                scope: "#/properties/comments/items".to_string(),
                constraints: None,
                children: Some(vec![
                    ElementNode {
                        id: "comment.item.body".to_string(),
                        kind: ElementKind::OutputText,
                        label: "Comment Body".to_string(),
                        data_type: "string".to_string(),
                        required: true,
                        scope: "#/properties/comments/items/body".to_string(),
                        constraints: None,
                        children: None,
                    },
                    ElementNode {
                        id: "comment.item.author".to_string(),
                        kind: ElementKind::OutputText,
                        label: "Author".to_string(),
                        data_type: "string".to_string(),
                        required: true,
                        scope: "#/properties/comments/items/author".to_string(),
                        constraints: None,
                        children: None,
                    },
                    ElementNode {
                        id: "comment.item.date".to_string(),
                        kind: ElementKind::OutputDate,
                        label: "Date".to_string(),
                        data_type: "date".to_string(),
                        required: true,
                        scope: "#/properties/comments/items/createdAt".to_string(),
                        constraints: None,
                        children: None,
                    },
                    ElementNode {
                        id: "comment.item.delete".to_string(),
                        kind: ElementKind::Trigger,
                        label: "Delete".to_string(),
                        data_type: "void".to_string(),
                        required: false,
                        scope: "#/actions/deleteComment".to_string(),
                        constraints: None,
                        children: None,
                    },
                ]),
            },
            ElementNode {
                id: "comment.add_form".to_string(),
                kind: ElementKind::Group,
                label: "Add Comment".to_string(),
                data_type: "object".to_string(),
                required: false,
                scope: "#/properties/newComment".to_string(),
                constraints: None,
                children: Some(vec![
                    ElementNode {
                        id: "comment.add_form.body".to_string(),
                        kind: ElementKind::InputText,
                        label: "Write a comment...".to_string(),
                        data_type: "string".to_string(),
                        required: true,
                        scope: "#/properties/newComment/body".to_string(),
                        constraints: None,
                        children: None,
                    },
                    ElementNode {
                        id: "comment.add_form.submit".to_string(),
                        kind: ElementKind::Trigger,
                        label: "Post Comment".to_string(),
                        data_type: "void".to_string(),
                        required: false,
                        scope: "#/actions/addComment".to_string(),
                        constraints: None,
                        children: None,
                    },
                ]),
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
                                target: "ready".to_string(),
                                guard: None,
                                action: Some("populateComments".to_string()),
                            },
                        )]),
                    },
                ),
                (
                    "ready".to_string(),
                    MachineState {
                        name: "ready".to_string(),
                        on: HashMap::from([
                            (
                                "ADD_COMMENT".to_string(),
                                MachineTransition {
                                    target: "submitting".to_string(),
                                    guard: None,
                                    action: Some("submitComment".to_string()),
                                },
                            ),
                            (
                                "DELETE_COMMENT".to_string(),
                                MachineTransition {
                                    target: "deleting".to_string(),
                                    guard: Some("isCommentOwner".to_string()),
                                    action: Some("deleteComment".to_string()),
                                },
                            ),
                        ]),
                    },
                ),
                (
                    "submitting".to_string(),
                    MachineState {
                        name: "submitting".to_string(),
                        on: HashMap::from([
                            (
                                "ADDED".to_string(),
                                MachineTransition {
                                    target: "ready".to_string(),
                                    guard: None,
                                    action: Some("appendComment".to_string()),
                                },
                            ),
                            (
                                "ERROR".to_string(),
                                MachineTransition {
                                    target: "ready".to_string(),
                                    guard: None,
                                    action: Some("showError".to_string()),
                                },
                            ),
                        ]),
                    },
                ),
                (
                    "deleting".to_string(),
                    MachineState {
                        name: "deleting".to_string(),
                        on: HashMap::from([
                            (
                                "DELETED".to_string(),
                                MachineTransition {
                                    target: "ready".to_string(),
                                    guard: None,
                                    action: Some("removeComment".to_string()),
                                },
                            ),
                            (
                                "ERROR".to_string(),
                                MachineTransition {
                                    target: "ready".to_string(),
                                    guard: None,
                                    action: Some("showError".to_string()),
                                },
                            ),
                        ]),
                    },
                ),
            ]),
            context: serde_json::json!({
                "comments": [],
                "newComment": { "body": "" },
                "errors": []
            }),
        },
        a11y: A11ySpec {
            role: "region".to_string(),
            label: "Comments".to_string(),
            description: Some("View and add comments on this article".to_string()),
            keyboard: HashMap::from([
                ("Enter".to_string(), "Submit comment".to_string()),
                ("Tab".to_string(), "Move to next element".to_string()),
                ("Shift+Tab".to_string(), "Move to previous element".to_string()),
                ("Delete".to_string(), "Delete selected comment".to_string()),
            ]),
            live_regions: Some(vec![
                "list".to_string(),
                "error_banner".to_string(),
            ]),
        },
    }
}
