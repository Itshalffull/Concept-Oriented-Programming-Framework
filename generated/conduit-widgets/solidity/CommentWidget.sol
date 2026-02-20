// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WidgetTypes} from "./WidgetSpec.sol";

/// @title CommentWidget
/// @notice Self-describing COIF widget for viewing and posting comments on Conduit.
/// @dev Stores the complete widget specification as on-chain data. Off-chain
///      renderers call getSpec(), getElements(), etc. to discover the abstract
///      UI schema and generate framework-specific components.
///
/// Concepts: Comment
/// Category: Composite
/// Anatomy:  root, list, commentItem, commentBody, commentAuthor, commentDate,
///           deleteButton, addForm, bodyInput, submitButton, errorBanner

contract CommentWidget {

    // --- Constants ---

    string public constant WIDGET_NAME = "comment";
    string public constant WIDGET_VERSION = "1.0.0";

    string public constant MACHINE_SPEC =
        '{"initial":"loading","states":{"loading":{"on":{"LOADED":"ready","ERROR":"error"}},'
        '"ready":{"on":{"SUBMIT":"submitting","DELETE":"deleting"}},'
        '"submitting":{"on":{"SUBMITTED":"ready","ERROR":"error"}},'
        '"deleting":{"on":{"DELETED":"ready","ERROR":"error"}},'
        '"error":{"on":{"RETRY":"ready"}}}}';

    // --- View: metadata ---

    /// @notice Return the widget metadata.
    function getSpec() external pure returns (WidgetTypes.WidgetMeta memory) {
        return WidgetTypes.WidgetMeta({
            name: WIDGET_NAME,
            version: WIDGET_VERSION,
            category: WidgetTypes.WidgetCategory.Composite,
            machineSpec: MACHINE_SPEC
        });
    }

    // --- View: elements ---

    /// @notice Return the abstract element tree for this widget.
    function getElements() external pure returns (WidgetTypes.ElementNode[] memory) {
        WidgetTypes.ElementNode[] memory nodes = new WidgetTypes.ElementNode[](3);

        nodes[0] = WidgetTypes.ElementNode({
            id: "comment.commentList",
            kind: WidgetTypes.ElementKind.Container,
            label: "Comments",
            dataType: "array",
            required: false,
            scope: "#/properties/comments"
        });

        nodes[1] = WidgetTypes.ElementNode({
            id: "comment.bodyInput",
            kind: WidgetTypes.ElementKind.InputText,
            label: "Write a comment",
            dataType: "string",
            required: true,
            scope: "#/properties/body"
        });

        nodes[2] = WidgetTypes.ElementNode({
            id: "comment.submitButton",
            kind: WidgetTypes.ElementKind.Trigger,
            label: "Post Comment",
            dataType: "void",
            required: false,
            scope: "#/actions/create"
        });

        return nodes;
    }

    // --- View: concept bindings ---

    /// @notice Return the concept bindings for this widget.
    function getConceptBindings() external pure returns (WidgetTypes.ConceptBinding[] memory) {
        WidgetTypes.ConceptBinding[] memory bindings = new WidgetTypes.ConceptBinding[](1);

        string[] memory commentActions = new string[](3);
        commentActions[0] = "create";
        commentActions[1] = "delete";
        commentActions[2] = "list";
        bindings[0] = WidgetTypes.ConceptBinding({
            concept: "urn:copf/Comment",
            actions: commentActions
        });

        return bindings;
    }

    // --- View: anatomy ---

    /// @notice Return the anatomy specification (named parts and slots).
    function getAnatomy() external pure returns (WidgetTypes.AnatomySpec memory) {
        string[] memory parts = new string[](11);
        parts[0] = "root";
        parts[1] = "list";
        parts[2] = "commentItem";
        parts[3] = "commentBody";
        parts[4] = "commentAuthor";
        parts[5] = "commentDate";
        parts[6] = "deleteButton";
        parts[7] = "addForm";
        parts[8] = "bodyInput";
        parts[9] = "submitButton";
        parts[10] = "errorBanner";

        string[] memory slots = new string[](1);
        slots[0] = "footer";

        return WidgetTypes.AnatomySpec({
            component: "CommentSection",
            parts: parts,
            slots: slots
        });
    }

    // --- View: accessibility ---

    /// @notice Return the accessibility specification.
    function getA11y() external pure returns (WidgetTypes.A11ySpec memory) {
        return WidgetTypes.A11ySpec({
            role: "region",
            label: "Comments"
        });
    }
}
