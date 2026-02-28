// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title StateField
/// @notice State field entity extraction and query for concept specifications.
/// @dev Manages state field entities with concept-based lookups and generated/storage tracing.

contract StateField {

    // --- Storage ---

    struct FieldData {
        string concept;
        string name;
        string typeExpr;
        string cardinality;
        bool exists;
    }

    mapping(bytes32 => FieldData) private _fields;
    bytes32[] private _fieldIds;

    // Concept index: conceptHash => list of field IDs
    mapping(bytes32 => bytes32[]) private _conceptIndex;

    // --- Types ---

    struct RegisterInput {
        string concept;
        string name;
        string typeExpr;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 field;
    }

    struct FindByConceptOkResult {
        bool success;
        string fields;
    }

    struct TraceToGeneratedOkResult {
        bool success;
        string targets;
    }

    struct TraceToStorageOkResult {
        bool success;
        string targets;
    }

    struct GetOkResult {
        bool success;
        bytes32 field;
        string concept;
        string name;
        string typeExpr;
        string cardinality;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 field);
    event FindByConceptCompleted(string variant);
    event TraceToGeneratedCompleted(string variant);
    event TraceToStorageCompleted(string variant);
    event GetCompleted(string variant, bytes32 field);

    // --- Actions ---

    /// @notice register
    function register(string memory concept, string memory name, string memory typeExpr) external returns (RegisterOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(name).length > 0, "Name must not be empty");

        bytes32 fieldId = keccak256(abi.encodePacked(concept, name));
        require(!_fields[fieldId].exists, "Field already registered");

        // Derive cardinality from type expression
        string memory cardinality = _deriveCardinality(typeExpr);

        _fields[fieldId] = FieldData({
            concept: concept,
            name: name,
            typeExpr: typeExpr,
            cardinality: cardinality,
            exists: true
        });
        _fieldIds.push(fieldId);

        bytes32 conceptHash = keccak256(abi.encodePacked(concept));
        _conceptIndex[conceptHash].push(fieldId);

        emit RegisterCompleted("ok", fieldId);
        return RegisterOkResult({success: true, field: fieldId});
    }

    /// @notice findByConcept
    function findByConcept(string memory concept) external returns (FindByConceptOkResult memory) {
        bytes32 conceptHash = keccak256(abi.encodePacked(concept));
        bytes32[] storage ids = _conceptIndex[conceptHash];

        string memory result = "";
        for (uint256 i = 0; i < ids.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _fields[ids[i]].name));
        }

        emit FindByConceptCompleted("ok");
        return FindByConceptOkResult({success: true, fields: result});
    }

    /// @notice traceToGenerated
    function traceToGenerated(bytes32 field) external returns (TraceToGeneratedOkResult memory) {
        require(_fields[field].exists, "Field not found");

        // Tracing to generated artifacts is an off-chain operation; return field reference
        FieldData storage data = _fields[field];
        string memory targets = string(abi.encodePacked(data.concept, ".", data.name));

        emit TraceToGeneratedCompleted("ok");
        return TraceToGeneratedOkResult({success: true, targets: targets});
    }

    /// @notice traceToStorage
    function traceToStorage(bytes32 field) external returns (TraceToStorageOkResult memory) {
        require(_fields[field].exists, "Field not found");

        FieldData storage data = _fields[field];
        string memory targets = string(abi.encodePacked(data.concept, ".", data.name, ":", data.typeExpr));

        emit TraceToStorageCompleted("ok");
        return TraceToStorageOkResult({success: true, targets: targets});
    }

    /// @notice get
    function get(bytes32 field) external returns (GetOkResult memory) {
        require(_fields[field].exists, "Field not found");

        FieldData storage data = _fields[field];

        emit GetCompleted("ok", field);
        return GetOkResult({
            success: true,
            field: field,
            concept: data.concept,
            name: data.name,
            typeExpr: data.typeExpr,
            cardinality: data.cardinality
        });
    }

    /// @dev Derive cardinality from type expression (array types are "many", otherwise "one")
    function _deriveCardinality(string memory typeExpr) internal pure returns (string memory) {
        bytes memory b = bytes(typeExpr);
        if (b.length >= 2 && b[b.length - 1] == "]" && b[b.length - 2] == "[") {
            return "many";
        }
        return "one";
    }

}
