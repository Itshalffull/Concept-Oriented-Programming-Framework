// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WidgetTypes} from "./WidgetSpec.sol";

/// @title FeedWidget
/// @notice Self-describing Clef Surface widget for the article feed on Conduit.
/// @dev Stores the complete widget specification as on-chain data. Off-chain
///      renderers call getSpec(), getElements(), etc. to discover the abstract
///      UI schema and generate framework-specific components.
///
/// Concepts: Article, Tag, Favorite
/// Category: Composite
/// Anatomy:  root, tabBar, globalFeedTab, myFeedTab, tagFeedTab, articleList,
///           articlePreview, tagSidebar, tagItem, pagination, prevButton,
///           nextButton, pageIndicator

contract FeedWidget {

    // --- Constants ---

    string public constant WIDGET_NAME = "feed";
    string public constant WIDGET_VERSION = "1.0.0";

    string public constant MACHINE_SPEC =
        '{"initial":"loading","states":{"loading":{"on":{"LOADED":"ready","ERROR":"error"}},'
        '"ready":{"on":{"FILTER_TAG":"filtering","FILTER_TAB":"filtering",'
        '"NEXT_PAGE":"loading","PREV_PAGE":"loading","FAVORITE":"acting"}},'
        '"filtering":{"on":{"FILTERED":"loading"}},'
        '"acting":{"on":{"DONE":"ready","ERROR":"error"}},'
        '"error":{"on":{"RETRY":"loading"}}}}';

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
            id: "feed.tabBar",
            kind: WidgetTypes.ElementKind.Group,
            label: "Feed Tabs",
            dataType: "void",
            required: false,
            scope: "#/properties/activeTab"
        });

        nodes[1] = WidgetTypes.ElementNode({
            id: "feed.articleList",
            kind: WidgetTypes.ElementKind.Container,
            label: "Articles",
            dataType: "array",
            required: false,
            scope: "#/properties/articles"
        });

        nodes[2] = WidgetTypes.ElementNode({
            id: "feed.tagSidebar",
            kind: WidgetTypes.ElementKind.Container,
            label: "Popular Tags",
            dataType: "array",
            required: false,
            scope: "#/properties/tags"
        });

        nodes[3] = WidgetTypes.ElementNode({
            id: "feed.pagination",
            kind: WidgetTypes.ElementKind.Group,
            label: "Pagination",
            dataType: "void",
            required: false,
            scope: "#/properties/page"
        });

        nodes[4] = WidgetTypes.ElementNode({
            id: "feed.prevButton",
            kind: WidgetTypes.ElementKind.Trigger,
            label: "Previous Page",
            dataType: "void",
            required: false,
            scope: "#/actions/prevPage"
        });

        nodes[5] = WidgetTypes.ElementNode({
            id: "feed.nextButton",
            kind: WidgetTypes.ElementKind.Trigger,
            label: "Next Page",
            dataType: "void",
            required: false,
            scope: "#/actions/nextPage"
        });

        return nodes;
    }

    // --- View: concept bindings ---

    /// @notice Return the concept bindings for this widget.
    function getConceptBindings() external pure returns (WidgetTypes.ConceptBinding[] memory) {
        WidgetTypes.ConceptBinding[] memory bindings = new WidgetTypes.ConceptBinding[](3);

        string[] memory articleActions = new string[](2);
        articleActions[0] = "list";
        articleActions[1] = "feed";
        bindings[0] = WidgetTypes.ConceptBinding({
            concept: "urn:clef/Article",
            actions: articleActions
        });

        string[] memory tagActions = new string[](1);
        tagActions[0] = "list";
        bindings[1] = WidgetTypes.ConceptBinding({
            concept: "urn:clef/Tag",
            actions: tagActions
        });

        string[] memory favoriteActions = new string[](2);
        favoriteActions[0] = "favorite";
        favoriteActions[1] = "unfavorite";
        bindings[2] = WidgetTypes.ConceptBinding({
            concept: "urn:clef/Favorite",
            actions: favoriteActions
        });

        return bindings;
    }

    // --- View: anatomy ---

    /// @notice Return the anatomy specification (named parts and slots).
    function getAnatomy() external pure returns (WidgetTypes.AnatomySpec memory) {
        string[] memory parts = new string[](13);
        parts[0] = "root";
        parts[1] = "tabBar";
        parts[2] = "globalFeedTab";
        parts[3] = "myFeedTab";
        parts[4] = "tagFeedTab";
        parts[5] = "articleList";
        parts[6] = "articlePreview";
        parts[7] = "tagSidebar";
        parts[8] = "tagItem";
        parts[9] = "pagination";
        parts[10] = "prevButton";
        parts[11] = "nextButton";
        parts[12] = "pageIndicator";

        string[] memory slots = new string[](1);
        slots[0] = "banner";

        return WidgetTypes.AnatomySpec({
            component: "FeedPage",
            parts: parts,
            slots: slots
        });
    }

    // --- View: accessibility ---

    /// @notice Return the accessibility specification.
    function getA11y() external pure returns (WidgetTypes.A11ySpec memory) {
        return WidgetTypes.A11ySpec({
            role: "region",
            label: "Article Feed"
        });
    }
}
