// =============================================================================
// Conduit Widget: Settings
//
// User settings form binding to Profile/update and Password/validate+set.
// =============================================================================

import Foundation

/// Returns the widget specification for the settings form.
func settingsWidgetSpec() -> WidgetSpec {
    WidgetSpec(
        name: "settings",
        version: "1.0.0",
        category: .form,
        concepts: [
            ConceptBinding(
                concept: "urn:clef/Profile",
                actions: ["update"],
                queries: ["get"]
            ),
            ConceptBinding(
                concept: "urn:clef/Password",
                actions: ["validate", "set"],
                queries: []
            ),
        ],
        anatomy: AnatomySpec(
            component: "SettingsForm",
            parts: [
                "root",
                "profileSection",
                "imageField",
                "usernameField",
                "bioField",
                "passwordSection",
                "currentPasswordField",
                "newPasswordField",
                "saveButton",
                "logoutButton",
                "successMessage",
                "errorBanner",
            ],
            slots: ["header", "footer"]
        ),
        elements: [
            ElementNode(
                id: "settings.profileSection",
                kind: .group,
                label: "Profile Settings",
                dataType: "object",
                required: true,
                scope: "#/properties/profile",
                children: [
                    ElementNode(
                        id: "settings.profileSection.image",
                        kind: .inputText,
                        label: "URL of profile picture",
                        dataType: "string",
                        required: false,
                        scope: "#/properties/profile/image"
                    ),
                    ElementNode(
                        id: "settings.profileSection.username",
                        kind: .inputText,
                        label: "Username",
                        dataType: "string",
                        required: true,
                        scope: "#/properties/profile/username",
                        constraints: ElementConstraints(maxLength: 50)
                    ),
                    ElementNode(
                        id: "settings.profileSection.bio",
                        kind: .inputText,
                        label: "Short bio about you",
                        dataType: "string",
                        required: false,
                        scope: "#/properties/profile/bio",
                        constraints: ElementConstraints(maxLength: 300)
                    ),
                ]
            ),
            ElementNode(
                id: "settings.passwordSection",
                kind: .group,
                label: "Password Settings",
                dataType: "object",
                required: false,
                scope: "#/properties/password",
                children: [
                    ElementNode(
                        id: "settings.passwordSection.currentPassword",
                        kind: .inputText,
                        label: "Current Password",
                        dataType: "string",
                        required: false,
                        scope: "#/properties/password/current"
                    ),
                    ElementNode(
                        id: "settings.passwordSection.newPassword",
                        kind: .inputText,
                        label: "New Password",
                        dataType: "string",
                        required: false,
                        scope: "#/properties/password/new",
                        constraints: ElementConstraints(minLength: 8)
                    ),
                ]
            ),
            ElementNode(
                id: "settings.save",
                kind: .trigger,
                label: "Update Settings",
                dataType: "void",
                required: false,
                scope: "#/actions/update"
            ),
            ElementNode(
                id: "settings.logout",
                kind: .trigger,
                label: "Or click here to logout.",
                dataType: "void",
                required: false,
                scope: "#/actions/logout"
            ),
        ],
        machine: MachineSpec(
            initial: "idle",
            states: [
                "idle": MachineState(
                    name: "idle",
                    on: [
                        "EDIT": MachineTransition(target: "editing", action: "initializeForm"),
                    ]
                ),
                "editing": MachineState(
                    name: "editing",
                    on: [
                        "SAVE": MachineTransition(target: "validating", action: "collectFormData"),
                        "LOGOUT": MachineTransition(target: "idle", action: "invokeLogout"),
                    ]
                ),
                "validating": MachineState(
                    name: "validating",
                    on: [
                        "VALID": MachineTransition(target: "saving", action: "invokeUpdate"),
                        "INVALID": MachineTransition(target: "editing", action: "setErrors"),
                    ]
                ),
                "saving": MachineState(
                    name: "saving",
                    on: [
                        "SAVED": MachineTransition(target: "success", action: "updateProfile"),
                        "ERROR": MachineTransition(target: "error", action: "setErrors"),
                    ]
                ),
                "success": MachineState(
                    name: "success",
                    on: [
                        "EDIT": MachineTransition(target: "editing", action: "initializeForm"),
                    ]
                ),
                "error": MachineState(
                    name: "error",
                    on: [
                        "RETRY": MachineTransition(target: "editing", action: "clearErrors"),
                    ]
                ),
            ],
            context: [
                "image": "",
                "username": "",
                "bio": "",
                "email": "",
                "currentPassword": "",
                "newPassword": "",
                "errors": "[]",
            ]
        ),
        a11y: A11ySpec(
            role: "form",
            label: "User Settings",
            description: "Update your profile and password settings",
            keyboard: [
                "Tab": "moveFocusNext",
                "Shift+Tab": "moveFocusPrev",
                "Enter": "saveSettings",
                "Escape": "cancelEditing",
            ],
            liveRegions: ["successMessage", "errorBanner"]
        )
    )
}
