// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Graph
/// @notice Manages a directed graph of nodes and edges with adjacency tracking.
contract Graph {
    mapping(bytes32 => bool) private _nodes;

    struct Edge {
        bytes32 source;
        bytes32 target;
        bool exists;
    }

    mapping(bytes32 => Edge) private _edges; // edgeId (keccak of source+target)
    mapping(bytes32 => bytes32[]) private _outEdges; // source -> targets
    mapping(bytes32 => bytes32[]) private _inEdges; // target -> sources

    event NodeAdded(bytes32 indexed entityId);
    event NodeRemoved(bytes32 indexed entityId);
    event EdgeAdded(bytes32 indexed source, bytes32 indexed target);
    event EdgeRemoved(bytes32 indexed source, bytes32 indexed target);

    /// @notice Adds a node to the graph.
    /// @param entityId The node identifier.
    function addNode(bytes32 entityId) external {
        require(!_nodes[entityId], "Node already exists");

        _nodes[entityId] = true;

        emit NodeAdded(entityId);
    }

    /// @notice Removes a node from the graph.
    /// @param entityId The node identifier.
    function removeNode(bytes32 entityId) external {
        require(_nodes[entityId], "Node does not exist");

        _nodes[entityId] = false;

        emit NodeRemoved(entityId);
    }

    /// @notice Adds a directed edge between two nodes.
    /// @param source The source node.
    /// @param target The target node.
    function addEdge(bytes32 source, bytes32 target) external {
        require(_nodes[source], "Source node does not exist");
        require(_nodes[target], "Target node does not exist");

        bytes32 edgeId = keccak256(abi.encodePacked(source, target));
        require(!_edges[edgeId].exists, "Edge already exists");

        _edges[edgeId] = Edge({source: source, target: target, exists: true});
        _outEdges[source].push(target);
        _inEdges[target].push(source);

        emit EdgeAdded(source, target);
    }

    /// @notice Removes a directed edge between two nodes.
    /// @param source The source node.
    /// @param target The target node.
    function removeEdge(bytes32 source, bytes32 target) external {
        bytes32 edgeId = keccak256(abi.encodePacked(source, target));
        require(_edges[edgeId].exists, "Edge does not exist");

        delete _edges[edgeId];

        // Remove from outEdges
        bytes32[] storage outs = _outEdges[source];
        for (uint256 i = 0; i < outs.length; i++) {
            if (outs[i] == target) {
                outs[i] = outs[outs.length - 1];
                outs.pop();
                break;
            }
        }

        // Remove from inEdges
        bytes32[] storage ins = _inEdges[target];
        for (uint256 i = 0; i < ins.length; i++) {
            if (ins[i] == source) {
                ins[i] = ins[ins.length - 1];
                ins.pop();
                break;
            }
        }

        emit EdgeRemoved(source, target);
    }

    /// @notice Retrieves outgoing edge targets for a node.
    /// @param entityId The source node.
    /// @return Array of target node IDs.
    function getOutEdges(bytes32 entityId) external view returns (bytes32[] memory) {
        return _outEdges[entityId];
    }

    /// @notice Retrieves incoming edge sources for a node.
    /// @param entityId The target node.
    /// @return Array of source node IDs.
    function getInEdges(bytes32 entityId) external view returns (bytes32[] memory) {
        return _inEdges[entityId];
    }

    /// @notice Checks whether a node exists.
    /// @param entityId The node to check.
    /// @return True if the node exists.
    function nodeExists(bytes32 entityId) external view returns (bool) {
        return _nodes[entityId];
    }
}
