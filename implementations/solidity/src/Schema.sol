// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Schema
/// @notice Defines and manages typed field schemas that can be applied to nodes, with support for inheritance.
contract Schema {
    struct SchemaData {
        string name;
        string fields;
        bytes32 parentId;
        bool exists;
    }

    mapping(bytes32 => SchemaData) private _schemas;
    mapping(bytes32 => bytes32) private _nodeSchema; // nodeId -> schemaId
    mapping(bytes32 => bool) private _hasSchema;

    event SchemaDefined(bytes32 indexed schemaId, string name);
    event FieldAdded(bytes32 indexed schemaId);
    event SchemaExtended(bytes32 indexed childId, bytes32 indexed parentId);
    event SchemaApplied(bytes32 indexed nodeId, bytes32 indexed schemaId);
    event SchemaRemoved(bytes32 indexed nodeId);

    /// @notice Defines a new schema with a name and serialised field definitions.
    /// @param schemaId Unique identifier for the schema.
    /// @param name Human-readable schema name.
    /// @param fields Serialised field definitions.
    function defineSchema(bytes32 schemaId, string calldata name, string calldata fields) external {
        require(!_schemas[schemaId].exists, "Schema already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _schemas[schemaId] = SchemaData({
            name: name,
            fields: fields,
            parentId: bytes32(0),
            exists: true
        });

        emit SchemaDefined(schemaId, name);
    }

    /// @notice Appends a field definition to an existing schema.
    /// @param schemaId The schema to modify.
    /// @param fieldDef The field definition to append.
    function addField(bytes32 schemaId, string calldata fieldDef) external {
        require(_schemas[schemaId].exists, "Schema does not exist");

        _schemas[schemaId].fields = string(abi.encodePacked(_schemas[schemaId].fields, ",", fieldDef));

        emit FieldAdded(schemaId);
    }

    /// @notice Sets a parent schema for inheritance.
    /// @param childId The child schema.
    /// @param parentId The parent schema to inherit from.
    function extendSchema(bytes32 childId, bytes32 parentId) external {
        require(_schemas[childId].exists, "Child schema does not exist");
        require(_schemas[parentId].exists, "Parent schema does not exist");
        require(childId != parentId, "Schema cannot extend itself");

        _schemas[childId].parentId = parentId;

        emit SchemaExtended(childId, parentId);
    }

    /// @notice Applies a schema to a node.
    /// @param nodeId The node to apply the schema to.
    /// @param schemaId The schema to apply.
    function applyTo(bytes32 nodeId, bytes32 schemaId) external {
        require(_schemas[schemaId].exists, "Schema does not exist");
        require(nodeId != bytes32(0), "Invalid node ID");

        _nodeSchema[nodeId] = schemaId;
        _hasSchema[nodeId] = true;

        emit SchemaApplied(nodeId, schemaId);
    }

    /// @notice Removes the schema assignment from a node.
    /// @param nodeId The node to remove the schema from.
    function removeFrom(bytes32 nodeId) external {
        require(_hasSchema[nodeId], "Node has no schema");

        delete _nodeSchema[nodeId];
        _hasSchema[nodeId] = false;

        emit SchemaRemoved(nodeId);
    }

    /// @notice Retrieves schema data.
    /// @param schemaId The schema to look up.
    /// @return The schema struct.
    function getSchema(bytes32 schemaId) external view returns (SchemaData memory) {
        require(_schemas[schemaId].exists, "Schema does not exist");
        return _schemas[schemaId];
    }

    /// @notice Retrieves the schema assigned to a node.
    /// @param nodeId The node to look up.
    /// @return hasSchema Whether the node has a schema assigned.
    /// @return schemaId The assigned schema ID (zero if none).
    function getNodeSchema(bytes32 nodeId) external view returns (bool hasSchema, bytes32 schemaId) {
        return (_hasSchema[nodeId], _nodeSchema[nodeId]);
    }
}
