// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WidgetTypes} from "./WidgetSpec.sol";

/// @title RegistrationWidget
/// @notice Self-describing Clef Surface widget for user registration on Conduit.
/// @dev Stores the complete widget specification as on-chain data. Off-chain
///      renderers call getSpec(), getElements(), etc. to discover the abstract
///      UI schema and generate framework-specific components.
///
/// Concepts: User, Password
/// Category: Form
/// Anatomy:  root, form, usernameField, emailField, passwordField,
///           submitButton, errorBanner, successMessage

contract RegistrationWidget {

    // --- Constants ---

    string public constant WIDGET_NAME = "registration";
    string public constant WIDGET_VERSION = "1.0.0";

    string public constant MACHINE_SPEC =
        '{"initial":"idle","states":{"idle":{"on":{"SUBMIT":"validating"}},'
        '"validating":{"on":{"VALID":"registering","INVALID":"error"}},'
        '"registering":{"on":{"REGISTERED":"success","ERROR":"error"}},'
        '"success":{},'
        '"error":{"on":{"RETRY":"idle"}}}}';

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
        WidgetTypes.ElementNode[] memory nodes = new WidgetTypes.ElementNode[](4);

        nodes[0] = WidgetTypes.ElementNode({
            id: "registration.username",
            kind: WidgetTypes.ElementKind.InputText,
            label: "Username",
            dataType: "string",
            required: true,
            scope: "#/properties/username"
        });

        nodes[1] = WidgetTypes.ElementNode({
            id: "registration.email",
            kind: WidgetTypes.ElementKind.InputText,
            label: "Email",
            dataType: "string",
            required: true,
            scope: "#/properties/email"
        });

        nodes[2] = WidgetTypes.ElementNode({
            id: "registration.password",
            kind: WidgetTypes.ElementKind.InputText,
            label: "Password",
            dataType: "string",
            required: true,
            scope: "#/properties/password"
        });

        nodes[3] = WidgetTypes.ElementNode({
            id: "registration.submit",
            kind: WidgetTypes.ElementKind.Trigger,
            label: "Sign Up",
            dataType: "void",
            required: false,
            scope: "#/actions/register"
        });

        return nodes;
    }

    // --- View: concept bindings ---

    /// @notice Return the concept bindings for this widget.
    function getConceptBindings() external pure returns (WidgetTypes.ConceptBinding[] memory) {
        WidgetTypes.ConceptBinding[] memory bindings = new WidgetTypes.ConceptBinding[](2);

        string[] memory userActions = new string[](1);
        userActions[0] = "register";
        bindings[0] = WidgetTypes.ConceptBinding({
            concept: "urn:clef/User",
            actions: userActions
        });

        string[] memory passwordActions = new string[](2);
        passwordActions[0] = "validate";
        passwordActions[1] = "set";
        bindings[1] = WidgetTypes.ConceptBinding({
            concept: "urn:clef/Password",
            actions: passwordActions
        });

        return bindings;
    }

    // --- View: anatomy ---

    /// @notice Return the anatomy specification (named parts and slots).
    function getAnatomy() external pure returns (WidgetTypes.AnatomySpec memory) {
        string[] memory parts = new string[](8);
        parts[0] = "root";
        parts[1] = "form";
        parts[2] = "usernameField";
        parts[3] = "emailField";
        parts[4] = "passwordField";
        parts[5] = "submitButton";
        parts[6] = "errorBanner";
        parts[7] = "successMessage";

        string[] memory slots = new string[](2);
        slots[0] = "header";
        slots[1] = "footer";

        return WidgetTypes.AnatomySpec({
            component: "RegistrationForm",
            parts: parts,
            slots: slots
        });
    }

    // --- View: accessibility ---

    /// @notice Return the accessibility specification.
    function getA11y() external pure returns (WidgetTypes.A11ySpec memory) {
        return WidgetTypes.A11ySpec({
            role: "form",
            label: "User Registration"
        });
    }
}
