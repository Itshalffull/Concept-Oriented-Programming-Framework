// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WidgetTypes} from "./WidgetSpec.sol";

/// @title SettingsWidget
/// @notice Self-describing COIF widget for the user settings page on Conduit.
/// @dev Stores the complete widget specification as on-chain data. Off-chain
///      renderers call getSpec(), getElements(), etc. to discover the abstract
///      UI schema and generate framework-specific components.
///
/// Concepts: Profile, Password
/// Category: Form
/// Anatomy:  root, profileSection, imageField, usernameField, bioField,
///           passwordSection, currentPasswordField, newPasswordField,
///           saveButton, logoutButton, successMessage, errorBanner

contract SettingsWidget {

    // --- Constants ---

    string public constant WIDGET_NAME = "settings";
    string public constant WIDGET_VERSION = "1.0.0";

    string public constant MACHINE_SPEC =
        '{"initial":"idle","states":{"idle":{"on":{"EDIT":"editing"}},'
        '"editing":{"on":{"SAVE":"validating","LOGOUT":"idle"}},'
        '"validating":{"on":{"VALID":"saving","INVALID":"editing"}},'
        '"saving":{"on":{"SAVED":"success","ERROR":"error"}},'
        '"success":{"on":{"EDIT":"editing"}},'
        '"error":{"on":{"RETRY":"editing"}}}}';

    // --- View: metadata ---

    /// @notice Return the widget metadata.
    function getSpec() external pure returns (WidgetTypes.WidgetMeta memory) {
        return WidgetTypes.WidgetMeta({
            name: WIDGET_NAME,
            version: WIDGET_VERSION,
            category: WidgetTypes.WidgetCategory.Form,
            machineSpec: MACHINE_SPEC
        });
    }

    // --- View: elements ---

    /// @notice Return the abstract element tree for this widget.
    function getElements() external pure returns (WidgetTypes.ElementNode[] memory) {
        WidgetTypes.ElementNode[] memory nodes = new WidgetTypes.ElementNode[](7);

        nodes[0] = WidgetTypes.ElementNode({
            id: "settings.imageUrl",
            kind: WidgetTypes.ElementKind.InputText,
            label: "Profile Image URL",
            dataType: "string",
            required: false,
            scope: "#/properties/image"
        });

        nodes[1] = WidgetTypes.ElementNode({
            id: "settings.username",
            kind: WidgetTypes.ElementKind.InputText,
            label: "Username",
            dataType: "string",
            required: false,
            scope: "#/properties/username"
        });

        nodes[2] = WidgetTypes.ElementNode({
            id: "settings.bio",
            kind: WidgetTypes.ElementKind.InputText,
            label: "Short Bio",
            dataType: "string",
            required: false,
            scope: "#/properties/bio"
        });

        nodes[3] = WidgetTypes.ElementNode({
            id: "settings.currentPassword",
            kind: WidgetTypes.ElementKind.InputText,
            label: "Current Password",
            dataType: "string",
            required: false,
            scope: "#/properties/currentPassword"
        });

        nodes[4] = WidgetTypes.ElementNode({
            id: "settings.newPassword",
            kind: WidgetTypes.ElementKind.InputText,
            label: "New Password",
            dataType: "string",
            required: false,
            scope: "#/properties/newPassword"
        });

        nodes[5] = WidgetTypes.ElementNode({
            id: "settings.saveButton",
            kind: WidgetTypes.ElementKind.Trigger,
            label: "Update Settings",
            dataType: "void",
            required: false,
            scope: "#/actions/update"
        });

        nodes[6] = WidgetTypes.ElementNode({
            id: "settings.logoutButton",
            kind: WidgetTypes.ElementKind.Trigger,
            label: "Logout",
            dataType: "void",
            required: false,
            scope: "#/actions/logout"
        });

        return nodes;
    }

    // --- View: concept bindings ---

    /// @notice Return the concept bindings for this widget.
    function getConceptBindings() external pure returns (WidgetTypes.ConceptBinding[] memory) {
        WidgetTypes.ConceptBinding[] memory bindings = new WidgetTypes.ConceptBinding[](2);

        string[] memory profileActions = new string[](2);
        profileActions[0] = "get";
        profileActions[1] = "update";
        bindings[0] = WidgetTypes.ConceptBinding({
            concept: "urn:copf/Profile",
            actions: profileActions
        });

        string[] memory passwordActions = new string[](1);
        passwordActions[0] = "change";
        bindings[1] = WidgetTypes.ConceptBinding({
            concept: "urn:copf/Password",
            actions: passwordActions
        });

        return bindings;
    }

    // --- View: anatomy ---

    /// @notice Return the anatomy specification (named parts and slots).
    function getAnatomy() external pure returns (WidgetTypes.AnatomySpec memory) {
        string[] memory parts = new string[](12);
        parts[0] = "root";
        parts[1] = "profileSection";
        parts[2] = "imageField";
        parts[3] = "usernameField";
        parts[4] = "bioField";
        parts[5] = "passwordSection";
        parts[6] = "currentPasswordField";
        parts[7] = "newPasswordField";
        parts[8] = "saveButton";
        parts[9] = "logoutButton";
        parts[10] = "successMessage";
        parts[11] = "errorBanner";

        string[] memory slots = new string[](2);
        slots[0] = "header";
        slots[1] = "footer";

        return WidgetTypes.AnatomySpec({
            component: "SettingsPage",
            parts: parts,
            slots: slots
        });
    }

    // --- View: accessibility ---

    /// @notice Return the accessibility specification.
    function getA11y() external pure returns (WidgetTypes.A11ySpec memory) {
        return WidgetTypes.A11ySpec({
            role: "form",
            label: "User Settings"
        });
    }
}
