// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Registry
/// @notice Generic concept registry with registration, lookup, listing, and removal
/// @dev Implements the Registry concept from Clef specification.
///      Supports registering concepts by URI with transport metadata,
///      deregistering concepts, checking availability via heartbeat, and listing all entries.

contract Registry {

    // --- Types ---

    struct ConceptEntry {
        string uri;
        bytes transport;
        uint256 registeredAt;
        bool available;
        bool exists;
    }

    struct RegisterInput {
        string uri;
        bytes transport;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 concept;
    }

    struct RegisterErrorResult {
        bool success;
        string message;
    }

    struct HeartbeatOkResult {
        bool success;
        bool available;
    }

    // --- Storage ---

    /// @dev Maps concept ID to its ConceptEntry
    mapping(bytes32 => ConceptEntry) private _concepts;

    /// @dev Maps URI hash to concept ID for lookup by URI
    mapping(bytes32 => bytes32) private _uriToId;

    /// @dev Ordered list of all concept IDs
    bytes32[] private _conceptIds;

    /// @dev Nonce for uniqueness
    uint256 private _nonce;

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 concept);
    event DeregisterCompleted(string variant);
    event HeartbeatCompleted(string variant, bool available);

    // --- Actions ---

    /// @notice register - adds a concept entry to the registry
    /// @param uri The unique concept URI
    /// @param transport Serialised transport metadata
    /// @return result The register result with concept ID
    function register(string calldata uri, bytes calldata transport) external returns (RegisterOkResult memory result) {
        require(bytes(uri).length > 0, "URI cannot be empty");

        bytes32 uriHash = keccak256(abi.encodePacked(uri));
        require(_uriToId[uriHash] == bytes32(0), "URI already registered");

        bytes32 conceptId = keccak256(abi.encodePacked(uri, block.timestamp, _nonce));
        _nonce++;

        _concepts[conceptId] = ConceptEntry({
            uri: uri,
            transport: transport,
            registeredAt: block.timestamp,
            available: true,
            exists: true
        });

        _uriToId[uriHash] = conceptId;
        _conceptIds.push(conceptId);

        result = RegisterOkResult({ success: true, concept: conceptId });

        emit RegisterCompleted("ok", conceptId);
    }

    /// @notice deregister - removes a concept from the registry by URI
    /// @param uri The concept URI to remove
    /// @return success Whether the deregistration succeeded
    function deregister(string calldata uri) external returns (bool) {
        bytes32 uriHash = keccak256(abi.encodePacked(uri));
        bytes32 conceptId = _uriToId[uriHash];
        require(conceptId != bytes32(0), "URI not registered");
        require(_concepts[conceptId].exists, "Concept not found");

        _concepts[conceptId].exists = false;
        _concepts[conceptId].available = false;
        _uriToId[uriHash] = bytes32(0);

        emit DeregisterCompleted("ok");
        return true;
    }

    /// @notice heartbeat - checks if a registered concept is available
    /// @param uri The concept URI to check
    /// @return result The heartbeat result with availability status
    function heartbeat(string calldata uri) external returns (HeartbeatOkResult memory result) {
        bytes32 uriHash = keccak256(abi.encodePacked(uri));
        bytes32 conceptId = _uriToId[uriHash];
        require(conceptId != bytes32(0), "URI not registered");

        bool available = _concepts[conceptId].exists && _concepts[conceptId].available;

        result = HeartbeatOkResult({ success: true, available: available });

        emit HeartbeatCompleted("ok", available);
    }

    // --- Views ---

    /// @notice get - retrieves a concept entry by its ID
    /// @param conceptId The concept ID to look up
    /// @return The ConceptEntry struct
    function get(bytes32 conceptId) external view returns (ConceptEntry memory) {
        require(_concepts[conceptId].exists, "Concept not found");
        return _concepts[conceptId];
    }

    /// @notice getByUri - retrieves a concept entry by its URI
    /// @param uri The concept URI to look up
    /// @return The ConceptEntry struct
    function getByUri(string calldata uri) external view returns (ConceptEntry memory) {
        bytes32 uriHash = keccak256(abi.encodePacked(uri));
        bytes32 conceptId = _uriToId[uriHash];
        require(conceptId != bytes32(0), "URI not registered");
        require(_concepts[conceptId].exists, "Concept not found");
        return _concepts[conceptId];
    }

    /// @notice list - returns all registered concept IDs
    /// @return The array of concept IDs
    function list() external view returns (bytes32[] memory) {
        return _conceptIds;
    }

    /// @notice Check if a concept exists by ID
    /// @param conceptId The concept ID to check
    /// @return Whether the concept exists
    function conceptExists(bytes32 conceptId) external view returns (bool) {
        return _concepts[conceptId].exists;
    }
}
