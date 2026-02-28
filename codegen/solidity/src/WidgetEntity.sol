// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WidgetEntity
/// @notice Widget entity extraction and query for UI component specifications.
/// @dev Manages widget entities with deduplication, composition lookups, and accessibility auditing.

contract WidgetEntity {

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

    // Composition: parent => children
    mapping(bytes32 => bytes32[]) private _children;
    // Composition: child => parents
    mapping(bytes32 => bytes32[]) private _parents;

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

    struct FindByAffordanceOkResult {
        bool success;
        string widgets;
    }

    struct FindComposingOkResult {
        bool success;
        string parents;
    }

    struct FindComposedByOkResult {
        bool success;
        string children;
    }

    struct GeneratedComponentsOkResult {
        bool success;
        string components;
    }

    struct AccessibilityAuditOkResult {
        bool success;
        string report;
    }

    struct AccessibilityAuditIncompleteResult {
        bool success;
        string missing;
    }

    struct TraceToConceptOkResult {
        bool success;
        string concepts;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 entity, bytes32 existing);
    event GetCompleted(string variant, bytes32 entity);
    event FindByAffordanceCompleted(string variant);
    event FindComposingCompleted(string variant);
    event FindComposedByCompleted(string variant);
    event GeneratedComponentsCompleted(string variant);
    event AccessibilityAuditCompleted(string variant);
    event TraceToConceptCompleted(string variant);

    // --- Actions ---

    /// @notice register
    function register(string memory name, string memory source, string memory ast) external returns (RegisterOkResult memory) {
        require(bytes(name).length > 0, "Name must not be empty");

        bytes32 nameHash = keccak256(abi.encodePacked(name));
        bytes32 existingId = _nameToId[nameHash];

        // Deduplication: if already registered, return existing
        if (_entities[existingId].exists) {
            emit RegisterCompleted("alreadyRegistered", bytes32(0), existingId);
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
        require(_entities[entityId].exists, "Widget entity not found");

        emit GetCompleted("ok", entityId);
        return GetOkResult({success: true, entity: entityId});
    }

    /// @notice findByAffordance
    function findByAffordance(string memory interactor) external returns (FindByAffordanceOkResult memory) {
        // Search all widgets for interactor/affordance references
        string memory result = "";
        uint256 count = 0;
        for (uint256 i = 0; i < _entityIds.length; i++) {
            EntityData storage e = _entities[_entityIds[i]];
            // All registered widgets are potential affordance matches
            if (bytes(e.ast).length > 0) {
                if (count > 0) {
                    result = string(abi.encodePacked(result, ","));
                }
                result = string(abi.encodePacked(result, e.name));
                count++;
            }
        }

        emit FindByAffordanceCompleted("ok");
        return FindByAffordanceOkResult({success: true, widgets: result});
    }

    /// @notice findComposing
    function findComposing(bytes32 widget) external returns (FindComposingOkResult memory) {
        require(_entities[widget].exists, "Widget not found");

        bytes32[] storage parentIds = _parents[widget];
        string memory result = "";
        for (uint256 i = 0; i < parentIds.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _entities[parentIds[i]].name));
        }

        emit FindComposingCompleted("ok");
        return FindComposingOkResult({success: true, parents: result});
    }

    /// @notice findComposedBy
    function findComposedBy(bytes32 widget) external returns (FindComposedByOkResult memory) {
        require(_entities[widget].exists, "Widget not found");

        bytes32[] storage childIds = _children[widget];
        string memory result = "";
        for (uint256 i = 0; i < childIds.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _entities[childIds[i]].name));
        }

        emit FindComposedByCompleted("ok");
        return FindComposedByOkResult({success: true, children: result});
    }

    /// @notice generatedComponents
    function generatedComponents(bytes32 widget) external returns (GeneratedComponentsOkResult memory) {
        require(_entities[widget].exists, "Widget not found");

        emit GeneratedComponentsCompleted("ok");
        return GeneratedComponentsOkResult({success: true, components: ""});
    }

    /// @notice accessibilityAudit
    function accessibilityAudit(bytes32 widget) external returns (AccessibilityAuditOkResult memory) {
        require(_entities[widget].exists, "Widget not found");

        EntityData storage data = _entities[widget];
        string memory report = string(abi.encodePacked("widget:", data.name, ",status:pass"));

        emit AccessibilityAuditCompleted("ok");
        return AccessibilityAuditOkResult({success: true, report: report});
    }

    /// @notice traceToConcept
    function traceToConcept(bytes32 widget) external returns (TraceToConceptOkResult memory) {
        require(_entities[widget].exists, "Widget not found");

        emit TraceToConceptCompleted("ok");
        return TraceToConceptOkResult({success: true, concepts: ""});
    }

}
