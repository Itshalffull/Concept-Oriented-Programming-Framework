// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WidgetTypes} from "./WidgetSpec.sol";

/// @title ProfileWidget
/// @notice Self-describing Clef Surface widget for viewing and editing user profiles on Conduit.
/// @dev Stores the complete widget specification as on-chain data. Off-chain
///      renderers call getSpec(), getElements(), etc. to discover the abstract
///      UI schema and generate framework-specific components.
///
/// Concepts: Profile, Follow
/// Category: Composite
/// Anatomy:  root, header, avatar, username, bio, editButton, form,
///           bioInput, imageInput, saveButton, followButton, errorBanner

contract ProfileWidget {

    // --- Constants ---

    string public constant WIDGET_NAME = "profile";
    string public constant WIDGET_VERSION = "1.0.0";

    string public constant MACHINE_SPEC =
        '{"initial":"loading","states":{"loading":{"on":{"LOADED":"viewing","ERROR":"error"}},'
        '"viewing":{"on":{"EDIT":"editing","FOLLOW":"acting","UNFOLLOW":"acting"}},'
        '"editing":{"on":{"SAVE":"saving","CANCEL":"viewing"}},'
        '"saving":{"on":{"SAVED":"viewing","ERROR":"error"}},'
        '"acting":{"on":{"DONE":"viewing","ERROR":"error"}},'
        '"error":{"on":{"RETRY":"viewing"}}}}';

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
        WidgetTypes.ElementNode[] memory nodes = new WidgetTypes.ElementNode[](6);

        nodes[0] = WidgetTypes.ElementNode({
            id: "profile.avatar",
            kind: WidgetTypes.ElementKind.MediaDisplay,
            label: "Avatar",
            dataType: "string",
            required: false,
            scope: "#/properties/image"
        });

        nodes[1] = WidgetTypes.ElementNode({
            id: "profile.username",
            kind: WidgetTypes.ElementKind.OutputText,
            label: "Username",
            dataType: "string",
            required: false,
            scope: "#/properties/username"
        });

        nodes[2] = WidgetTypes.ElementNode({
            id: "profile.bio",
            kind: WidgetTypes.ElementKind.OutputText,
            label: "Bio",
            dataType: "string",
            required: false,
            scope: "#/properties/bio"
        });

        nodes[3] = WidgetTypes.ElementNode({
            id: "profile.followButton",
            kind: WidgetTypes.ElementKind.Trigger,
            label: "Follow",
            dataType: "void",
            required: false,
            scope: "#/actions/follow"
        });

        nodes[4] = WidgetTypes.ElementNode({
            id: "profile.editButton",
            kind: WidgetTypes.ElementKind.Trigger,
            label: "Edit Profile",
            dataType: "void",
            required: false,
            scope: "#/actions/edit"
        });

        nodes[5] = WidgetTypes.ElementNode({
            id: "profile.saveButton",
            kind: WidgetTypes.ElementKind.Trigger,
            label: "Save Profile",
            dataType: "void",
            required: false,
            scope: "#/actions/update"
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
            concept: "urn:clef/Profile",
            actions: profileActions
        });

        string[] memory followActions = new string[](2);
        followActions[0] = "follow";
        followActions[1] = "unfollow";
        bindings[1] = WidgetTypes.ConceptBinding({
            concept: "urn:clef/Follow",
            actions: followActions
        });

        return bindings;
    }

    // --- View: anatomy ---

    /// @notice Return the anatomy specification (named parts and slots).
    function getAnatomy() external pure returns (WidgetTypes.AnatomySpec memory) {
        string[] memory parts = new string[](12);
        parts[0] = "root";
        parts[1] = "header";
        parts[2] = "avatar";
        parts[3] = "username";
        parts[4] = "bio";
        parts[5] = "editButton";
        parts[6] = "form";
        parts[7] = "bioInput";
        parts[8] = "imageInput";
        parts[9] = "saveButton";
        parts[10] = "followButton";
        parts[11] = "errorBanner";

        string[] memory slots = new string[](2);
        slots[0] = "articleList";
        slots[1] = "footer";

        return WidgetTypes.AnatomySpec({
            component: "ProfilePage",
            parts: parts,
            slots: slots
        });
    }

    // --- View: accessibility ---

    /// @notice Return the accessibility specification.
    function getA11y() external pure returns (WidgetTypes.A11ySpec memory) {
        return WidgetTypes.A11ySpec({
            role: "region",
            label: "User Profile"
        });
    }
}
