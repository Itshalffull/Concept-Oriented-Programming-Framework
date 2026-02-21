// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Canvas
/// @notice Manages a spatial canvas with positioned nodes and labelled edges for visual graph layouts.
contract Canvas {
    struct CanvasNode {
        string nodeType;
        int256 posX;
        int256 posY;
        uint256 width;
        uint256 height;
        string content;
        bool exists;
    }

    struct CanvasEdge {
        bytes32 fromNode;
        bytes32 toNode;
        string label;
        bool exists;
    }

    mapping(bytes32 => CanvasNode) private _nodes;
    mapping(bytes32 => CanvasEdge) private _edges;
    bytes32[] private _nodeKeys;
    bytes32[] private _edgeKeys;

    event NodeAdded(bytes32 indexed nodeId);
    event NodeMoved(bytes32 indexed nodeId);
    event NodesConnected(bytes32 indexed edgeId, bytes32 indexed fromNode, bytes32 indexed toNode);

    /// @notice Adds a node to the canvas.
    /// @param nodeId Unique identifier for the node.
    /// @param nodeType The type of node.
    /// @param posX Horizontal position.
    /// @param posY Vertical position.
    /// @param content Node content or label.
    function addNode(
        bytes32 nodeId,
        string calldata nodeType,
        int256 posX,
        int256 posY,
        string calldata content
    ) external {
        require(!_nodes[nodeId].exists, "Node already exists");

        _nodes[nodeId] = CanvasNode({
            nodeType: nodeType,
            posX: posX,
            posY: posY,
            width: 0,
            height: 0,
            content: content,
            exists: true
        });

        _nodeKeys.push(nodeId);

        emit NodeAdded(nodeId);
    }

    /// @notice Moves a node to a new position.
    /// @param nodeId The node to move.
    /// @param newX New horizontal position.
    /// @param newY New vertical position.
    function moveNode(bytes32 nodeId, int256 newX, int256 newY) external {
        require(_nodes[nodeId].exists, "Node does not exist");

        _nodes[nodeId].posX = newX;
        _nodes[nodeId].posY = newY;

        emit NodeMoved(nodeId);
    }

    /// @notice Connects two nodes with an edge.
    /// @param edgeId Unique identifier for the edge.
    /// @param fromId The source node.
    /// @param toId The target node.
    /// @param label The edge label.
    function connectNodes(bytes32 edgeId, bytes32 fromId, bytes32 toId, string calldata label) external {
        require(!_edges[edgeId].exists, "Edge already exists");
        require(_nodes[fromId].exists, "Source node does not exist");
        require(_nodes[toId].exists, "Target node does not exist");

        _edges[edgeId] = CanvasEdge({
            fromNode: fromId,
            toNode: toId,
            label: label,
            exists: true
        });

        _edgeKeys.push(edgeId);

        emit NodesConnected(edgeId, fromId, toId);
    }

    /// @notice Retrieves a canvas node.
    /// @param nodeId The node to look up.
    /// @return The canvas node struct.
    function getNode(bytes32 nodeId) external view returns (CanvasNode memory) {
        require(_nodes[nodeId].exists, "Node does not exist");
        return _nodes[nodeId];
    }

    /// @notice Retrieves a canvas edge.
    /// @param edgeId The edge to look up.
    /// @return The canvas edge struct.
    function getEdge(bytes32 edgeId) external view returns (CanvasEdge memory) {
        require(_edges[edgeId].exists, "Edge does not exist");
        return _edges[edgeId];
    }
}
