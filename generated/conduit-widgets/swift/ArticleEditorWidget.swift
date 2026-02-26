// =============================================================================
// Conduit Widget: Article Editor
//
// Article creation and editing form binding to Article/create+update
// and Tag/add+remove.
// =============================================================================

import Foundation

/// Returns the widget specification for the article editor.
func articleEditorWidgetSpec() -> WidgetSpec {
    WidgetSpec(
        name: "articleEditor",
        version: "1.0.0",
        category: .form,
        concepts: [
            ConceptBinding(
                concept: "urn:clef/Article",
                actions: ["create", "update"],
                queries: ["get"]
            ),
            ConceptBinding(
                concept: "urn:clef/Tag",
                actions: ["add", "remove"],
                queries: ["list"]
            ),
        ],
        anatomy: AnatomySpec(
            component: "ArticleEditor",
            parts: [
                "root",
                "form",
                "titleField",
                "descriptionField",
                "bodyEditor",
                "tagInput",
                "tagList",
                "tagItem",
                "publishButton",
                "errorBanner",
            ],
            slots: ["header", "footer", "toolbar"]
        ),
        elements: [
            ElementNode(
                id: "articleEditor.title",
                kind: .inputText,
                label: "Article Title",
                dataType: "string",
                required: true,
                scope: "#/properties/title",
                constraints: ElementConstraints(maxLength: 200)
            ),
            ElementNode(
                id: "articleEditor.description",
                kind: .inputText,
                label: "What's this article about?",
                dataType: "string",
                required: true,
                scope: "#/properties/description",
                constraints: ElementConstraints(maxLength: 500)
            ),
            ElementNode(
                id: "articleEditor.body",
                kind: .richText,
                label: "Write your article (in markdown)",
                dataType: "string",
                required: true,
                scope: "#/properties/body"
            ),
            ElementNode(
                id: "articleEditor.tagInput",
                kind: .inputText,
                label: "Enter tags",
                dataType: "string",
                required: false,
                scope: "#/properties/tagInput"
            ),
            ElementNode(
                id: "articleEditor.tagList",
                kind: .container,
                label: "Tags",
                dataType: "array",
                required: false,
                scope: "#/properties/tagList"
            ),
            ElementNode(
                id: "articleEditor.publish",
                kind: .trigger,
                label: "Publish Article",
                dataType: "void",
                required: false,
                scope: "#/actions/create"
            ),
        ],
        machine: MachineSpec(
            initial: "idle",
            states: [
                "idle": MachineState(
                    name: "idle",
                    on: [
                        "EDIT": MachineTransition(target: "editing", action: "initializeForm"),
                        "LOAD": MachineTransition(target: "loading", action: "fetchArticle"),
                    ]
                ),
                "loading": MachineState(
                    name: "loading",
                    on: [
                        "LOADED": MachineTransition(target: "editing", action: "populateForm"),
                        "ERROR": MachineTransition(target: "error", action: "setErrors"),
                    ]
                ),
                "editing": MachineState(
                    name: "editing",
                    on: [
                        "SUBMIT": MachineTransition(target: "validating", action: "collectFormData"),
                    ]
                ),
                "validating": MachineState(
                    name: "validating",
                    on: [
                        "VALID": MachineTransition(target: "publishing", action: "invokePublish"),
                        "INVALID": MachineTransition(target: "editing", action: "setErrors"),
                    ]
                ),
                "publishing": MachineState(
                    name: "publishing",
                    on: [
                        "PUBLISHED": MachineTransition(target: "success", action: "setArticle"),
                        "ERROR": MachineTransition(target: "error", action: "setErrors"),
                    ]
                ),
                "success": MachineState(
                    name: "success",
                    on: [:]
                ),
                "error": MachineState(
                    name: "error",
                    on: [
                        "RETRY": MachineTransition(target: "editing", action: "clearErrors"),
                    ]
                ),
            ],
            context: [
                "title": "",
                "description": "",
                "body": "",
                "tagInput": "",
                "tagList": "[]",
                "errors": "[]",
                "slug": "",
            ]
        ),
        a11y: A11ySpec(
            role: "form",
            label: "Article Editor",
            description: "Create or edit an article on Conduit",
            keyboard: [
                "Tab": "moveFocusNext",
                "Shift+Tab": "moveFocusPrev",
                "Ctrl+Enter": "publishArticle",
                "Escape": "cancelEditing",
            ],
            liveRegions: ["errorBanner"]
        )
    )
}
