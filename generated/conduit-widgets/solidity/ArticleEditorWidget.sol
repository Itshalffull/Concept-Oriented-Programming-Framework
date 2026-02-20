// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WidgetTypes} from "./WidgetSpec.sol";

/// @title ArticleEditorWidget
/// @notice Self-describing COIF widget for creating and editing articles on Conduit.
/// @dev Stores the complete widget specification as on-chain data. Off-chain
///      renderers call getSpec(), getElements(), etc. to discover the abstract
///      UI schema and generate framework-specific components.
///
/// Concepts: Article, Tag
/// Category: Form
/// Anatomy:  root, form, titleField, descriptionField, bodyEditor,
///           tagInput, tagList, publishButton, errorBanner

contract ArticleEditorWidget {

    // --- Constants ---

    string public constant WIDGET_NAME = "article-editor";
    string public constant WIDGET_VERSION = "1.0.0";

    string public constant MACHINE_SPEC =
        '{"initial":"idle","states":{"idle":{"on":{"EDIT":"editing","LOAD":"loading"}},'
        '"loading":{"on":{"LOADED":"editing","ERROR":"error"}},'
        '"editing":{"on":{"SUBMIT":"validating","ADD_TAG":"editing","REMOVE_TAG":"editing"}},'
        '"validating":{"on":{"VALID":"publishing","INVALID":"editing"}},'
        '"publishing":{"on":{"PUBLISHED":"success","ERROR":"error"}},'
        '"success":{},'
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
        WidgetTypes.ElementNode[] memory nodes = new WidgetTypes.ElementNode[](6);

        nodes[0] = WidgetTypes.ElementNode({
            id: "article-editor.title",
            kind: WidgetTypes.ElementKind.InputText,
            label: "Article Title",
            dataType: "string",
            required: true,
            scope: "#/properties/title"
        });

        nodes[1] = WidgetTypes.ElementNode({
            id: "article-editor.description",
            kind: WidgetTypes.ElementKind.InputText,
            label: "Description",
            dataType: "string",
            required: true,
            scope: "#/properties/description"
        });

        nodes[2] = WidgetTypes.ElementNode({
            id: "article-editor.body",
            kind: WidgetTypes.ElementKind.RichText,
            label: "Article Body",
            dataType: "string",
            required: true,
            scope: "#/properties/body"
        });

        nodes[3] = WidgetTypes.ElementNode({
            id: "article-editor.tagInput",
            kind: WidgetTypes.ElementKind.InputText,
            label: "Add Tag",
            dataType: "string",
            required: false,
            scope: "#/properties/tagInput"
        });

        nodes[4] = WidgetTypes.ElementNode({
            id: "article-editor.tagList",
            kind: WidgetTypes.ElementKind.Container,
            label: "Tags",
            dataType: "array",
            required: false,
            scope: "#/properties/tagList"
        });

        nodes[5] = WidgetTypes.ElementNode({
            id: "article-editor.publish",
            kind: WidgetTypes.ElementKind.Trigger,
            label: "Publish Article",
            dataType: "void",
            required: false,
            scope: "#/actions/create"
        });

        return nodes;
    }

    // --- View: concept bindings ---

    /// @notice Return the concept bindings for this widget.
    function getConceptBindings() external pure returns (WidgetTypes.ConceptBinding[] memory) {
        WidgetTypes.ConceptBinding[] memory bindings = new WidgetTypes.ConceptBinding[](2);

        string[] memory articleActions = new string[](2);
        articleActions[0] = "create";
        articleActions[1] = "update";
        bindings[0] = WidgetTypes.ConceptBinding({
            concept: "urn:copf/Article",
            actions: articleActions
        });

        string[] memory tagActions = new string[](2);
        tagActions[0] = "add";
        tagActions[1] = "remove";
        bindings[1] = WidgetTypes.ConceptBinding({
            concept: "urn:copf/Tag",
            actions: tagActions
        });

        return bindings;
    }

    // --- View: anatomy ---

    /// @notice Return the anatomy specification (named parts and slots).
    function getAnatomy() external pure returns (WidgetTypes.AnatomySpec memory) {
        string[] memory parts = new string[](9);
        parts[0] = "root";
        parts[1] = "form";
        parts[2] = "titleField";
        parts[3] = "descriptionField";
        parts[4] = "bodyEditor";
        parts[5] = "tagInput";
        parts[6] = "tagList";
        parts[7] = "publishButton";
        parts[8] = "errorBanner";

        string[] memory slots = new string[](2);
        slots[0] = "header";
        slots[1] = "footer";

        return WidgetTypes.AnatomySpec({
            component: "ArticleEditor",
            parts: parts,
            slots: slots
        });
    }

    // --- View: accessibility ---

    /// @notice Return the accessibility specification.
    function getA11y() external pure returns (WidgetTypes.A11ySpec memory) {
        return WidgetTypes.A11ySpec({
            role: "form",
            label: "Article Editor"
        });
    }
}
