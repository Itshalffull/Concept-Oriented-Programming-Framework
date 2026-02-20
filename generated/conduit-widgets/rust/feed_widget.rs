// generated: conduit-widgets/rust/feed_widget.rs
//
// Article feed widget with filtering for the Conduit application.
// Binds to Article/get, Tag/list, and Favorite/isFavorited+count concepts.

use std::collections::HashMap;

use crate::widget_spec::{
    A11ySpec, AnatomySpec, ConceptBinding, ElementKind, ElementNode, MachineSpec, MachineState,
    MachineTransition, WidgetCategory, WidgetSpec,
};

/// Returns the widget specification for the article feed.
pub fn spec() -> WidgetSpec {
    WidgetSpec {
        name: "FeedWidget".to_string(),
        version: "1.0.0".to_string(),
        category: WidgetCategory::Composite,
        concepts: vec![
            ConceptBinding {
                concept: "concept://conduit/Article".to_string(),
                actions: vec![],
                queries: vec!["get".to_string()],
            },
            ConceptBinding {
                concept: "concept://conduit/Tag".to_string(),
                actions: vec![],
                queries: vec!["list".to_string()],
            },
            ConceptBinding {
                concept: "concept://conduit/Favorite".to_string(),
                actions: vec![],
                queries: vec!["isFavorited".to_string(), "count".to_string()],
            },
        ],
        anatomy: AnatomySpec {
            component: "FeedWidget".to_string(),
            parts: vec![
                "root".to_string(),
                "tab_bar".to_string(),
                "global_feed_tab".to_string(),
                "my_feed_tab".to_string(),
                "tag_feed_tab".to_string(),
                "article_list".to_string(),
                "article_preview".to_string(),
                "tag_sidebar".to_string(),
                "tag_item".to_string(),
                "pagination".to_string(),
                "prev_button".to_string(),
                "next_button".to_string(),
                "page_indicator".to_string(),
            ],
            slots: vec!["article_preview".to_string()],
        },
        elements: vec![
            ElementNode {
                id: "feed.tab_bar".to_string(),
                kind: ElementKind::Group,
                label: "Feed Tabs".to_string(),
                data_type: "object".to_string(),
                required: true,
                scope: "#/properties/tabs".to_string(),
                constraints: None,
                children: Some(vec![
                    ElementNode {
                        id: "feed.tab_bar.global".to_string(),
                        kind: ElementKind::Trigger,
                        label: "Global Feed".to_string(),
                        data_type: "void".to_string(),
                        required: false,
                        scope: "#/actions/selectGlobalFeed".to_string(),
                        constraints: None,
                        children: None,
                    },
                    ElementNode {
                        id: "feed.tab_bar.my_feed".to_string(),
                        kind: ElementKind::Trigger,
                        label: "Your Feed".to_string(),
                        data_type: "void".to_string(),
                        required: false,
                        scope: "#/actions/selectMyFeed".to_string(),
                        constraints: None,
                        children: None,
                    },
                    ElementNode {
                        id: "feed.tab_bar.tag".to_string(),
                        kind: ElementKind::Trigger,
                        label: "Tag Feed".to_string(),
                        data_type: "void".to_string(),
                        required: false,
                        scope: "#/actions/selectTagFeed".to_string(),
                        constraints: None,
                        children: None,
                    },
                ]),
            },
            ElementNode {
                id: "feed.article_list".to_string(),
                kind: ElementKind::Container,
                label: "Articles".to_string(),
                data_type: "array".to_string(),
                required: true,
                scope: "#/properties/articles".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "feed.tag_sidebar".to_string(),
                kind: ElementKind::Container,
                label: "Popular Tags".to_string(),
                data_type: "array".to_string(),
                required: false,
                scope: "#/properties/tags".to_string(),
                constraints: None,
                children: None,
            },
            ElementNode {
                id: "feed.pagination".to_string(),
                kind: ElementKind::Group,
                label: "Pagination".to_string(),
                data_type: "object".to_string(),
                required: false,
                scope: "#/properties/pagination".to_string(),
                constraints: None,
                children: Some(vec![
                    ElementNode {
                        id: "feed.pagination.prev".to_string(),
                        kind: ElementKind::Trigger,
                        label: "Previous Page".to_string(),
                        data_type: "void".to_string(),
                        required: false,
                        scope: "#/actions/prevPage".to_string(),
                        constraints: None,
                        children: None,
                    },
                    ElementNode {
                        id: "feed.pagination.indicator".to_string(),
                        kind: ElementKind::OutputText,
                        label: "Page Indicator".to_string(),
                        data_type: "string".to_string(),
                        required: false,
                        scope: "#/properties/pagination/current".to_string(),
                        constraints: None,
                        children: None,
                    },
                    ElementNode {
                        id: "feed.pagination.next".to_string(),
                        kind: ElementKind::Trigger,
                        label: "Next Page".to_string(),
                        data_type: "void".to_string(),
                        required: false,
                        scope: "#/actions/nextPage".to_string(),
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
                                action: Some("populateFeed".to_string()),
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
                                "SELECT_TAG".to_string(),
                                MachineTransition {
                                    target: "loading".to_string(),
                                    guard: None,
                                    action: Some("fetchByTag".to_string()),
                                },
                            ),
                            (
                                "CHANGE_TAB".to_string(),
                                MachineTransition {
                                    target: "loading".to_string(),
                                    guard: None,
                                    action: Some("fetchByTab".to_string()),
                                },
                            ),
                            (
                                "CHANGE_PAGE".to_string(),
                                MachineTransition {
                                    target: "loading".to_string(),
                                    guard: None,
                                    action: Some("fetchPage".to_string()),
                                },
                            ),
                        ]),
                    },
                ),
            ]),
            context: serde_json::json!({
                "articles": [],
                "tags": [],
                "activeTab": "global",
                "selectedTag": null,
                "pagination": {
                    "current": 1,
                    "total": 1,
                    "perPage": 10
                },
                "errors": []
            }),
        },
        a11y: A11ySpec {
            role: "feed".to_string(),
            label: "Article Feed".to_string(),
            description: Some("Browse articles with filtering by feed type and tags".to_string()),
            keyboard: HashMap::from([
                ("1".to_string(), "Global feed tab".to_string()),
                ("2".to_string(), "Your feed tab".to_string()),
                ("ArrowLeft".to_string(), "Previous page".to_string()),
                ("ArrowRight".to_string(), "Next page".to_string()),
                ("Tab".to_string(), "Move to next element".to_string()),
                ("Shift+Tab".to_string(), "Move to previous element".to_string()),
            ]),
            live_regions: Some(vec![
                "article_list".to_string(),
                "page_indicator".to_string(),
            ]),
        },
    }
}
