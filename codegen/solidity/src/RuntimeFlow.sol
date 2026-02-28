// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RuntimeFlow
/// @notice Runtime flow tracking for action/sync execution traces.
/// @dev Correlates flow events, supports action/sync/variant queries, and deviation analysis.

contract RuntimeFlow {

    // --- Storage ---

    struct FlowData {
        string flowId;
        string status;         // "complete", "partial", "failed"
        uint256 stepCount;
        uint256 deviationCount;
        string unresolvedSteps;
        string actionRef;
        string syncRef;
        string variantRef;
        uint256 timestamp;
        bool exists;
    }

    mapping(bytes32 => FlowData) private _flows;
    bytes32[] private _flowIds;

    // Action index: actionHash => list of flow IDs
    mapping(bytes32 => bytes32[]) private _actionIndex;

    // Sync index: syncHash => list of flow IDs
    mapping(bytes32 => bytes32[]) private _syncIndex;

    // Variant index: variantHash => list of flow IDs
    mapping(bytes32 => bytes32[]) private _variantIndex;

    uint256 private _flowCounter;

    // --- Types ---

    struct CorrelateOkResult {
        bool success;
        bytes32 flow;
    }

    struct CorrelatePartialResult {
        bool success;
        bytes32 flow;
        string unresolved;
    }

    struct FindByActionInput {
        string action;
        string since;
    }

    struct FindByActionOkResult {
        bool success;
        string flows;
    }

    struct FindBySyncInput {
        string sync;
        string since;
    }

    struct FindBySyncOkResult {
        bool success;
        string flows;
    }

    struct FindByVariantInput {
        string variant;
        string since;
    }

    struct FindByVariantOkResult {
        bool success;
        string flows;
    }

    struct FindFailuresOkResult {
        bool success;
        string flows;
    }

    struct CompareToStaticMatchesResult {
        bool success;
        int256 pathLength;
    }

    struct CompareToStaticDeviatesResult {
        bool success;
        string deviations;
    }

    struct SourceLocationsOkResult {
        bool success;
        string locations;
    }

    struct GetOkResult {
        bool success;
        bytes32 flow;
        string flowId;
        string status;
        int256 stepCount;
        int256 deviationCount;
    }

    // --- Events ---

    event CorrelateCompleted(string variant, bytes32 flow);
    event FindByActionCompleted(string variant);
    event FindBySyncCompleted(string variant);
    event FindByVariantCompleted(string variant);
    event FindFailuresCompleted(string variant);
    event CompareToStaticCompleted(string variant, int256 pathLength);
    event SourceLocationsCompleted(string variant);
    event GetCompleted(string variant, bytes32 flow, int256 stepCount, int256 deviationCount);

    // --- Actions ---

    /// @notice correlate
    function correlate(string memory flowId) external returns (CorrelateOkResult memory) {
        require(bytes(flowId).length > 0, "Flow ID must not be empty");

        _flowCounter++;
        bytes32 flowKey = keccak256(abi.encodePacked(flowId, _flowCounter));

        _flows[flowKey] = FlowData({
            flowId: flowId,
            status: "complete",
            stepCount: 0,
            deviationCount: 0,
            unresolvedSteps: "",
            actionRef: "",
            syncRef: "",
            variantRef: "",
            timestamp: block.timestamp,
            exists: true
        });
        _flowIds.push(flowKey);

        emit CorrelateCompleted("ok", flowKey);
        return CorrelateOkResult({success: true, flow: flowKey});
    }

    /// @notice findByAction
    function findByAction(string memory action, string memory since) external returns (FindByActionOkResult memory) {
        bytes32 actionHash = keccak256(abi.encodePacked(action));
        bytes32[] storage ids = _actionIndex[actionHash];

        string memory result = "";
        for (uint256 i = 0; i < ids.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _flows[ids[i]].flowId));
        }

        emit FindByActionCompleted("ok");
        return FindByActionOkResult({success: true, flows: result});
    }

    /// @notice findBySync
    function findBySync(string memory sync, string memory since) external returns (FindBySyncOkResult memory) {
        bytes32 syncHash = keccak256(abi.encodePacked(sync));
        bytes32[] storage ids = _syncIndex[syncHash];

        string memory result = "";
        for (uint256 i = 0; i < ids.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _flows[ids[i]].flowId));
        }

        emit FindBySyncCompleted("ok");
        return FindBySyncOkResult({success: true, flows: result});
    }

    /// @notice findByVariant
    function findByVariant(string memory variant, string memory since) external returns (FindByVariantOkResult memory) {
        bytes32 variantHash = keccak256(abi.encodePacked(variant));
        bytes32[] storage ids = _variantIndex[variantHash];

        string memory result = "";
        for (uint256 i = 0; i < ids.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _flows[ids[i]].flowId));
        }

        emit FindByVariantCompleted("ok");
        return FindByVariantOkResult({success: true, flows: result});
    }

    /// @notice findFailures
    function findFailures(string memory since) external returns (FindFailuresOkResult memory) {
        bytes32 failedHash = keccak256(abi.encodePacked("failed"));

        string memory result = "";
        uint256 count = 0;
        for (uint256 i = 0; i < _flowIds.length; i++) {
            FlowData storage f = _flows[_flowIds[i]];
            bytes32 statusHash = keccak256(abi.encodePacked(f.status));
            if (statusHash == failedHash) {
                if (count > 0) {
                    result = string(abi.encodePacked(result, ","));
                }
                result = string(abi.encodePacked(result, f.flowId));
                count++;
            }
        }

        emit FindFailuresCompleted("ok");
        return FindFailuresOkResult({success: true, flows: result});
    }

    /// @notice compareToStatic
    function compareToStatic(bytes32 flow) external returns (bool) {
        require(_flows[flow].exists, "Flow not found");

        FlowData storage f = _flows[flow];
        bool matches = f.deviationCount == 0;

        emit CompareToStaticCompleted(
            matches ? "matches" : "deviates",
            int256(f.stepCount)
        );
        return matches;
    }

    /// @notice sourceLocations
    function sourceLocations(bytes32 flow) external returns (SourceLocationsOkResult memory) {
        require(_flows[flow].exists, "Flow not found");

        emit SourceLocationsCompleted("ok");
        return SourceLocationsOkResult({success: true, locations: ""});
    }

    /// @notice get
    function get(bytes32 flow) external returns (GetOkResult memory) {
        require(_flows[flow].exists, "Flow not found");

        FlowData storage data = _flows[flow];

        emit GetCompleted("ok", flow, int256(data.stepCount), int256(data.deviationCount));
        return GetOkResult({
            success: true,
            flow: flow,
            flowId: data.flowId,
            status: data.status,
            stepCount: int256(data.stepCount),
            deviationCount: int256(data.deviationCount)
        });
    }

}
