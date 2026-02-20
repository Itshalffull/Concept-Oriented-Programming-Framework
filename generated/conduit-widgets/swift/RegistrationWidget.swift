// =============================================================================
// Conduit Widget: Registration
//
// User registration form binding to User/register and Password/validate+set.
// =============================================================================

import Foundation

/// Returns the widget specification for the user registration form.
func registrationWidgetSpec() -> WidgetSpec {
    WidgetSpec(
        name: "registration",
        version: "1.0.0",
        category: .form,
        concepts: [
            ConceptBinding(
                concept: "urn:copf/User",
                actions: ["register"],
                queries: []
            ),
            ConceptBinding(
                concept: "urn:copf/Password",
                actions: ["validate", "set"],
                queries: []
            ),
        ],
        anatomy: AnatomySpec(
            component: "RegistrationForm",
            parts: [
                "root",
                "form",
                "usernameField",
                "emailField",
                "passwordField",
                "submitButton",
                "errorBanner",
                "successMessage",
            ],
            slots: ["header", "footer"]
        ),
        elements: [
            ElementNode(
                id: "registration.username",
                kind: .inputText,
                label: "Username",
                dataType: "string",
                required: true,
                scope: "#/properties/username",
                constraints: ElementConstraints(maxLength: 50)
            ),
            ElementNode(
                id: "registration.email",
                kind: .inputText,
                label: "Email",
                dataType: "string",
                required: true,
                scope: "#/properties/email",
                constraints: ElementConstraints(pattern: "^[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}$")
            ),
            ElementNode(
                id: "registration.password",
                kind: .inputText,
                label: "Password",
                dataType: "string",
                required: true,
                scope: "#/properties/password",
                constraints: ElementConstraints(minLength: 8)
            ),
            ElementNode(
                id: "registration.submit",
                kind: .trigger,
                label: "Sign Up",
                dataType: "void",
                required: false,
                scope: "#/actions/register"
            ),
        ],
        machine: MachineSpec(
            initial: "idle",
            states: [
                "idle": MachineState(
                    name: "idle",
                    on: [
                        "SUBMIT": MachineTransition(target: "validating", action: "collectFormData"),
                    ]
                ),
                "validating": MachineState(
                    name: "validating",
                    on: [
                        "VALID": MachineTransition(target: "registering", action: "invokeRegister"),
                        "INVALID": MachineTransition(target: "idle", action: "setErrors"),
                    ]
                ),
                "registering": MachineState(
                    name: "registering",
                    on: [
                        "REGISTERED": MachineTransition(target: "success", action: "setToken"),
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
                        "RETRY": MachineTransition(target: "idle", action: "clearErrors"),
                    ]
                ),
            ],
            context: [
                "username": "",
                "email": "",
                "password": "",
                "errors": "[]",
                "token": "",
            ]
        ),
        a11y: A11ySpec(
            role: "form",
            label: "User Registration",
            description: "Create a new account on Conduit",
            keyboard: [
                "Tab": "moveFocusNext",
                "Shift+Tab": "moveFocusPrev",
                "Enter": "submitForm",
            ],
            liveRegions: ["errorBanner", "successMessage"]
        )
    )
}
