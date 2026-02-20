// generated: conduit-widgets/rust/article_view_widget.rs
//
// Article display widget with social actions for the Conduit application.
// Binds to Article/get, Favorite, Follow, and Comment/list concepts.

use std::collections::HashMap;

use crate::widget_spec::{
    A11ySpec, AnatomySpec, ConceptBinding, ElementKind, ElementNode, MachineSpec, MachineState,
    MachineTransition, WidgetCategory, WidgetSpec,
};

/// Returns the widget specification for the article view.
pub fn spec() -> WidgetSpec {
    WidgetSpec {
        name: "ArticleViewWidget".to_string(),
        version: "1.0.0".to_string(),
        category: WidgetCategory::Display,
        concepts: vec![
            ConceptBinding {
                concept: "concept://conduit/Article".to_string(),
                actions: vec![],
                queries: vec!["get".to_string()],
            },
            ConceptBinding {
                concept: "concept://conduit/Favorite".to_string(),
                actions: vec!["favorite".to_string(), "unfavorite".to_string()],
                queries: vec!["isFavorited".to_string(), "count".to_string()],
            },
            ConceptBinding {
                concept: "concept://conduit/Follow".to_string(),
                actions: vec!["follow".to_string(), "unfollow".to_string()],
                queries: vec!["isFollowing".to_string()],
            },
            ConceptBinding {
                concept: "concept://conduit/Comment".to_string(),
                actions: vec![],
                queries: vec!["list".to_string()],
            },
        ],
        anatomy: AnatomySpec {
            component: "ArticleViewWidget".to_string(),
            parts: vec![
                "root".to_string(),
                "header".to_string(),
                "title".to_string(),
                "meta".to_string(),
                "author_link".to_string(),
                "date".to_string(),
                "body".to_string(),
                "actions".to_string(),
                "favorite_button".to_string(),
                "favorite_count".to_string(),
                "follow_button".to_string(),
                "comment_section".to_string(),
            ],
            slots: vec!["comment_section".to_string()],
        },
        elements: vec![
            ElementNode {
                id: "article_view.title".to_string(),
                kind: ElementKind::OutputText,
                label: "Title".to_string(),
                data_type: "string".to_string(),
                required: true,
                scope: "#/properties/title".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "article_view.meta".to_string(),
                kind: ElementKind::Group,
                label: "Article Meta".to_string(),
                data_type: "object".to_string(),
                required: true,
                scope: "#/properties/meta".to_string(),
                constraints: None,
                children: Some(vec![
                    ElementNode {
                        id: "article_view.meta.author".to_string(),
                        kind: ElementKind::OutputText,
                        label: "Author".to_string(),
                        data_type: "string".to_string(),
                        required: true,
                        scope: "#/properties/meta/author".to_string(),
                        constraints: None,
                        children: None,
                    },
                    ElementNode {
                        id: "article_view.meta.date".to_string(),
                        kind: ElementKind::OutputDate,
                        label: "Published Date".to_string(),
                        data_type: "date".to_string(),
                        required: true,
                        scope: "#/properties/meta/createdAt".to_string(),
                        constraints: None,
                        children: None,
                    },
                ]),
            },
            ElementNode {
                id: "article_view.body".to_string(),
                kind: ElementKind::OutputText,
                label: "Body".to_string(),
                data_type: "string".to_string(),
                required: true,
                scope: "#/properties/body".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "article_view.favorite_button".to_string(),
                kind: ElementKind::Trigger,
                label: "Favorite".to_string(),
                data_type: "void".to_string(),
                required: false,
                scope: "#/actions/favorite".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "article_view.favorite_count".to_string(),
                kind: ElementKind::OutputNumber,
                label: "Favorite Count".to_string(),
                data_type: "integer".to_string(),
                required: false,
                scope: "#/properties/favoritesCount".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "article_view.follow_button".to_string(),
                kind: ElementKind::Trigger,
                label: "Follow Author".to_string(),
                data_type: "void".to_string(),
                required: false,
                scope: "#/actions/follow".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "article_view.comment_list".to_string(),
                kind: ElementKind::Container,
                label: "Comments".to_string(),
                data_type: "array".to_string(),
                required: false,
                scope: "#/properties/comments".to_string(),
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
                                target: "ready".to_string(),
                                guard: None,
                                action: Some("populateArticle".to_string()),
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
                                "FAVORITE".to_string(),
                                MachineTransition {
                                    target: "acting".to_string(),
                                    guard: None,
                                    action: Some("toggleFavorite".to_string()),
                                },
                            ),
                            (
                                "FOLLOW".to_string(),
                                MachineTransition {
                                    target: "acting".to_string(),
                                    guard: None,
                                    action: Some("toggleFollow".to_string()),
                                },
                            ),
                        ]),
                    },
                ),
                (
                    "acting".to_string(),
                    MachineState {
                        name: "acting".to_string(),
                        on: HashMap::from([
                            (
                                "DONE".to_string(),
                                MachineTransition {
                                    target: "ready".to_string(),
                                    guard: None,
                                    action: Some("updateState".to_string()),
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
                    "error".to_string(),
                    MachineState {
                        name: "error".to_string(),
                        on: HashMap::from([(
                            "DISMISS".to_string(),
                            MachineTransition {
                                target: "ready".to_string(),
                                guard: None,
                                action: Some("clearError".to_string()),
                            },
                        )]),
                    },
                ),
            ]),
            context: serde_json::json!({
                "article": null,
                "isFavorited": false,
                "favoritesCount": 0,
                "isFollowing": false,
                "comments": [],
                "errors": []
            }),
        },
        a11y: A11ySpec {
            role: "article".to_string(),
            label: "Article".to_string(),
            description: Some("View an article with social actions".to_string()),
            keyboard: HashMap::from([
                ("f".to_string(), "Toggle favorite".to_string()),
                ("w".to_string(), "Toggle follow author".to_string()),
                ("Tab".to_string(), "Move to next action".to_string()),
                ("Shift+Tab".to_string(), "Move to previous action".to_string()),
            ]),
            live_regions: Some(vec![
                "favorite_count".to_string(),
                "error".to_string(),
            ]),
        },
    }
}
