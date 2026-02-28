// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RuntimeCoverage
/// @notice Runtime coverage tracking for symbol and flow execution.
/// @dev Records coverage entries by symbol/kind/flow and generates coverage reports.

contract RuntimeCoverage {

    // --- Storage ---

    struct CoverageEntry {
        string symbol;
        string kind;
        string flowId;
        uint256 hitCount;
        uint256 timestamp;
        bool exists;
    }

    mapping(bytes32 => CoverageEntry) private _entries;
    bytes32[] private _entryIds;

    // Kind index: kindHash => list of entry IDs
    mapping(bytes32 => bytes32[]) private _kindIndex;

    // Symbol index: symbolHash => list of entry IDs
    mapping(bytes32 => bytes32[]) private _symbolIndex;

    // Widget index: widgetHash => list of entry IDs
    mapping(bytes32 => bytes32[]) private _widgetIndex;

    // Track unique symbols per kind for coverage calculations
    mapping(bytes32 => bool) private _symbolKindSeen;

    uint256 private _entryCounter;

    // --- Types ---

    struct RecordInput {
        string symbol;
        string kind;
        string flowId;
    }

    struct RecordOkResult {
        bool success;
        bytes32 entry;
    }

    struct RecordCreatedResult {
        bool success;
        bytes32 entry;
    }

    struct CoverageReportInput {
        string kind;
        string since;
    }

    struct CoverageReportOkResult {
        bool success;
        string report;
    }

    struct VariantCoverageOkResult {
        bool success;
        string report;
    }

    struct SyncCoverageOkResult {
        bool success;
        string report;
    }

    struct WidgetStateCoverageOkResult {
        bool success;
        string report;
    }

    struct WidgetLifecycleReportInput {
        string widget;
        string since;
    }

    struct WidgetLifecycleReportOkResult {
        bool success;
        string report;
    }

    struct WidgetRenderTraceOkResult {
        bool success;
        string renders;
    }

    struct WidgetComparisonInput {
        string since;
        int256 topN;
    }

    struct WidgetComparisonOkResult {
        bool success;
        string ranking;
    }

    struct DeadAtRuntimeOkResult {
        bool success;
        string neverExercised;
    }

    // --- Events ---

    event RecordCompleted(string variant, bytes32 entry);
    event CoverageReportCompleted(string variant);
    event VariantCoverageCompleted(string variant);
    event SyncCoverageCompleted(string variant);
    event WidgetStateCoverageCompleted(string variant);
    event WidgetLifecycleReportCompleted(string variant);
    event WidgetRenderTraceCompleted(string variant);
    event WidgetComparisonCompleted(string variant);
    event DeadAtRuntimeCompleted(string variant);

    // --- Actions ---

    /// @notice record
    function record(string memory symbol, string memory kind, string memory flowId) external returns (RecordOkResult memory) {
        require(bytes(symbol).length > 0, "Symbol must not be empty");
        require(bytes(kind).length > 0, "Kind must not be empty");

        bytes32 entryKey = keccak256(abi.encodePacked(symbol, kind));
        string memory variant;

        if (_entries[entryKey].exists) {
            // Increment existing entry
            _entries[entryKey].hitCount++;
            _entries[entryKey].flowId = flowId;
            _entries[entryKey].timestamp = block.timestamp;
            variant = "ok";
        } else {
            // Create new entry
            _entries[entryKey] = CoverageEntry({
                symbol: symbol,
                kind: kind,
                flowId: flowId,
                hitCount: 1,
                timestamp: block.timestamp,
                exists: true
            });
            _entryIds.push(entryKey);

            bytes32 kindHash = keccak256(abi.encodePacked(kind));
            _kindIndex[kindHash].push(entryKey);

            bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
            _symbolIndex[symbolHash].push(entryKey);

            _symbolKindSeen[entryKey] = true;
            variant = "created";
        }

        emit RecordCompleted(variant, entryKey);
        return RecordOkResult({success: true, entry: entryKey});
    }

    /// @notice coverageReport
    function coverageReport(string memory kind, string memory since) external returns (CoverageReportOkResult memory) {
        bytes32 kindHash = keccak256(abi.encodePacked(kind));
        bytes32[] storage ids = _kindIndex[kindHash];

        uint256 totalHits = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            totalHits += _entries[ids[i]].hitCount;
        }

        string memory report = string(abi.encodePacked(
            "kind:", kind, ",symbols:", _uint2str(ids.length), ",hits:", _uint2str(totalHits)
        ));

        emit CoverageReportCompleted("ok");
        return CoverageReportOkResult({success: true, report: report});
    }

    /// @notice variantCoverage
    function variantCoverage(string memory concept) external returns (VariantCoverageOkResult memory) {
        bytes32 kindHash = keccak256(abi.encodePacked("variant"));
        bytes32[] storage ids = _kindIndex[kindHash];

        uint256 covered = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (_entries[ids[i]].hitCount > 0) covered++;
        }

        string memory report = string(abi.encodePacked(
            "concept:", concept, ",variantsCovered:", _uint2str(covered), ",total:", _uint2str(ids.length)
        ));

        emit VariantCoverageCompleted("ok");
        return VariantCoverageOkResult({success: true, report: report});
    }

    /// @notice syncCoverage
    function syncCoverage(string memory since) external returns (SyncCoverageOkResult memory) {
        bytes32 kindHash = keccak256(abi.encodePacked("sync"));
        bytes32[] storage ids = _kindIndex[kindHash];

        uint256 covered = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (_entries[ids[i]].hitCount > 0) covered++;
        }

        string memory report = string(abi.encodePacked(
            "syncsCovered:", _uint2str(covered), ",total:", _uint2str(ids.length)
        ));

        emit SyncCoverageCompleted("ok");
        return SyncCoverageOkResult({success: true, report: report});
    }

    /// @notice widgetStateCoverage
    function widgetStateCoverage(string memory widget) external returns (WidgetStateCoverageOkResult memory) {
        bytes32 kindHash = keccak256(abi.encodePacked("widgetState"));
        bytes32[] storage ids = _kindIndex[kindHash];

        uint256 covered = 0;
        bytes32 widgetHash = keccak256(abi.encodePacked(widget));
        for (uint256 i = 0; i < ids.length; i++) {
            CoverageEntry storage e = _entries[ids[i]];
            bytes32 symHash = keccak256(abi.encodePacked(e.symbol));
            if (symHash == widgetHash && e.hitCount > 0) covered++;
        }

        string memory report = string(abi.encodePacked(
            "widget:", widget, ",statesCovered:", _uint2str(covered)
        ));

        emit WidgetStateCoverageCompleted("ok");
        return WidgetStateCoverageOkResult({success: true, report: report});
    }

    /// @notice widgetLifecycleReport
    function widgetLifecycleReport(string memory widget, string memory since) external returns (WidgetLifecycleReportOkResult memory) {
        bytes32 symbolHash = keccak256(abi.encodePacked(widget));
        bytes32[] storage ids = _symbolIndex[symbolHash];

        string memory report = string(abi.encodePacked(
            "widget:", widget, ",events:", _uint2str(ids.length)
        ));

        emit WidgetLifecycleReportCompleted("ok");
        return WidgetLifecycleReportOkResult({success: true, report: report});
    }

    /// @notice widgetRenderTrace
    function widgetRenderTrace(string memory widgetInstance) external returns (WidgetRenderTraceOkResult memory) {
        bytes32 symbolHash = keccak256(abi.encodePacked(widgetInstance));
        bytes32[] storage ids = _symbolIndex[symbolHash];

        string memory renders = "";
        for (uint256 i = 0; i < ids.length; i++) {
            CoverageEntry storage e = _entries[ids[i]];
            if (i > 0) {
                renders = string(abi.encodePacked(renders, ","));
            }
            renders = string(abi.encodePacked(renders, e.kind, ":", _uint2str(e.hitCount)));
        }

        emit WidgetRenderTraceCompleted("ok");
        return WidgetRenderTraceOkResult({success: true, renders: renders});
    }

    /// @notice widgetComparison
    function widgetComparison(string memory since, int256 topN) external returns (WidgetComparisonOkResult memory) {
        require(topN > 0, "topN must be positive");

        string memory ranking = "";
        uint256 count = 0;
        uint256 limit = uint256(topN);

        for (uint256 i = 0; i < _entryIds.length && count < limit; i++) {
            CoverageEntry storage e = _entries[_entryIds[i]];
            if (count > 0) {
                ranking = string(abi.encodePacked(ranking, ","));
            }
            ranking = string(abi.encodePacked(ranking, e.symbol, ":", _uint2str(e.hitCount)));
            count++;
        }

        emit WidgetComparisonCompleted("ok");
        return WidgetComparisonOkResult({success: true, ranking: ranking});
    }

    /// @notice deadAtRuntime
    function deadAtRuntime(string memory kind) external returns (DeadAtRuntimeOkResult memory) {
        bytes32 kindHash = keccak256(abi.encodePacked(kind));
        bytes32[] storage ids = _kindIndex[kindHash];

        string memory result = "";
        uint256 count = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (_entries[ids[i]].hitCount == 0) {
                if (count > 0) {
                    result = string(abi.encodePacked(result, ","));
                }
                result = string(abi.encodePacked(result, _entries[ids[i]].symbol));
                count++;
            }
        }

        // If no dead entries found among tracked, return empty
        emit DeadAtRuntimeCompleted("ok");
        return DeadAtRuntimeOkResult({success: true, neverExercised: result});
    }

    /// @dev Convert uint to string
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
