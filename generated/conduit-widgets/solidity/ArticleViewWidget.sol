// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WidgetTypes} from "./WidgetSpec.sol";

/// @title ArticleViewWidget
/// @notice Self-describing COIF widget for displaying a single article on Conduit.
/// @dev Stores the complete widget specification as on-chain data. Off-chain
///      renderers call getSpec(), getElements(), etc. to discover the abstract
///      UI schema and generate framework-specific components.
///
/// Concepts: Article, Favorite, Follow, Comment
/// Category: Display
/// Anatomy:  root, header, title, meta, authorLink, date, body, actions,
///           favoriteButton, favoriteCount, followButton, commentSection

contract ArticleViewWidget {

    // --- Constants ---

    string public constant WIDGET_NAME = "article-view";
    string public constant WIDGET_VERSION = "1.0.0";

    string public constant MACHINE_SPEC =
        '{"initial":"loading","states":{"loading":{"on":{"LOADED":"ready","ERROR":"error"}},'
        '"ready":{"on":{"FAVORITE":"acting","UNFAVORITE":"acting","FOLLOW":"acting","UNFOLLOW":"acting"}},'
        '"acting":{"on":{"DONE":"ready","ERROR":"error"}},'
        '"error":{"on":{"RETRY":"loading"}}}}';

    // --- View: metadata ---

    /// @notice Return the widget metadata.
    function getSpec() external pure returns (WidgetTypes.WidgetMeta memory) {
        return WidgetTypes.WidgetMeta({
            name: WIDGET_NAME,
            version: WIDGET_VERSION,
            category: WidgetTypes.WidgetCategory.Display,
            machineSpec: MACHINE_SPEC
        });
    }

    // --- View: elements ---

    /// @notice Return the abstract element tree for this widget.
    function getElements() external pure returns (WidgetTypes.ElementNode[] memory) {
        WidgetTypes.ElementNode[] memory nodes = new WidgetTypes.ElementNode[](8);

        nodes[0] = WidgetTypes.ElementNode({
            id: "article-view.title",
            kind: WidgetTypes.ElementKind.OutputText,
            label: "Title",
            dataType: "string",
            required: false,
            scope: "#/properties/title"
        });

        nodes[1] = WidgetTypes.ElementNode({
            id: "article-view.author",
            kind: WidgetTypes.ElementKind.OutputText,
            label: "Author",
            dataType: "string",
            required: false,
            scope: "#/properties/author"
        });

        nodes[2] = WidgetTypes.ElementNode({
            id: "article-view.date",
            kind: WidgetTypes.ElementKind.OutputDate,
            label: "Published Date",
            dataType: "date",
            required: false,
            scope: "#/properties/createdAt"
        });

        nodes[3] = WidgetTypes.ElementNode({
            id: "article-view.body",
            kind: WidgetTypes.ElementKind.OutputText,
            label: "Article Body",
            dataType: "string",
            required: false,
            scope: "#/properties/body"
        });

        nodes[4] = WidgetTypes.ElementNode({
            id: "article-view.favoriteButton",
            kind: WidgetTypes.ElementKind.Trigger,
            label: "Favorite",
            dataType: "void",
            required: false,
            scope: "#/actions/favorite"
        });

        nodes[5] = WidgetTypes.ElementNode({
            id: "article-view.favoriteCount",
            kind: WidgetTypes.ElementKind.OutputNumber,
            label: "Favorites Count",
            dataType: "number",
            required: false,
            scope: "#/properties/favoritesCount"
        });

        nodes[6] = WidgetTypes.ElementNode({
            id: "article-view.followButton",
            kind: WidgetTypes.ElementKind.Trigger,
            label: "Follow Author",
            dataType: "void",
            required: false,
            scope: "#/actions/follow"
        });

        nodes[7] = WidgetTypes.ElementNode({
            id: "article-view.commentList",
            kind: WidgetTypes.ElementKind.Container,
            label: "Comments",
            dataType: "array",
            required: false,
            scope: "#/properties/comments"
        });

        return nodes;
    }

    // --- View: concept bindings ---

    /// @notice Return the concept bindings for this widget.
    function getConceptBindings() external pure returns (WidgetTypes.ConceptBinding[] memory) {
        WidgetTypes.ConceptBinding[] memory bindings = new WidgetTypes.ConceptBinding[](4);

        string[] memory articleActions = new string[](1);
        articleActions[0] = "get";
        bindings[0] = WidgetTypes.ConceptBinding({
            concept: "urn:copf/Article",
            actions: articleActions
        });

        string[] memory favoriteActions = new string[](2);
        favoriteActions[0] = "favorite";
        favoriteActions[1] = "unfavorite";
        bindings[1] = WidgetTypes.ConceptBinding({
            concept: "urn:copf/Favorite",
            actions: favoriteActions
        });

        string[] memory followActions = new string[](2);
        followActions[0] = "follow";
        followActions[1] = "unfollow";
        bindings[2] = WidgetTypes.ConceptBinding({
            concept: "urn:copf/Follow",
            actions: followActions
        });

        string[] memory commentActions = new string[](1);
        commentActions[0] = "list";
        bindings[3] = WidgetTypes.ConceptBinding({
            concept: "urn:copf/Comment",
            actions: commentActions
        });

        return bindings;
    }

    // --- View: anatomy ---

    /// @notice Return the anatomy specification (named parts and slots).
    function getAnatomy() external pure returns (WidgetTypes.AnatomySpec memory) {
        string[] memory parts = new string[](12);
        parts[0] = "root";
        parts[1] = "header";
        parts[2] = "title";
        parts[3] = "meta";
        parts[4] = "authorLink";
        parts[5] = "date";
        parts[6] = "body";
        parts[7] = "actions";
        parts[8] = "favoriteButton";
        parts[9] = "favoriteCount";
        parts[10] = "followButton";
        parts[11] = "commentSection";

        string[] memory slots = new string[](2);
        slots[0] = "banner";
        slots[1] = "footer";

        return WidgetTypes.AnatomySpec({
            component: "ArticleView",
            parts: parts,
            slots: slots
        });
    }

    // --- View: accessibility ---

    /// @notice Return the accessibility specification.
    function getA11y() external pure returns (WidgetTypes.A11ySpec memory) {
        return WidgetTypes.A11ySpec({
            role: "article",
            label: "Article View"
        });
    }
}
