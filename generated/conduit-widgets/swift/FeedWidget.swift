// =============================================================================
// Conduit Widget: Feed
//
// Article feed with tabs, tag filtering, and pagination. Binds to
// Article/get, Tag/list, and Favorite/isFavorited+count.
// =============================================================================

import Foundation

/// Returns the widget specification for the article feed.
func feedWidgetSpec() -> WidgetSpec {
    WidgetSpec(
        name: "feed",
        version: "1.0.0",
        category: .composite,
        concepts: [
            ConceptBinding(
                concept: "urn:copf/Article",
                actions: [],
                queries: ["get"]
            ),
            ConceptBinding(
                concept: "urn:copf/Tag",
                actions: [],
                queries: ["list"]
            ),
            ConceptBinding(
                concept: "urn:copf/Favorite",
                actions: [],
                queries: ["isFavorited", "count"]
            ),
        ],
        anatomy: AnatomySpec(
            component: "ArticleFeed",
            parts: [
                "root",
                "tabBar",
                "globalFeedTab",
                "myFeedTab",
                "tagFeedTab",
                "articleList",
                "articlePreview",
                "tagSidebar",
                "tagItem",
                "pagination",
                "prevButton",
                "nextButton",
                "pageIndicator",
            ],
            slots: ["header", "footer", "banner"]
        ),
        elements: [
            ElementNode(
                id: "feed.tabBar",
                kind: .group,
                label: "Feed Tabs",
                dataType: "object",
                required: true,
                scope: "#/properties/tabs",
                children: [
                    ElementNode(
                        id: "feed.tabBar.globalFeed",
                        kind: .trigger,
                        label: "Global Feed",
                        dataType: "void",
                        required: false,
                        scope: "#/properties/tabs/global"
                    ),
                    ElementNode(
                        id: "feed.tabBar.myFeed",
                        kind: .trigger,
                        label: "Your Feed",
                        dataType: "void",
                        required: false,
                        scope: "#/properties/tabs/personal"
                    ),
                    ElementNode(
                        id: "feed.tabBar.tagFeed",
                        kind: .trigger,
                        label: "Tag Feed",
                        dataType: "void",
                        required: false,
                        scope: "#/properties/tabs/tag"
                    ),
                ]
            ),
            ElementNode(
                id: "feed.articleList",
                kind: .container,
                label: "Articles",
                dataType: "array",
                required: true,
                scope: "#/properties/articles"
            ),
            ElementNode(
                id: "feed.tagSidebar",
                kind: .container,
                label: "Popular Tags",
                dataType: "array",
                required: false,
                scope: "#/properties/tags"
            ),
            ElementNode(
                id: "feed.pagination",
                kind: .group,
                label: "Pagination",
                dataType: "object",
                required: false,
                scope: "#/properties/pagination",
                children: [
                    ElementNode(
                        id: "feed.pagination.prev",
                        kind: .trigger,
                        label: "Previous Page",
                        dataType: "void",
                        required: false,
                        scope: "#/actions/prevPage"
                    ),
                    ElementNode(
                        id: "feed.pagination.indicator",
                        kind: .outputText,
                        label: "Page Indicator",
                        dataType: "string",
                        required: false,
                        scope: "#/properties/pagination/indicator"
                    ),
                    ElementNode(
                        id: "feed.pagination.next",
                        kind: .trigger,
                        label: "Next Page",
                        dataType: "void",
                        required: false,
                        scope: "#/actions/nextPage"
                    ),
                ]
            ),
        ],
        machine: MachineSpec(
            initial: "loading",
            states: [
                "loading": MachineState(
                    name: "loading",
                    on: [
                        "LOADED": MachineTransition(target: "ready", action: "setArticles"),
                        "ERROR": MachineTransition(target: "error", action: "setErrors"),
                    ]
                ),
                "ready": MachineState(
                    name: "ready",
                    on: [
                        "SELECT_TAG": MachineTransition(target: "filtering", action: "setTagFilter"),
                        "CHANGE_TAB": MachineTransition(target: "filtering", action: "setActiveTab"),
                        "CHANGE_PAGE": MachineTransition(target: "filtering", action: "setPage"),
                    ]
                ),
                "filtering": MachineState(
                    name: "filtering",
                    on: [
                        "LOADED": MachineTransition(target: "ready", action: "setArticles"),
                        "ERROR": MachineTransition(target: "error", action: "setErrors"),
                    ]
                ),
                "error": MachineState(
                    name: "error",
                    on: [
                        "DISMISS": MachineTransition(target: "ready", action: "clearErrors"),
                    ]
                ),
            ],
            context: [
                "articles": "[]",
                "tags": "[]",
                "activeTab": "global",
                "selectedTag": "",
                "currentPage": "1",
                "totalPages": "1",
                "errors": "[]",
            ]
        ),
        a11y: A11ySpec(
            role: "feed",
            label: "Article Feed",
            description: "Browse articles on Conduit",
            keyboard: [
                "Tab": "moveFocusNext",
                "Shift+Tab": "moveFocusPrev",
                "ArrowLeft": "prevPage",
                "ArrowRight": "nextPage",
                "Enter": "selectArticle",
            ],
            liveRegions: ["articleList", "pageIndicator"]
        )
    )
}
