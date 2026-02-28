// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FlowTrace
/// @notice Flow execution tracing with step recording, completion, and retrieval
/// @dev Implements the FlowTrace concept from Clef specification.
///      Supports building traces from flow IDs, recording individual steps,
///      completing traces, and rendering trace output.

contract FlowTrace {

    // --- Types ---

    struct TraceEntry {
        string flowId;
        bytes tree;
        uint256 stepCount;
        uint256 startTimestamp;
        uint256 endTimestamp;
        bool completed;
        bool exists;
    }

    struct Step {
        string label;
        bytes data;
        uint256 timestamp;
        bool exists;
    }

    struct BuildOkResult {
        bool success;
        bytes32 trace;
        bytes tree;
    }

    struct BuildErrorResult {
        bool success;
        string message;
    }

    struct RenderInput {
        bytes32 trace;
        bytes options;
    }

    struct RenderOkResult {
        bool success;
        string output;
    }

    // --- Storage ---

    /// @dev Maps trace ID to its TraceEntry
    mapping(bytes32 => TraceEntry) private _traces;

    /// @dev Maps trace ID -> step index -> Step
    mapping(bytes32 => mapping(uint256 => Step)) private _steps;

    /// @dev Ordered list of all trace IDs
    bytes32[] private _traceIds;

    /// @dev Nonce for generating unique IDs
    uint256 private _nonce;

    // --- Events ---

    event BuildCompleted(string variant, bytes32 trace, bytes tree);
    event StepRecorded(bytes32 indexed trace, uint256 stepIndex, string label);
    event TraceEnded(bytes32 indexed trace, uint256 totalSteps);
    event RenderCompleted(string variant);

    // --- Actions ---

    /// @notice build - starts a new trace for a flow
    /// @param flowId The flow identifier to trace
    /// @return result The build result with trace ID and initial tree
    function build(string calldata flowId) external returns (BuildOkResult memory result) {
        require(bytes(flowId).length > 0, "Flow ID cannot be empty");

        bytes32 traceId = keccak256(abi.encodePacked(flowId, block.timestamp, _nonce));
        _nonce++;

        bytes memory tree = abi.encode(flowId, block.timestamp);

        _traces[traceId] = TraceEntry({
            flowId: flowId,
            tree: tree,
            stepCount: 0,
            startTimestamp: block.timestamp,
            endTimestamp: 0,
            completed: false,
            exists: true
        });
        _traceIds.push(traceId);

        result = BuildOkResult({ success: true, trace: traceId, tree: tree });

        emit BuildCompleted("ok", traceId, tree);
    }

    /// @notice step - records a step in an active trace
    /// @param traceId The trace to add a step to
    /// @param label The human-readable label for the step
    /// @param data Serialised step data
    /// @return stepIndex The index of the recorded step
    function step(bytes32 traceId, string calldata label, bytes calldata data) external returns (uint256 stepIndex) {
        require(_traces[traceId].exists, "Trace not found");
        require(!_traces[traceId].completed, "Trace already completed");

        stepIndex = _traces[traceId].stepCount;

        _steps[traceId][stepIndex] = Step({
            label: label,
            data: data,
            timestamp: block.timestamp,
            exists: true
        });

        _traces[traceId].stepCount = stepIndex + 1;

        // Update the tree with new step data
        _traces[traceId].tree = abi.encode(
            _traces[traceId].flowId,
            _traces[traceId].startTimestamp,
            _traces[traceId].stepCount
        );

        emit StepRecorded(traceId, stepIndex, label);
    }

    /// @notice end - completes an active trace
    /// @param traceId The trace to complete
    function end(bytes32 traceId) external {
        require(_traces[traceId].exists, "Trace not found");
        require(!_traces[traceId].completed, "Trace already completed");

        _traces[traceId].completed = true;
        _traces[traceId].endTimestamp = block.timestamp;

        emit TraceEnded(traceId, _traces[traceId].stepCount);
    }

    /// @notice render - produces a formatted output of a trace
    /// @param traceId The trace to render
    /// @param options Serialised render options
    /// @return result The render result with formatted output
    function render(bytes32 traceId, bytes calldata options) external returns (RenderOkResult memory result) {
        require(_traces[traceId].exists, "Trace not found");

        string memory output = string(abi.encodePacked(
            "Trace: ", _traces[traceId].flowId,
            " | Steps: ", _uint2str(_traces[traceId].stepCount),
            " | Completed: ", _traces[traceId].completed ? "true" : "false"
        ));

        result = RenderOkResult({ success: true, output: output });

        emit RenderCompleted("ok");
    }

    // --- Views ---

    /// @notice get - retrieves the full trace entry
    /// @param traceId The trace ID to look up
    /// @return The TraceEntry struct
    function get(bytes32 traceId) external view returns (TraceEntry memory) {
        require(_traces[traceId].exists, "Trace not found");
        return _traces[traceId];
    }

    /// @notice Retrieve a step from a trace
    /// @param traceId The trace ID
    /// @param index The step index
    /// @return The Step struct
    function getStep(bytes32 traceId, uint256 index) external view returns (Step memory) {
        require(_steps[traceId][index].exists, "Step not found");
        return _steps[traceId][index];
    }

    /// @notice Check if a trace exists
    /// @param traceId The trace ID to check
    /// @return Whether the trace exists
    function traceExists(bytes32 traceId) external view returns (bool) {
        return _traces[traceId].exists;
    }

    // --- Internal ---

    /// @dev Converts a uint256 to its string representation
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
