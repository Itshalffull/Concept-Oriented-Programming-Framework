// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PageAsRecord
/// @notice Concept-oriented page-as-database-record with schema binding and ordered body
/// @dev Implements the PageAsRecord concept from COPF specification.
///      Each page has key-value properties, an ordered body of child nodes, and optional schema binding.

contract PageAsRecord {
    // --- Types ---

    struct PageRecord {
        bytes32 schemaId;
        bool hasSchema;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps page node ID to its record data
    mapping(bytes32 => PageRecord) private _pages;

    /// @dev Maps page node ID -> property name -> property value
    mapping(bytes32 => mapping(string => string)) private _properties;

    /// @dev Maps page node ID -> ordered list of child node IDs (body)
    mapping(bytes32 => bytes32[]) private _body;

    // --- Events ---

    event PropertySet(bytes32 indexed nodeId, string name);
    event BodyAppended(bytes32 indexed nodeId, bytes32 childNodeId);
    event SchemaAttached(bytes32 indexed nodeId, bytes32 schemaId);
    event SchemaDetached(bytes32 indexed nodeId);

    // --- Actions ---

    /// @notice Create a new page record
    /// @param nodeId The unique identifier for this page
    function create(bytes32 nodeId) external {
        require(nodeId != bytes32(0), "Node ID cannot be zero");
        require(!_pages[nodeId].exists, "Page already exists");

        _pages[nodeId] = PageRecord({
            schemaId: bytes32(0),
            hasSchema: false,
            exists: true
        });
    }

    /// @notice Set a property on a page
    /// @param nodeId The page node ID
    /// @param name The property name
    /// @param value The property value
    function setProperty(bytes32 nodeId, string calldata name, string calldata value) external {
        require(_pages[nodeId].exists, "Page not found");

        _properties[nodeId][name] = value;

        emit PropertySet(nodeId, name);
    }

    /// @notice Get a property value from a page
    /// @param nodeId The page node ID
    /// @param name The property name
    /// @return The property value
    function getProperty(bytes32 nodeId, string calldata name) external view returns (string memory) {
        require(_pages[nodeId].exists, "Page not found");
        return _properties[nodeId][name];
    }

    /// @notice Append a child node to the page body
    /// @param nodeId The page node ID
    /// @param childNodeId The child node to append
    function appendToBody(bytes32 nodeId, bytes32 childNodeId) external {
        require(_pages[nodeId].exists, "Page not found");
        require(childNodeId != bytes32(0), "Child node ID cannot be zero");

        _body[nodeId].push(childNodeId);

        emit BodyAppended(nodeId, childNodeId);
    }

    /// @notice Attach a schema to a page
    /// @param nodeId The page node ID
    /// @param schemaId The schema ID to attach
    function attachToSchema(bytes32 nodeId, bytes32 schemaId) external {
        require(_pages[nodeId].exists, "Page not found");
        require(schemaId != bytes32(0), "Schema ID cannot be zero");

        _pages[nodeId].schemaId = schemaId;
        _pages[nodeId].hasSchema = true;

        emit SchemaAttached(nodeId, schemaId);
    }

    /// @notice Detach the schema from a page
    /// @param nodeId The page node ID
    function detachFromSchema(bytes32 nodeId) external {
        require(_pages[nodeId].exists, "Page not found");
        require(_pages[nodeId].hasSchema, "No schema attached");

        _pages[nodeId].schemaId = bytes32(0);
        _pages[nodeId].hasSchema = false;

        emit SchemaDetached(nodeId);
    }

    // --- View ---

    /// @notice Get the body (ordered child nodes) of a page
    /// @param nodeId The page node ID
    /// @return Array of child node IDs
    function getBody(bytes32 nodeId) external view returns (bytes32[] memory) {
        require(_pages[nodeId].exists, "Page not found");
        return _body[nodeId];
    }

    /// @notice Get the schema attached to a page
    /// @param nodeId The page node ID
    /// @return hasSchema Whether a schema is attached
    /// @return schemaId The attached schema ID
    function getSchema(bytes32 nodeId) external view returns (bool hasSchema, bytes32 schemaId) {
        require(_pages[nodeId].exists, "Page not found");
        return (_pages[nodeId].hasSchema, _pages[nodeId].schemaId);
    }
}
