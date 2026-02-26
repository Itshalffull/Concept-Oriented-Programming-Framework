// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Connector
/// @notice Uniform read/write interface to external systems via configurable connectors
/// @dev Implements the Connector concept from Clef specification.
///      Supports configuring connectors per source and protocol, reading, writing,
///      testing connectivity, and discovering available endpoints.

contract Connector {
    // --- Types ---

    struct ConnectorEntry {
        bytes32 sourceId;
        bytes32 protocolId;
        string config;
        string status;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps connector ID to its ConnectorEntry
    mapping(bytes32 => ConnectorEntry) private _connectors;

    // --- Events ---

    event ConnectorConfigured(bytes32 indexed connectorId, bytes32 indexed sourceId, bytes32 protocolId);
    event ConnectorRead(bytes32 indexed connectorId, string query);
    event ConnectorWritten(bytes32 indexed connectorId);

    // --- Actions ---

    /// @notice Configure a new connector for a source and protocol
    /// @param connectorId Unique identifier for the connector
    /// @param sourceId The data source this connector targets
    /// @param protocolId The protocol used for communication
    /// @param config Serialised configuration payload
    function configure(bytes32 connectorId, bytes32 sourceId, bytes32 protocolId, string calldata config) external {
        require(connectorId != bytes32(0), "Connector ID cannot be zero");
        require(!_connectors[connectorId].exists, "Connector already exists");

        _connectors[connectorId] = ConnectorEntry({
            sourceId: sourceId,
            protocolId: protocolId,
            config: config,
            status: "configured",
            exists: true
        });

        emit ConnectorConfigured(connectorId, sourceId, protocolId);
    }

    /// @notice Read data from the external system via a connector
    /// @param connectorId The connector to read through
    /// @param query The query or request payload
    /// @return result Placeholder result acknowledging the read
    function read(bytes32 connectorId, string calldata query) external returns (string memory result) {
        require(_connectors[connectorId].exists, "Connector not found");

        emit ConnectorRead(connectorId, query);

        return query;
    }

    /// @notice Write data to the external system via a connector
    /// @param connectorId The connector to write through
    /// @param data The data payload to write
    function write(bytes32 connectorId, string calldata data) external {
        require(_connectors[connectorId].exists, "Connector not found");
        require(bytes(data).length > 0, "Data cannot be empty");

        emit ConnectorWritten(connectorId);
    }

    /// @notice Test connectivity of a connector
    /// @param connectorId The connector to test
    function test(bytes32 connectorId) external {
        require(_connectors[connectorId].exists, "Connector not found");

        _connectors[connectorId].status = "tested";
    }

    /// @notice Discover available endpoints through a connector
    /// @param connectorId The connector to discover through
    /// @return status The current connector status
    function discover(bytes32 connectorId) external view returns (string memory status) {
        require(_connectors[connectorId].exists, "Connector not found");

        return _connectors[connectorId].status;
    }

    // --- Views ---

    /// @notice Retrieve a connector entry
    /// @param connectorId The connector to look up
    /// @return The ConnectorEntry struct
    function getConnector(bytes32 connectorId) external view returns (ConnectorEntry memory) {
        require(_connectors[connectorId].exists, "Connector not found");
        return _connectors[connectorId];
    }

    /// @notice Check whether a connector exists
    /// @param connectorId The connector to check
    /// @return Whether the connector exists
    function connectorExists(bytes32 connectorId) external view returns (bool) {
        return _connectors[connectorId].exists;
    }
}
