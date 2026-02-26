// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DataSource
/// @notice Registry of external systems with health-check and discovery support
/// @dev Implements the DataSource concept from Clef specification.
///      Supports registering external data sources, connecting, discovering schemas,
///      running health checks, and deactivating sources.

contract DataSource {
    // --- Types ---

    struct Source {
        string name;
        string uri;
        string credentials;
        string status;
        uint256 lastHealthCheck;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps source ID to its Source entry
    mapping(bytes32 => Source) private _sources;

    // --- Events ---

    event SourceRegistered(bytes32 indexed sourceId, string name);
    event SourceConnected(bytes32 indexed sourceId);
    event SourceDeactivated(bytes32 indexed sourceId);

    // --- Actions ---

    /// @notice Register a new external data source
    /// @param sourceId Unique identifier for the source
    /// @param name Human-readable name of the source
    /// @param uri Connection URI for the source
    /// @param credentials Credential payload for authentication
    function register(bytes32 sourceId, string calldata name, string calldata uri, string calldata credentials) external {
        require(sourceId != bytes32(0), "Source ID cannot be zero");
        require(!_sources[sourceId].exists, "Source already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _sources[sourceId] = Source({
            name: name,
            uri: uri,
            credentials: credentials,
            status: "registered",
            lastHealthCheck: 0,
            exists: true
        });

        emit SourceRegistered(sourceId, name);
    }

    /// @notice Connect to a registered data source
    /// @param sourceId The source to connect to
    function connect(bytes32 sourceId) external {
        require(_sources[sourceId].exists, "Source not found");

        _sources[sourceId].status = "connected";

        emit SourceConnected(sourceId);
    }

    /// @notice Discover available schemas or tables from a source
    /// @param sourceId The source to discover
    /// @return status The current status after discovery
    function discover(bytes32 sourceId) external view returns (string memory status) {
        require(_sources[sourceId].exists, "Source not found");

        return _sources[sourceId].status;
    }

    /// @notice Perform a health check on a data source
    /// @param sourceId The source to check
    function healthCheck(bytes32 sourceId) external {
        require(_sources[sourceId].exists, "Source not found");

        _sources[sourceId].lastHealthCheck = block.timestamp;
    }

    /// @notice Deactivate a data source
    /// @param sourceId The source to deactivate
    function deactivate(bytes32 sourceId) external {
        require(_sources[sourceId].exists, "Source not found");

        _sources[sourceId].status = "inactive";

        emit SourceDeactivated(sourceId);
    }

    // --- Views ---

    /// @notice Retrieve a data source entry
    /// @param sourceId The source to look up
    /// @return The Source struct
    function getSource(bytes32 sourceId) external view returns (Source memory) {
        require(_sources[sourceId].exists, "Source not found");
        return _sources[sourceId];
    }

    /// @notice Check whether a source exists
    /// @param sourceId The source to check
    /// @return Whether the source exists
    function sourceExists(bytes32 sourceId) external view returns (bool) {
        return _sources[sourceId].exists;
    }
}
