// =============================================================================
// Conduit Widget: Login
//
// Login form binding to Password/check and JWT/generate.
// =============================================================================

import Foundation

/// Returns the widget specification for the login form.
func loginWidgetSpec() -> WidgetSpec {
    WidgetSpec(
        name: "login",
        version: "1.0.0",
        category: .form,
        concepts: [
            ConceptBinding(
                concept: "urn:copf/Password",
                actions: ["check"],
                queries: []
            ),
            ConceptBinding(
                concept: "urn:copf/JWT",
                actions: ["generate"],
                queries: []
            ),
        ],
        anatomy: AnatomySpec(
            component: "LoginForm",
            parts: [
                "root",
                "form",
                "emailField",
                "passwordField",
                "submitButton",
                "errorBanner",
            ],
            slots: ["header", "footer"]
        ),
        elements: [
            ElementNode(
                id: "login.email",
                kind: .inputText,
                label: "Email",
                dataType: "string",
                required: true,
                scope: "#/properties/email",
                constraints: ElementConstraints(pattern: "^[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}$")
            ),
            ElementNode(
                id: "login.password",
                kind: .inputText,
                label: "Password",
                dataType: "string",
                required: true,
                scope: "#/properties/password"
            ),
            ElementNode(
                id: "login.submit",
                kind: .trigger,
                label: "Sign In",
                dataType: "void",
                required: false,
                scope: "#/actions/check"
            ),
        ],
        machine: MachineSpec(
            initial: "idle",
            states: [
                "idle": MachineState(
                    name: "idle",
                    on: [
                        "SUBMIT": MachineTransition(target: "submitting", action: "collectCredentials"),
                    ]
                ),
                "submitting": MachineState(
                    name: "submitting",
                    on: [
                        "AUTHENTICATED": MachineTransition(target: "success", action: "setToken"),
                        "FAILED": MachineTransition(target: "error", action: "setErrors"),
                    ]
                ),
                "success": MachineState(
                    name: "success",
                    on: [:]
                ),
                "error": MachineState(
                    name: "error",
                    on: [
                        "RETRY": MachineTransition(target: "idle", action: "clearErrors"),
                    ]
                ),
            ],
            context: [
                "email": "",
                "password": "",
                "errors": "[]",
                "token": "",
            ]
        ),
        a11y: A11ySpec(
            role: "form",
            label: "User Login",
            description: "Sign in to your Conduit account",
            keyboard: [
                "Tab": "moveFocusNext",
                "Shift+Tab": "moveFocusPrev",
                "Enter": "submitForm",
            ],
            liveRegions: ["errorBanner"]
        )
    )
}
