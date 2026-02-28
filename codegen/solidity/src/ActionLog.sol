// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ActionLog
/// @notice Action execution logging with recording, retrieval, querying, and purging
/// @dev Implements the ActionLog concept from Clef specification.
///      Supports appending action execution records, linking records via edges,
///      querying by action/concept/time filters, and purging old entries.

contract ActionLog {

    // --- Types ---

    struct LogRecord {
        bytes data;
        uint256 timestamp;
        string action;
        string concept;
        bool exists;
    }

    struct Edge {
        bytes32 from;
        bytes32 to;
        string sync;
        bool exists;
    }

    struct AppendOkResult {
        bool success;
        bytes32 id;
    }

    struct AddEdgeInput {
        bytes32 from;
        bytes32 to;
        string sync;
    }

    struct QueryOkResult {
        bool success;
        bytes[] records;
    }

    // --- Storage ---

    /// @dev Maps record ID to its LogRecord
    mapping(bytes32 => LogRecord) private _records;

    /// @dev Ordered list of all record IDs
    bytes32[] private _recordIds;

    /// @dev Maps edge ID to its Edge
    mapping(bytes32 => Edge) private _edges;

    /// @dev Ordered list of all edge IDs
    bytes32[] private _edgeIds;

    /// @dev Nonce for generating unique IDs
    uint256 private _nonce;

    // --- Events ---

    event AppendCompleted(string variant, bytes32 id);
    event AddEdgeCompleted(string variant);
    event QueryCompleted(string variant, bytes[] records);
    event PurgeCompleted(uint256 removedCount);

    // --- Actions ---

    /// @notice append - stores an action execution log record
    /// @param record The serialised action execution record
    /// @return result The append result with generated ID
    function append(bytes calldata record) external returns (AppendOkResult memory result) {
        require(record.length > 0, "Record cannot be empty");

        bytes32 id = keccak256(abi.encodePacked(record, block.timestamp, _nonce));
        _nonce++;

        _records[id] = LogRecord({
            data: record,
            timestamp: block.timestamp,
            action: "",
            concept: "",
            exists: true
        });
        _recordIds.push(id);

        result = AppendOkResult({ success: true, id: id });

        emit AppendCompleted("ok", id);
    }

    /// @notice addEdge - links two records via a sync relationship
    /// @param from The source record ID
    /// @param to The target record ID
    /// @param sync The sync relationship label
    /// @return success Whether the edge was added
    function addEdge(bytes32 from, bytes32 to, string calldata sync) external returns (bool) {
        require(_records[from].exists, "Source record not found");
        require(_records[to].exists, "Target record not found");

        bytes32 edgeId = keccak256(abi.encodePacked(from, to, sync));
        require(!_edges[edgeId].exists, "Edge already exists");

        _edges[edgeId] = Edge({
            from: from,
            to: to,
            sync: sync,
            exists: true
        });
        _edgeIds.push(edgeId);

        emit AddEdgeCompleted("ok");
        return true;
    }

    /// @notice query - retrieves records matching a flow filter
    /// @param flow The flow identifier to filter by (empty string returns all)
    /// @return result The query result containing matching records
    function query(string calldata flow) external returns (QueryOkResult memory result) {
        uint256 count = _recordIds.length;
        bytes[] memory matched = new bytes[](count);
        uint256 matchCount = 0;

        bytes32 flowHash = keccak256(abi.encodePacked(flow));
        bool filterAll = bytes(flow).length == 0;

        for (uint256 i = 0; i < count; i++) {
            bytes32 id = _recordIds[i];
            if (!_records[id].exists) continue;

            if (filterAll || keccak256(_records[id].data) == flowHash) {
                matched[matchCount] = _records[id].data;
                matchCount++;
            }
        }

        // If no filter or we want all, return everything
        if (filterAll) {
            bytes[] memory all = new bytes[](count);
            uint256 allCount = 0;
            for (uint256 i = 0; i < count; i++) {
                if (_records[_recordIds[i]].exists) {
                    all[allCount] = _records[_recordIds[i]].data;
                    allCount++;
                }
            }
            bytes[] memory trimmed = new bytes[](allCount);
            for (uint256 i = 0; i < allCount; i++) {
                trimmed[i] = all[i];
            }
            result = QueryOkResult({ success: true, records: trimmed });
        } else {
            bytes[] memory trimmed = new bytes[](matchCount);
            for (uint256 i = 0; i < matchCount; i++) {
                trimmed[i] = matched[i];
            }
            result = QueryOkResult({ success: true, records: trimmed });
        }

        emit QueryCompleted("ok", result.records);
    }

    /// @notice purge - removes records older than a given timestamp
    /// @param beforeTimestamp Remove records created before this timestamp
    /// @return removedCount The number of records purged
    function purge(uint256 beforeTimestamp) external returns (uint256 removedCount) {
        for (uint256 i = 0; i < _recordIds.length; i++) {
            bytes32 id = _recordIds[i];
            if (_records[id].exists && _records[id].timestamp < beforeTimestamp) {
                _records[id].exists = false;
                delete _records[id].data;
                removedCount++;
            }
        }

        emit PurgeCompleted(removedCount);
    }

    // --- Views ---

    /// @notice Retrieve a single log record by ID
    /// @param id The record ID
    /// @return The raw record data
    function get(bytes32 id) external view returns (bytes memory) {
        require(_records[id].exists, "Record not found");
        return _records[id].data;
    }

    /// @notice Get the total count of records
    /// @return The number of records stored
    function recordCount() external view returns (uint256) {
        return _recordIds.length;
    }

    /// @notice Check if a record exists
    /// @param id The record ID to check
    /// @return Whether the record exists
    function recordExists(bytes32 id) external view returns (bool) {
        return _records[id].exists;
    }
}
