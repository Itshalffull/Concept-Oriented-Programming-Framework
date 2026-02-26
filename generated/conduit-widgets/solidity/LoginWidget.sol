// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WidgetTypes} from "./WidgetSpec.sol";

/// @title LoginWidget
/// @notice Self-describing Clef Surface widget for user login on Conduit.
/// @dev Stores the complete widget specification as on-chain data. Off-chain
///      renderers call getSpec(), getElements(), etc. to discover the abstract
///      UI schema and generate framework-specific components.
///
/// Concepts: Password, JWT
/// Category: Form
/// Anatomy:  root, form, emailField, passwordField, submitButton, errorBanner

contract LoginWidget {

    // --- Constants ---

    string public constant WIDGET_NAME = "login";
    string public constant WIDGET_VERSION = "1.0.0";

    string public constant MACHINE_SPEC =
        '{"initial":"idle","states":{"idle":{"on":{"SUBMIT":"submitting"}},'
        '"submitting":{"on":{"AUTHENTICATED":"success","FAILED":"error"}},'
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
        WidgetTypes.ElementNode[] memory nodes = new WidgetTypes.ElementNode[](3);

        nodes[0] = WidgetTypes.ElementNode({
            id: "login.email",
            kind: WidgetTypes.ElementKind.InputText,
            label: "Email",
            dataType: "string",
            required: true,
            scope: "#/properties/email"
        });

        nodes[1] = WidgetTypes.ElementNode({
            id: "login.password",
            kind: WidgetTypes.ElementKind.InputText,
            label: "Password",
            dataType: "string",
            required: true,
            scope: "#/properties/password"
        });

        nodes[2] = WidgetTypes.ElementNode({
            id: "login.submit",
            kind: WidgetTypes.ElementKind.Trigger,
            label: "Sign In",
            dataType: "void",
            required: false,
            scope: "#/actions/check"
        });

        return nodes;
    }

    // --- View: concept bindings ---

    /// @notice Return the concept bindings for this widget.
    function getConceptBindings() external pure returns (WidgetTypes.ConceptBinding[] memory) {
        WidgetTypes.ConceptBinding[] memory bindings = new WidgetTypes.ConceptBinding[](2);

        string[] memory passwordActions = new string[](1);
        passwordActions[0] = "check";
        bindings[0] = WidgetTypes.ConceptBinding({
            concept: "urn:clef/Password",
            actions: passwordActions
        });

        string[] memory jwtActions = new string[](1);
        jwtActions[0] = "generate";
        bindings[1] = WidgetTypes.ConceptBinding({
            concept: "urn:clef/JWT",
            actions: jwtActions
        });

        return bindings;
    }

    // --- View: anatomy ---

    /// @notice Return the anatomy specification (named parts and slots).
    function getAnatomy() external pure returns (WidgetTypes.AnatomySpec memory) {
        string[] memory parts = new string[](6);
        parts[0] = "root";
        parts[1] = "form";
        parts[2] = "emailField";
        parts[3] = "passwordField";
        parts[4] = "submitButton";
        parts[5] = "errorBanner";

        string[] memory slots = new string[](2);
        slots[0] = "header";
        slots[1] = "footer";

        return WidgetTypes.AnatomySpec({
            component: "LoginForm",
            parts: parts,
            slots: slots
        });
    }

    // --- View: accessibility ---

    /// @notice Return the accessibility specification.
    function getA11y() external pure returns (WidgetTypes.A11ySpec memory) {
        return WidgetTypes.A11ySpec({
            role: "form",
            label: "User Login"
        });
    }
}
