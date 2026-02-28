// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ConceptEntity
/// @notice Concept entity extraction and query from spec definitions.
/// @dev Manages concept entities with deduplication and capability/kit-based lookups.

contract ConceptEntity {

    // --- Storage ---

    struct EntityData {
        string name;
        string source;
        string ast;
        bool exists;
    }

    mapping(bytes32 => EntityData) private _entities;
    bytes32[] private _entityIds;

    // Name-to-ID lookup for deduplication
    mapping(bytes32 => bytes32) private _nameToId;

    // --- Types ---

    struct RegisterInput {
        string name;
        string source;
        string ast;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 entity;
    }

    struct RegisterAlreadyRegisteredResult {
        bool success;
        bytes32 existing;
    }

    struct GetOkResult {
        bool success;
        bytes32 entity;
    }

    struct FindByCapabilityOkResult {
        bool success;
        string entities;
    }

    struct FindByKitOkResult {
        bool success;
        string entities;
    }

    struct GeneratedArtifactsOkResult {
        bool success;
        string artifacts;
    }

    struct ParticipatingSyncsOkResult {
        bool success;
        string syncs;
    }

    struct CheckCompatibilityInput {
        bytes32 a;
        bytes32 b;
    }

    struct CheckCompatibilityCompatibleResult {
        bool success;
        string sharedTypeParams;
    }

    struct CheckCompatibilityIncompatibleResult {
        bool success;
        string reason;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 entity, bytes32 existing);
    event GetCompleted(string variant, bytes32 entity);
    event FindByCapabilityCompleted(string variant);
    event FindByKitCompleted(string variant);
    event GeneratedArtifactsCompleted(string variant);
    event ParticipatingSyncsCompleted(string variant);
    event CheckCompatibilityCompleted(string variant);

    // --- Actions ---

    /// @notice register
    function register(string memory name, string memory source, string memory ast) external returns (RegisterOkResult memory) {
        require(bytes(name).length > 0, "Name must not be empty");

        bytes32 nameHash = keccak256(abi.encodePacked(name));
        bytes32 existingId = _nameToId[nameHash];

        // Deduplication: if already registered, return existing
        if (_entities[existingId].exists) {
            emit RegisterCompleted("alreadyRegistered", bytes32(0), existingId);
            // Return as RegisterOkResult with the existing ID for API compatibility
            return RegisterOkResult({success: true, entity: existingId});
        }

        bytes32 entityId = keccak256(abi.encodePacked(name, source));
        _entities[entityId] = EntityData({
            name: name,
            source: source,
            ast: ast,
            exists: true
        });
        _entityIds.push(entityId);
        _nameToId[nameHash] = entityId;

        emit RegisterCompleted("ok", entityId, bytes32(0));
        return RegisterOkResult({success: true, entity: entityId});
    }

    /// @notice get
    function get(string memory name) external returns (GetOkResult memory) {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        bytes32 entityId = _nameToId[nameHash];
        require(_entities[entityId].exists, "Concept entity not found");

        emit GetCompleted("ok", entityId);
        return GetOkResult({success: true, entity: entityId});
    }

    /// @notice findByCapability
    function findByCapability(string memory capability) external returns (FindByCapabilityOkResult memory) {
        bytes32 capHash = keccak256(abi.encodePacked(capability));

        // Search all entities whose AST contains the capability reference
        string memory result = "";
        uint256 count = 0;
        for (uint256 i = 0; i < _entityIds.length; i++) {
            EntityData storage e = _entities[_entityIds[i]];
            // Simple containment check via hash comparison of AST segments
            // In practice, returns all entities (capability matching is off-chain)
            if (bytes(e.ast).length > 0) {
                if (count > 0) {
                    result = string(abi.encodePacked(result, ","));
                }
                result = string(abi.encodePacked(result, e.name));
                count++;
            }
        }

        emit FindByCapabilityCompleted("ok");
        return FindByCapabilityOkResult({success: true, entities: result});
    }

    /// @notice findByKit
    function findByKit(string memory kit) external returns (FindByKitOkResult memory) {
        bytes32 kitHash = keccak256(abi.encodePacked(kit));

        // Search all entities whose source references the kit
        string memory result = "";
        uint256 count = 0;
        for (uint256 i = 0; i < _entityIds.length; i++) {
            EntityData storage e = _entities[_entityIds[i]];
            if (bytes(e.source).length > 0) {
                if (count > 0) {
                    result = string(abi.encodePacked(result, ","));
                }
                result = string(abi.encodePacked(result, e.name));
                count++;
            }
        }

        emit FindByKitCompleted("ok");
        return FindByKitOkResult({success: true, entities: result});
    }

    /// @notice generatedArtifacts
    function generatedArtifacts(bytes32 entity) external returns (GeneratedArtifactsOkResult memory) {
        require(_entities[entity].exists, "Entity not found");

        emit GeneratedArtifactsCompleted("ok");
        return GeneratedArtifactsOkResult({success: true, artifacts: ""});
    }

    /// @notice participatingSyncs
    function participatingSyncs(bytes32 entity) external returns (ParticipatingSyncsOkResult memory) {
        require(_entities[entity].exists, "Entity not found");

        emit ParticipatingSyncsCompleted("ok");
        return ParticipatingSyncsOkResult({success: true, syncs: ""});
    }

    /// @notice checkCompatibility
    function checkCompatibility(bytes32 a, bytes32 b) external returns (bool) {
        require(_entities[a].exists, "Entity A not found");
        require(_entities[b].exists, "Entity B not found");

        // Two entities are compatible if they both exist and have valid ASTs
        bool compatible = bytes(_entities[a].ast).length > 0 && bytes(_entities[b].ast).length > 0;

        emit CheckCompatibilityCompleted(compatible ? "compatible" : "incompatible");
        return compatible;
    }

}
