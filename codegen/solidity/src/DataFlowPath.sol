// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DataFlowPath
/// @notice Data flow path tracking — trace, retrieve, and query flow paths between sources and sinks
/// @dev Implements the DataFlowPath concept from Clef specification.
///      Supports tracing data flow paths between source and sink symbols,
///      querying paths by configuration key or output target, and retrieving path metadata.

contract DataFlowPath {

    // --- Types ---

    struct TraceInput {
        string source;
        string sink;
    }

    struct TraceOkResult {
        bool success;
        string paths;
    }

    struct TraceFromConfigOkResult {
        bool success;
        string paths;
    }

    struct TraceToOutputOkResult {
        bool success;
        string paths;
    }

    struct GetOkResult {
        bool success;
        bytes32 path;
        string sourceSymbol;
        string sinkSymbol;
        string pathKind;
        int256 stepCount;
    }

    struct PathEntry {
        string sourceSymbol;
        string sinkSymbol;
        string pathKind;
        int256 stepCount;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps path ID to its PathEntry
    mapping(bytes32 => PathEntry) private _paths;

    /// @dev Ordered list of path IDs
    bytes32[] private _pathKeys;

    /// @dev Maps config key hash to list of associated path IDs
    mapping(bytes32 => bytes32[]) private _configPaths;

    /// @dev Maps output target hash to list of associated path IDs
    mapping(bytes32 => bytes32[]) private _outputPaths;

    // --- Events ---

    event TraceCompleted(string variant);
    event TraceFromConfigCompleted(string variant);
    event TraceToOutputCompleted(string variant);
    event GetCompleted(string variant, bytes32 path, int256 stepCount);

    // --- Actions ---

    /// @notice trace — record a data flow path between source and sink
    function trace(string memory source, string memory sink) external returns (TraceOkResult memory) {
        require(bytes(source).length > 0, "Source must not be empty");
        require(bytes(sink).length > 0, "Sink must not be empty");

        bytes32 pathId = keccak256(abi.encodePacked(source, sink, block.timestamp));

        _paths[pathId] = PathEntry({
            sourceSymbol: source,
            sinkSymbol: sink,
            pathKind: "direct",
            stepCount: 1,
            exists: true
        });
        _pathKeys.push(pathId);

        emit TraceCompleted("ok");

        return TraceOkResult({success: true, paths: source});
    }

    /// @notice traceFromConfig — trace flow paths originating from a config key
    function traceFromConfig(string memory configKey) external returns (TraceFromConfigOkResult memory) {
        require(bytes(configKey).length > 0, "Config key must not be empty");

        bytes32 configHash = keccak256(abi.encodePacked(configKey));
        bytes32 pathId = keccak256(abi.encodePacked("config", configKey, block.timestamp));

        _paths[pathId] = PathEntry({
            sourceSymbol: configKey,
            sinkSymbol: "",
            pathKind: "config",
            stepCount: 0,
            exists: true
        });
        _pathKeys.push(pathId);
        _configPaths[configHash].push(pathId);

        emit TraceFromConfigCompleted("ok");

        return TraceFromConfigOkResult({success: true, paths: configKey});
    }

    /// @notice traceToOutput — trace flow paths reaching an output target
    function traceToOutput(string memory output) external returns (TraceToOutputOkResult memory) {
        require(bytes(output).length > 0, "Output must not be empty");

        bytes32 outputHash = keccak256(abi.encodePacked(output));
        bytes32 pathId = keccak256(abi.encodePacked("output", output, block.timestamp));

        _paths[pathId] = PathEntry({
            sourceSymbol: "",
            sinkSymbol: output,
            pathKind: "output",
            stepCount: 0,
            exists: true
        });
        _pathKeys.push(pathId);
        _outputPaths[outputHash].push(pathId);

        emit TraceToOutputCompleted("ok");

        return TraceToOutputOkResult({success: true, paths: output});
    }

    /// @notice get — retrieve a data flow path by ID
    function get(bytes32 path) external returns (GetOkResult memory) {
        require(_paths[path].exists, "Path not found");

        PathEntry storage entry = _paths[path];

        emit GetCompleted("ok", path, entry.stepCount);

        return GetOkResult({
            success: true,
            path: path,
            sourceSymbol: entry.sourceSymbol,
            sinkSymbol: entry.sinkSymbol,
            pathKind: entry.pathKind,
            stepCount: entry.stepCount
        });
    }

}
