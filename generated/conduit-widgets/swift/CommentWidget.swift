// =============================================================================
// Conduit Widget: Comment
//
// Comment management binding to Comment/create+delete+list.
// =============================================================================

import Foundation

/// Returns the widget specification for the comment section.
func commentWidgetSpec() -> WidgetSpec {
    WidgetSpec(
        name: "comment",
        version: "1.0.0",
        category: .composite,
        concepts: [
            ConceptBinding(
                concept: "urn:clef/Comment",
                actions: ["create", "delete"],
                queries: ["list"]
            ),
        ],
        anatomy: AnatomySpec(
            component: "CommentSection",
            parts: [
                "root",
                "list",
                "commentItem",
                "commentBody",
                "commentAuthor",
                "commentDate",
                "deleteButton",
                "addForm",
                "bodyInput",
                "submitButton",
                "errorBanner",
            ],
            slots: ["header", "footer"]
        ),
        elements: [
            ElementNode(
                id: "comment.list",
                kind: .container,
                label: "Comments",
                dataType: "array",
                required: false,
                scope: "#/properties/comments",
                children: [
                    ElementNode(
                        id: "comment.item",
                        kind: .group,
                        label: "Comment",
                        dataType: "object",
                        required: false,
                        scope: "#/properties/comments/items",
                        children: [
                            ElementNode(
                                id: "comment.item.body",
                                kind: .outputText,
                                label: "Comment Body",
                                dataType: "string",
                                required: true,
                                scope: "#/properties/comments/items/body"
                            ),
                            ElementNode(
                                id: "comment.item.author",
                                kind: .outputText,
                                label: "Author",
                                dataType: "string",
                                required: true,
                                scope: "#/properties/comments/items/author"
                            ),
                            ElementNode(
                                id: "comment.item.date",
                                kind: .outputDate,
                                label: "Date",
                                dataType: "date",
                                required: true,
                                scope: "#/properties/comments/items/createdAt"
                            ),
                            ElementNode(
                                id: "comment.item.delete",
                                kind: .trigger,
                                label: "Delete Comment",
                                dataType: "void",
                                required: false,
                                scope: "#/actions/delete"
                            ),
                        ]
                    ),
                ]
            ),
            ElementNode(
                id: "comment.addForm",
                kind: .group,
                label: "Add Comment",
                dataType: "object",
                required: false,
                scope: "#/properties/newComment",
                children: [
                    ElementNode(
                        id: "comment.addForm.body",
                        kind: .inputText,
                        label: "Write a comment...",
                        dataType: "string",
                        required: true,
                        scope: "#/properties/newComment/body"
                    ),
                    ElementNode(
                        id: "comment.addForm.submit",
                        kind: .trigger,
                        label: "Post Comment",
                        dataType: "void",
                        required: false,
                        scope: "#/actions/create"
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
                        "LOADED": MachineTransition(target: "ready", action: "setComments"),
                        "ERROR": MachineTransition(target: "error", action: "setErrors"),
                    ]
                ),
                "ready": MachineState(
                    name: "ready",
                    on: [
                        "ADD_COMMENT": MachineTransition(target: "submitting", action: "collectComment"),
                        "DELETE_COMMENT": MachineTransition(target: "deleting", action: "markForDeletion"),
                    ]
                ),
                "submitting": MachineState(
                    name: "submitting",
                    on: [
                        "ADDED": MachineTransition(target: "ready", action: "appendComment"),
                        "ERROR": MachineTransition(target: "error", action: "setErrors"),
                    ]
                ),
                "deleting": MachineState(
                    name: "deleting",
                    on: [
                        "DELETED": MachineTransition(target: "ready", action: "removeComment"),
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
                "comments": "[]",
                "newCommentBody": "",
                "deletingId": "",
                "errors": "[]",
            ]
        ),
        a11y: A11ySpec(
            role: "region",
            label: "Comments Section",
            description: "View and manage comments on this article",
            keyboard: [
                "Tab": "moveFocusNext",
                "Shift+Tab": "moveFocusPrev",
                "Enter": "submitComment",
                "Delete": "deleteComment",
            ],
            liveRegions: ["list", "errorBanner"]
        )
    )
}
