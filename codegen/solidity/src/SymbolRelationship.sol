// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SymbolRelationship
/// @notice Symbol relationship management for linking and querying related symbols
/// @dev Implements the SymbolRelationship concept from Clef specification.
///      Supports creating directional relationships between symbols, querying
///      relationships from source or to target, and computing transitive closures.

contract SymbolRelationship {

    // --- Types ---

    struct AddInput {
        string source;
        string target;
        string kind;
    }

    struct AddOkResult {
        bool success;
        bytes32 relationship;
    }

    struct AddAlreadyExistsResult {
        bool success;
        bytes32 existing;
    }

    struct FindFromInput {
        string source;
        string kind;
    }

    struct FindFromOkResult {
        bool success;
        string relationships;
    }

    struct FindToInput {
        string target;
        string kind;
    }

    struct FindToOkResult {
        bool success;
        string relationships;
    }

    struct TransitiveClosureInput {
        string start;
        string kind;
        string direction;
    }

    struct TransitiveClosureOkResult {
        bool success;
        string symbols;
        string paths;
    }

    struct GetOkResult {
        bool success;
        bytes32 relationship;
        string source;
        string target;
        string kind;
        string metadata;
    }

    /// @dev Internal representation of a relationship entry
    struct RelationshipEntry {
        string source;
        string target;
        string kind;
        string metadata;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps relationship ID to its RelationshipEntry
    mapping(bytes32 => RelationshipEntry) private _relationships;

    /// @dev Maps (source, target, kind) hash to relationship ID for duplicate detection
    mapping(bytes32 => bytes32) private _relByTriple;

    /// @dev Ordered list of all relationship IDs
    bytes32[] private _relationshipIds;

    // --- Events ---

    event AddCompleted(string variant, bytes32 relationship, bytes32 existing);
    event FindFromCompleted(string variant);
    event FindToCompleted(string variant);
    event TransitiveClosureCompleted(string variant);
    event GetCompleted(string variant, bytes32 relationship);

    // --- Actions ---

    /// @notice add
    function add(string memory source, string memory target, string memory kind) external returns (AddOkResult memory) {
        require(bytes(source).length > 0, "Source cannot be empty");
        require(bytes(target).length > 0, "Target cannot be empty");
        require(bytes(kind).length > 0, "Kind cannot be empty");

        // Check for duplicate
        bytes32 tripleHash = keccak256(abi.encodePacked(source, target, kind));
        bytes32 existingId = _relByTriple[tripleHash];
        if (existingId != bytes32(0) && _relationships[existingId].exists) {
            revert("Relationship already exists");
        }

        bytes32 relId = keccak256(abi.encodePacked(source, target, kind, _relationshipIds.length, block.timestamp));

        _relationships[relId] = RelationshipEntry({
            source: source,
            target: target,
            kind: kind,
            metadata: "",
            exists: true
        });

        _relByTriple[tripleHash] = relId;
        _relationshipIds.push(relId);

        emit AddCompleted("ok", relId, bytes32(0));

        return AddOkResult({
            success: true,
            relationship: relId
        });
    }

    /// @notice findFrom
    function findFrom(string memory source, string memory kind) external returns (FindFromOkResult memory) {
        require(bytes(source).length > 0, "Source cannot be empty");

        bytes32 sourceHash = keccak256(abi.encodePacked(source));
        bool hasKindFilter = bytes(kind).length > 0;
        bytes32 kindHash = keccak256(abi.encodePacked(kind));
        string memory result = "";
        bool first = true;

        for (uint256 i = 0; i < _relationshipIds.length; i++) {
            RelationshipEntry storage entry = _relationships[_relationshipIds[i]];
            if (entry.exists && keccak256(abi.encodePacked(entry.source)) == sourceHash) {
                if (hasKindFilter && keccak256(abi.encodePacked(entry.kind)) != kindHash) {
                    continue;
                }
                if (!first) {
                    result = string(abi.encodePacked(result, ",", entry.target));
                } else {
                    result = entry.target;
                    first = false;
                }
            }
        }

        emit FindFromCompleted("ok");

        return FindFromOkResult({
            success: true,
            relationships: result
        });
    }

    /// @notice findTo
    function findTo(string memory target, string memory kind) external returns (FindToOkResult memory) {
        require(bytes(target).length > 0, "Target cannot be empty");

        bytes32 targetHash = keccak256(abi.encodePacked(target));
        bool hasKindFilter = bytes(kind).length > 0;
        bytes32 kindHash = keccak256(abi.encodePacked(kind));
        string memory result = "";
        bool first = true;

        for (uint256 i = 0; i < _relationshipIds.length; i++) {
            RelationshipEntry storage entry = _relationships[_relationshipIds[i]];
            if (entry.exists && keccak256(abi.encodePacked(entry.target)) == targetHash) {
                if (hasKindFilter && keccak256(abi.encodePacked(entry.kind)) != kindHash) {
                    continue;
                }
                if (!first) {
                    result = string(abi.encodePacked(result, ",", entry.source));
                } else {
                    result = entry.source;
                    first = false;
                }
            }
        }

        emit FindToCompleted("ok");

        return FindToOkResult({
            success: true,
            relationships: result
        });
    }

    /// @notice transitiveClosure
    function transitiveClosure(string memory start, string memory kind, string memory direction) external returns (TransitiveClosureOkResult memory) {
        require(bytes(start).length > 0, "Start cannot be empty");
        require(bytes(kind).length > 0, "Kind cannot be empty");
        require(bytes(direction).length > 0, "Direction cannot be empty");

        bytes32 kindHash = keccak256(abi.encodePacked(kind));
        bool isForward = keccak256(abi.encodePacked(direction)) == keccak256(abi.encodePacked("forward"));

        // Single-level traversal for on-chain gas efficiency
        // Full transitive closure would require unbounded iteration
        string memory result = "";
        bool first = true;
        bytes32 startHash = keccak256(abi.encodePacked(start));

        for (uint256 i = 0; i < _relationshipIds.length; i++) {
            RelationshipEntry storage entry = _relationships[_relationshipIds[i]];
            if (entry.exists && keccak256(abi.encodePacked(entry.kind)) == kindHash) {
                if (isForward && keccak256(abi.encodePacked(entry.source)) == startHash) {
                    if (!first) {
                        result = string(abi.encodePacked(result, ",", entry.target));
                    } else {
                        result = entry.target;
                        first = false;
                    }
                } else if (!isForward && keccak256(abi.encodePacked(entry.target)) == startHash) {
                    if (!first) {
                        result = string(abi.encodePacked(result, ",", entry.source));
                    } else {
                        result = entry.source;
                        first = false;
                    }
                }
            }
        }

        emit TransitiveClosureCompleted("ok");

        return TransitiveClosureOkResult({
            success: true,
            symbols: result,
            paths: start
        });
    }

    /// @notice get
    function get(bytes32 relationship) external returns (GetOkResult memory) {
        require(_relationships[relationship].exists, "Relationship not found");

        RelationshipEntry storage entry = _relationships[relationship];

        emit GetCompleted("ok", relationship);

        return GetOkResult({
            success: true,
            relationship: relationship,
            source: entry.source,
            target: entry.target,
            kind: entry.kind,
            metadata: entry.metadata
        });
    }

    // --- Views ---

    /// @notice Check if a relationship exists
    /// @param relationship The relationship ID to check
    /// @return Whether the relationship exists
    function relationshipExists(bytes32 relationship) external view returns (bool) {
        return _relationships[relationship].exists;
    }

    /// @notice Get the total number of relationships
    /// @return The count of relationships
    function relationshipCount() external view returns (uint256) {
        return _relationshipIds.length;
    }
}
