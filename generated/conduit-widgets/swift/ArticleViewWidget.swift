// =============================================================================
// Conduit Widget: Article View
//
// Article display binding to Article/get, Favorite/favorite+unfavorite+
// isFavorited+count, Follow/follow+unfollow+isFollowing, and Comment/list.
// =============================================================================

import Foundation

/// Returns the widget specification for the article view.
func articleViewWidgetSpec() -> WidgetSpec {
    WidgetSpec(
        name: "articleView",
        version: "1.0.0",
        category: .display,
        concepts: [
            ConceptBinding(
                concept: "urn:copf/Article",
                actions: [],
                queries: ["get"]
            ),
            ConceptBinding(
                concept: "urn:copf/Favorite",
                actions: ["favorite", "unfavorite"],
                queries: ["isFavorited", "count"]
            ),
            ConceptBinding(
                concept: "urn:copf/Follow",
                actions: ["follow", "unfollow"],
                queries: ["isFollowing"]
            ),
            ConceptBinding(
                concept: "urn:copf/Comment",
                actions: [],
                queries: ["list"]
            ),
        ],
        anatomy: AnatomySpec(
            component: "ArticleView",
            parts: [
                "root",
                "header",
                "title",
                "meta",
                "authorLink",
                "date",
                "body",
                "actions",
                "favoriteButton",
                "favoriteCount",
                "followButton",
                "commentSection",
            ],
            slots: ["banner", "footer", "sidebar"]
        ),
        elements: [
            ElementNode(
                id: "articleView.title",
                kind: .outputText,
                label: "Title",
                dataType: "string",
                required: true,
                scope: "#/properties/title"
            ),
            ElementNode(
                id: "articleView.meta",
                kind: .group,
                label: "Article Meta",
                dataType: "object",
                required: true,
                scope: "#/properties/meta",
                children: [
                    ElementNode(
                        id: "articleView.meta.author",
                        kind: .navigation,
                        label: "Author",
                        dataType: "string",
                        required: true,
                        scope: "#/properties/meta/author"
                    ),
                    ElementNode(
                        id: "articleView.meta.date",
                        kind: .outputDate,
                        label: "Published Date",
                        dataType: "date",
                        required: true,
                        scope: "#/properties/meta/createdAt"
                    ),
                ]
            ),
            ElementNode(
                id: "articleView.body",
                kind: .outputText,
                label: "Article Body",
                dataType: "string",
                required: true,
                scope: "#/properties/body"
            ),
            ElementNode(
                id: "articleView.favoriteButton",
                kind: .trigger,
                label: "Favorite",
                dataType: "void",
                required: false,
                scope: "#/actions/favorite"
            ),
            ElementNode(
                id: "articleView.favoriteCount",
                kind: .outputNumber,
                label: "Favorites Count",
                dataType: "integer",
                required: false,
                scope: "#/properties/favoritesCount"
            ),
            ElementNode(
                id: "articleView.followButton",
                kind: .trigger,
                label: "Follow Author",
                dataType: "void",
                required: false,
                scope: "#/actions/follow"
            ),
            ElementNode(
                id: "articleView.commentList",
                kind: .container,
                label: "Comments",
                dataType: "array",
                required: false,
                scope: "#/properties/comments"
            ),
        ],
        machine: MachineSpec(
            initial: "loading",
            states: [
                "loading": MachineState(
                    name: "loading",
                    on: [
                        "LOADED": MachineTransition(target: "ready", action: "setArticle"),
                        "ERROR": MachineTransition(target: "error", action: "setErrors"),
                    ]
                ),
                "ready": MachineState(
                    name: "ready",
                    on: [
                        "FAVORITE": MachineTransition(target: "acting", action: "toggleFavorite"),
                        "FOLLOW": MachineTransition(target: "acting", action: "toggleFollow"),
                    ]
                ),
                "acting": MachineState(
                    name: "acting",
                    on: [
                        "DONE": MachineTransition(target: "ready", action: "updateState"),
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
                "title": "",
                "body": "",
                "author": "",
                "createdAt": "",
                "favoritesCount": "0",
                "isFavorited": "false",
                "isFollowing": "false",
                "comments": "[]",
                "errors": "[]",
            ]
        ),
        a11y: A11ySpec(
            role: "article",
            label: "Article View",
            description: "Read a full article on Conduit",
            keyboard: [
                "Tab": "moveFocusNext",
                "Shift+Tab": "moveFocusPrev",
                "f": "toggleFavorite",
                "w": "toggleFollow",
            ],
            liveRegions: ["favoriteCount", "actions"]
        )
    )
}
