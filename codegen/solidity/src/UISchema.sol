// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title UISchema
/// @notice UI schema definition and inspection for generating element trees from concept specifications.
contract UISchema {

    // --- Storage ---

    struct SchemaEntry {
        string conceptSpec;
        string overrides;
        string uiSchema;
        string elements;
        bool inspected;
        uint256 createdAt;
    }

    mapping(bytes32 => SchemaEntry) private _schemas;
    mapping(bytes32 => bool) private _exists;

    // --- Types ---

    struct InspectOkResult {
        bool success;
        bytes32 schema;
    }

    struct OverrideOkResult {
        bool success;
        bytes32 schema;
    }

    struct GetSchemaOkResult {
        bool success;
        bytes32 schema;
        string uiSchema;
    }

    struct GetElementsOkResult {
        bool success;
        string elements;
    }

    // --- Events ---

    event InspectCompleted(string variant, bytes32 indexed schema);
    event OverrideCompleted(string variant, bytes32 indexed schema);
    event GetSchemaCompleted(string variant, bytes32 indexed schema);
    event GetElementsCompleted(string variant);

    // --- Actions ---

    /// @notice Inspect a concept specification to derive a UI schema.
    function inspect(bytes32 schema, string memory conceptSpec) external returns (InspectOkResult memory) {
        require(bytes(conceptSpec).length > 0, "Concept spec required");

        // Derive a UI schema and elements from the concept spec
        string memory uiSchema = string(abi.encodePacked("schema:", conceptSpec));
        string memory elements = string(abi.encodePacked("elements:", conceptSpec));

        _schemas[schema] = SchemaEntry({
            conceptSpec: conceptSpec,
            overrides: "",
            uiSchema: uiSchema,
            elements: elements,
            inspected: true,
            createdAt: block.timestamp
        });
        _exists[schema] = true;

        emit InspectCompleted("ok", schema);
        return InspectOkResult({success: true, schema: schema});
    }

    /// @notice Apply overrides to an existing schema.
    function applyOverride(bytes32 schema, string memory overrides) external returns (OverrideOkResult memory) {
        require(_exists[schema], "Schema not found");
        require(bytes(overrides).length > 0, "Overrides required");

        _schemas[schema].overrides = overrides;
        // Merge overrides into the UI schema
        _schemas[schema].uiSchema = string(abi.encodePacked(
            _schemas[schema].uiSchema, "+overrides:", overrides
        ));

        emit OverrideCompleted("ok", schema);
        return OverrideOkResult({success: true, schema: schema});
    }

    /// @notice Get the full UI schema definition.
    function getSchema(bytes32 schema) external returns (GetSchemaOkResult memory) {
        require(_exists[schema], "Schema not found");

        emit GetSchemaCompleted("ok", schema);
        return GetSchemaOkResult({success: true, schema: schema, uiSchema: _schemas[schema].uiSchema});
    }

    /// @notice Get the derived elements from an inspected schema.
    function getElements(bytes32 schema) external returns (GetElementsOkResult memory) {
        require(_exists[schema], "Schema not found");
        require(_schemas[schema].inspected, "Schema not inspected");

        emit GetElementsCompleted("ok");
        return GetElementsOkResult({success: true, elements: _schemas[schema].elements});
    }

}
