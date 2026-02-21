// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Relation
/// @notice Concept-oriented relation definitions with typed, directional links between entities
/// @dev Implements the Relation concept from COPF specification.
///      Supports defining relation schemas (name, types, cardinality, bidirectionality)
///      and creating/removing links that conform to those definitions.

contract Relation {
    // --- Types ---

    struct RelationDef {
        string name;
        string sourceType;
        string targetType;
        uint8 cardinality;
        bool bidirectional;
        bool exists;
    }

    struct Link {
        bytes32 sourceId;
        bytes32 targetId;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps relation ID to its definition
    mapping(bytes32 => RelationDef) private _relations;

    /// @dev Maps relation ID -> array of links
    mapping(bytes32 => Link[]) private _links;

    // --- Events ---

    event RelationDefined(bytes32 indexed relationId, string name);
    event Linked(bytes32 indexed relationId, bytes32 sourceId, bytes32 targetId);
    event Unlinked(bytes32 indexed relationId, bytes32 sourceId, bytes32 targetId);

    // --- Actions ---

    /// @notice Define a new relation schema
    /// @param relationId The unique identifier for this relation
    /// @param name The human-readable name of the relation
    /// @param sourceType The expected source entity type
    /// @param targetType The expected target entity type
    /// @param cardinality The cardinality constraint (application-defined encoding)
    /// @param bidirectional Whether the relation is bidirectional
    function defineRelation(
        bytes32 relationId,
        string calldata name,
        string calldata sourceType,
        string calldata targetType,
        uint8 cardinality,
        bool bidirectional
    ) external {
        require(relationId != bytes32(0), "Relation ID cannot be zero");
        require(!_relations[relationId].exists, "Relation already defined");

        _relations[relationId] = RelationDef({
            name: name,
            sourceType: sourceType,
            targetType: targetType,
            cardinality: cardinality,
            bidirectional: bidirectional,
            exists: true
        });

        emit RelationDefined(relationId, name);
    }

    /// @notice Create a link between two entities under a relation
    /// @param relationId The relation to link under
    /// @param sourceId The source entity
    /// @param targetId The target entity
    function link(bytes32 relationId, bytes32 sourceId, bytes32 targetId) external {
        require(_relations[relationId].exists, "Relation not found");
        require(sourceId != bytes32(0), "Source ID cannot be zero");
        require(targetId != bytes32(0), "Target ID cannot be zero");

        _links[relationId].push(Link({
            sourceId: sourceId,
            targetId: targetId,
            exists: true
        }));

        emit Linked(relationId, sourceId, targetId);
    }

    /// @notice Remove a link between two entities under a relation
    /// @param relationId The relation to unlink from
    /// @param sourceId The source entity
    /// @param targetId The target entity
    function unlink(bytes32 relationId, bytes32 sourceId, bytes32 targetId) external {
        require(_relations[relationId].exists, "Relation not found");

        Link[] storage links = _links[relationId];
        uint256 len = links.length;
        bool found = false;

        for (uint256 i = 0; i < len; i++) {
            if (links[i].sourceId == sourceId && links[i].targetId == targetId && links[i].exists) {
                // Swap with last and pop
                if (i != len - 1) {
                    links[i] = links[len - 1];
                }
                links.pop();
                found = true;
                break;
            }
        }

        require(found, "Link not found");

        emit Unlinked(relationId, sourceId, targetId);
    }

    // --- View ---

    /// @notice Get all related entity IDs for a node under a specific relation
    /// @dev For source nodes, returns targets; for bidirectional relations, also returns sources
    /// @param nodeId The node to query related entities for
    /// @param relationId The relation to query
    /// @return Array of related entity IDs
    function getRelated(bytes32 nodeId, bytes32 relationId) external view returns (bytes32[] memory) {
        require(_relations[relationId].exists, "Relation not found");

        Link[] storage links = _links[relationId];
        uint256 len = links.length;
        bool isBidirectional = _relations[relationId].bidirectional;

        // First pass: count matches
        uint256 matchCount = 0;
        for (uint256 i = 0; i < len; i++) {
            if (links[i].exists) {
                if (links[i].sourceId == nodeId) {
                    matchCount++;
                } else if (isBidirectional && links[i].targetId == nodeId) {
                    matchCount++;
                }
            }
        }

        // Second pass: collect results
        bytes32[] memory result = new bytes32[](matchCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < len; i++) {
            if (links[i].exists) {
                if (links[i].sourceId == nodeId) {
                    result[idx] = links[i].targetId;
                    idx++;
                } else if (isBidirectional && links[i].targetId == nodeId) {
                    result[idx] = links[i].sourceId;
                    idx++;
                }
            }
        }

        return result;
    }
}
