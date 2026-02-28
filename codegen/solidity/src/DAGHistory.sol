// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DAGHistory
/// @notice Directed acyclic graph of version nodes with parent-child tracking.
contract DAGHistory {
    struct Node {
        bytes32[] parents;
        bytes32 contentRef;
        bytes metadata;
        uint256 created;
        bool exists;
    }

    mapping(bytes32 => Node) private _nodes;
    mapping(bytes32 => bytes32[]) private _children;
    bytes32[] private _roots;
    uint256 private _nonce;

    event NodeAppended(bytes32 indexed nodeId, bytes32 contentRef, uint256 parentCount);
    event RootAdded(bytes32 indexed nodeId);

    /// @notice Appends a new node to the DAG.
    /// @param parents The parent node IDs (empty for root nodes).
    /// @param contentRef A reference to the content this node represents.
    /// @param metadata Arbitrary metadata for the node.
    /// @return nodeId The unique identifier for the new node.
    function append(
        bytes32[] calldata parents,
        bytes32 contentRef,
        bytes calldata metadata
    ) external returns (bytes32 nodeId) {
        nodeId = keccak256(abi.encodePacked(contentRef, block.timestamp, _nonce++));

        // Verify all parents exist
        for (uint256 i = 0; i < parents.length; i++) {
            require(_nodes[parents[i]].exists, "Parent node does not exist");
        }

        _nodes[nodeId] = Node({
            parents: parents,
            contentRef: contentRef,
            metadata: metadata,
            created: block.timestamp,
            exists: true
        });

        // Register this node as a child of each parent
        for (uint256 i = 0; i < parents.length; i++) {
            _children[parents[i]].push(nodeId);
        }

        // If no parents, this is a root node
        if (parents.length == 0) {
            _roots.push(nodeId);
            emit RootAdded(nodeId);
        }

        emit NodeAppended(nodeId, contentRef, parents.length);
    }

    /// @notice Returns the parent nodes (immediate ancestors) of a node.
    /// @param nodeId The node to query.
    /// @return The array of parent node IDs.
    function ancestors(bytes32 nodeId) external view returns (bytes32[] memory) {
        require(_nodes[nodeId].exists, "Node does not exist");
        return _nodes[nodeId].parents;
    }

    /// @notice Finds a common ancestor between two nodes (simplified: checks direct parents).
    /// @param a The first node.
    /// @param b The second node.
    /// @return found True if a common ancestor was found.
    /// @return ancestorId The common ancestor node ID (zero if not found).
    function commonAncestor(bytes32 a, bytes32 b) external view returns (bool found, bytes32 ancestorId) {
        require(_nodes[a].exists, "Node A does not exist");
        require(_nodes[b].exists, "Node B does not exist");

        // Check if a is a parent of b or vice versa
        bytes32[] memory parentsA = _nodes[a].parents;
        bytes32[] memory parentsB = _nodes[b].parents;

        for (uint256 i = 0; i < parentsA.length; i++) {
            for (uint256 j = 0; j < parentsB.length; j++) {
                if (parentsA[i] == parentsB[j]) {
                    return (true, parentsA[i]);
                }
            }
        }

        // Check if one is the direct parent of the other
        for (uint256 i = 0; i < parentsB.length; i++) {
            if (parentsB[i] == a) {
                return (true, a);
            }
        }
        for (uint256 i = 0; i < parentsA.length; i++) {
            if (parentsA[i] == b) {
                return (true, b);
            }
        }

        return (false, bytes32(0));
    }

    /// @notice Returns the direct children (descendants) of a node.
    /// @param nodeId The node to query.
    /// @return The array of child node IDs.
    function descendants(bytes32 nodeId) external view returns (bytes32[] memory) {
        require(_nodes[nodeId].exists, "Node does not exist");
        return _children[nodeId];
    }

    /// @notice Retrieves full node information.
    /// @param nodeId The node to retrieve.
    /// @return parents The parent node IDs.
    /// @return contentRef The content reference.
    /// @return metadata The node metadata.
    function getNode(bytes32 nodeId)
        external
        view
        returns (bytes32[] memory parents, bytes32 contentRef, bytes memory metadata)
    {
        require(_nodes[nodeId].exists, "Node does not exist");
        Node storage n = _nodes[nodeId];
        return (n.parents, n.contentRef, n.metadata);
    }

    /// @notice Returns all root nodes (nodes with no parents).
    /// @return The array of root node IDs.
    function getRoots() external view returns (bytes32[] memory) {
        return _roots;
    }
}
