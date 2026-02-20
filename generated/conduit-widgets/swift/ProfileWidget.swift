// =============================================================================
// Conduit Widget: Profile
//
// User profile display and editing, binding to Profile/get+update
// and Follow/isFollowing+follow+unfollow.
// =============================================================================

import Foundation

/// Returns the widget specification for the user profile.
func profileWidgetSpec() -> WidgetSpec {
    WidgetSpec(
        name: "profile",
        version: "1.0.0",
        category: .composite,
        concepts: [
            ConceptBinding(
                concept: "urn:copf/Profile",
                actions: ["update"],
                queries: ["get"]
            ),
            ConceptBinding(
                concept: "urn:copf/Follow",
                actions: ["follow", "unfollow"],
                queries: ["isFollowing"]
            ),
        ],
        anatomy: AnatomySpec(
            component: "UserProfile",
            parts: [
                "root",
                "header",
                "avatar",
                "username",
                "bio",
                "editButton",
                "form",
                "bioInput",
                "imageInput",
                "saveButton",
                "cancelButton",
                "followButton",
                "errorBanner",
            ],
            slots: ["header", "footer", "articles"]
        ),
        elements: [
            ElementNode(
                id: "profile.avatar",
                kind: .mediaDisplay,
                label: "Profile Image",
                dataType: "string",
                required: false,
                scope: "#/properties/image"
            ),
            ElementNode(
                id: "profile.username",
                kind: .outputText,
                label: "Username",
                dataType: "string",
                required: true,
                scope: "#/properties/username"
            ),
            ElementNode(
                id: "profile.bio",
                kind: .outputText,
                label: "Bio",
                dataType: "string",
                required: false,
                scope: "#/properties/bio"
            ),
            ElementNode(
                id: "profile.bioInput",
                kind: .inputText,
                label: "Bio",
                dataType: "string",
                required: false,
                scope: "#/properties/bio"
            ),
            ElementNode(
                id: "profile.followButton",
                kind: .trigger,
                label: "Follow",
                dataType: "void",
                required: false,
                scope: "#/actions/follow"
            ),
            ElementNode(
                id: "profile.editButton",
                kind: .trigger,
                label: "Edit Profile",
                dataType: "void",
                required: false,
                scope: "#/actions/edit"
            ),
            ElementNode(
                id: "profile.saveButton",
                kind: .trigger,
                label: "Save Profile",
                dataType: "void",
                required: false,
                scope: "#/actions/update"
            ),
        ],
        machine: MachineSpec(
            initial: "loading",
            states: [
                "loading": MachineState(
                    name: "loading",
                    on: [
                        "LOADED": MachineTransition(target: "viewing", action: "setProfile"),
                        "ERROR": MachineTransition(target: "error", action: "setErrors"),
                    ]
                ),
                "viewing": MachineState(
                    name: "viewing",
                    on: [
                        "EDIT": MachineTransition(target: "editing", action: "initializeEditForm"),
                        "FOLLOW": MachineTransition(target: "toggling", action: "toggleFollow"),
                    ]
                ),
                "editing": MachineState(
                    name: "editing",
                    on: [
                        "SAVE": MachineTransition(target: "saving", action: "collectFormData"),
                        "CANCEL": MachineTransition(target: "viewing", action: "discardChanges"),
                    ]
                ),
                "saving": MachineState(
                    name: "saving",
                    on: [
                        "SAVED": MachineTransition(target: "viewing", action: "updateProfile"),
                        "ERROR": MachineTransition(target: "error", action: "setErrors"),
                    ]
                ),
                "toggling": MachineState(
                    name: "toggling",
                    on: [
                        "TOGGLED": MachineTransition(target: "viewing", action: "updateFollowState"),
                        "ERROR": MachineTransition(target: "error", action: "setErrors"),
                    ]
                ),
                "error": MachineState(
                    name: "error",
                    on: [
                        "DISMISS": MachineTransition(target: "viewing", action: "clearErrors"),
                    ]
                ),
            ],
            context: [
                "username": "",
                "bio": "",
                "image": "",
                "isFollowing": "false",
                "isOwnProfile": "false",
                "errors": "[]",
            ]
        ),
        a11y: A11ySpec(
            role: "region",
            label: "User Profile",
            description: "View and manage a user profile on Conduit",
            keyboard: [
                "Tab": "moveFocusNext",
                "Shift+Tab": "moveFocusPrev",
                "Enter": "activateButton",
                "Escape": "cancelEditing",
            ],
            liveRegions: ["errorBanner", "followButton"]
        )
    )
}
