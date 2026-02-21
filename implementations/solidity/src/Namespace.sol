// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Namespace
/// @notice Manages hierarchical page organisation using path-based namespaces.
contract Namespace {
    struct Page {
        string fullPath;
        bytes32 parentId;
        bool exists;
    }

    mapping(bytes32 => Page) private _pages;
    mapping(bytes32 => bytes32[]) private _children;

    event PageCreated(bytes32 indexed pageId, string fullPath);
    event PageMoved(bytes32 indexed pageId, bytes32 indexed newParentId);

    /// @notice Creates a new page in the namespace.
    /// @param pageId Unique identifier for the page.
    /// @param fullPath The full hierarchical path of the page.
    /// @param parentId The parent page ID (bytes32(0) for root pages).
    function createPage(bytes32 pageId, string calldata fullPath, bytes32 parentId) external {
        require(!_pages[pageId].exists, "Page already exists");
        require(bytes(fullPath).length > 0, "Path cannot be empty");

        if (parentId != bytes32(0)) {
            require(_pages[parentId].exists, "Parent page does not exist");
        }

        _pages[pageId] = Page({fullPath: fullPath, parentId: parentId, exists: true});

        if (parentId != bytes32(0)) {
            _children[parentId].push(pageId);
        }

        emit PageCreated(pageId, fullPath);
    }

    /// @notice Retrieves the children of a page.
    /// @param pageId The parent page.
    /// @return Array of child page IDs.
    function getChildren(bytes32 pageId) external view returns (bytes32[] memory) {
        return _children[pageId];
    }

    /// @notice Retrieves page data.
    /// @param pageId The page to look up.
    /// @return The page struct.
    function getPage(bytes32 pageId) external view returns (Page memory) {
        require(_pages[pageId].exists, "Page does not exist");
        return _pages[pageId];
    }

    /// @notice Moves a page to a new parent.
    /// @param pageId The page to move.
    /// @param newParentId The new parent page ID.
    function movePage(bytes32 pageId, bytes32 newParentId) external {
        require(_pages[pageId].exists, "Page does not exist");
        if (newParentId != bytes32(0)) {
            require(_pages[newParentId].exists, "New parent does not exist");
        }
        require(pageId != newParentId, "Page cannot be its own parent");

        // Remove from old parent's children
        bytes32 oldParent = _pages[pageId].parentId;
        if (oldParent != bytes32(0)) {
            bytes32[] storage children = _children[oldParent];
            for (uint256 i = 0; i < children.length; i++) {
                if (children[i] == pageId) {
                    children[i] = children[children.length - 1];
                    children.pop();
                    break;
                }
            }
        }

        _pages[pageId].parentId = newParentId;

        if (newParentId != bytes32(0)) {
            _children[newParentId].push(pageId);
        }

        emit PageMoved(pageId, newParentId);
    }
}
