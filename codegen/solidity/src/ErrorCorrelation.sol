// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ErrorCorrelation
/// @notice Error correlation tracking for runtime flow analysis.
/// @dev Links errors to causes, supports kind-based and entity-based queries, and hotspot analysis.

contract ErrorCorrelation {

    // --- Storage ---

    struct ErrorData {
        string flowId;
        string errorKind;
        string message;
        string rawEvent;
        uint256 timestamp;
        bool exists;
    }

    mapping(bytes32 => ErrorData) private _errors;
    bytes32[] private _errorIds;

    // Kind index: kindHash => list of error IDs
    mapping(bytes32 => bytes32[]) private _kindIndex;

    // Flow index: flowHash => list of error IDs
    mapping(bytes32 => bytes32[]) private _flowIndex;

    uint256 private _errorCounter;

    // --- Types ---

    struct RecordInput {
        string flowId;
        string errorKind;
        string message;
        string rawEvent;
    }

    struct RecordOkResult {
        bool success;
        bytes32 error;
    }

    struct FindByEntityInput {
        string symbol;
        string since;
    }

    struct FindByEntityOkResult {
        bool success;
        string errors;
    }

    struct FindByKindInput {
        string errorKind;
        string since;
    }

    struct FindByKindOkResult {
        bool success;
        string errors;
    }

    struct ErrorHotspotsInput {
        string since;
        int256 topN;
    }

    struct ErrorHotspotsOkResult {
        bool success;
        string hotspots;
    }

    struct RootCauseOkResult {
        bool success;
        string chain;
        string likelyCause;
        string source;
    }

    struct RootCauseInconclusiveResult {
        bool success;
        string partialChain;
    }

    struct GetOkResult {
        bool success;
        bytes32 error;
        string flowId;
        string errorKind;
        string errorMessage;
        string timestamp;
    }

    // --- Events ---

    event RecordCompleted(string variant, bytes32 error);
    event FindByEntityCompleted(string variant);
    event FindByKindCompleted(string variant);
    event ErrorHotspotsCompleted(string variant);
    event RootCauseCompleted(string variant);
    event GetCompleted(string variant, bytes32 error);

    // --- Actions ---

    /// @notice record
    function record(string memory flowId, string memory errorKind, string memory message, string memory rawEvent) external returns (RecordOkResult memory) {
        require(bytes(flowId).length > 0, "Flow ID must not be empty");
        require(bytes(errorKind).length > 0, "Error kind must not be empty");

        _errorCounter++;
        bytes32 errorId = keccak256(abi.encodePacked(flowId, errorKind, message, _errorCounter));

        _errors[errorId] = ErrorData({
            flowId: flowId,
            errorKind: errorKind,
            message: message,
            rawEvent: rawEvent,
            timestamp: block.timestamp,
            exists: true
        });
        _errorIds.push(errorId);

        bytes32 kindHash = keccak256(abi.encodePacked(errorKind));
        _kindIndex[kindHash].push(errorId);

        bytes32 flowHash = keccak256(abi.encodePacked(flowId));
        _flowIndex[flowHash].push(errorId);

        emit RecordCompleted("ok", errorId);
        return RecordOkResult({success: true, error: errorId});
    }

    /// @notice findByEntity
    function findByEntity(string memory symbol, string memory since) external returns (FindByEntityOkResult memory) {
        // Search all errors whose flowId or message references the symbol
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));

        string memory result = "";
        uint256 count = 0;
        for (uint256 i = 0; i < _errorIds.length; i++) {
            ErrorData storage e = _errors[_errorIds[i]];
            bytes32 flowHash = keccak256(abi.encodePacked(e.flowId));
            if (flowHash == symbolHash) {
                if (count > 0) {
                    result = string(abi.encodePacked(result, ","));
                }
                result = string(abi.encodePacked(result, e.errorKind, ":", e.message));
                count++;
            }
        }

        emit FindByEntityCompleted("ok");
        return FindByEntityOkResult({success: true, errors: result});
    }

    /// @notice findByKind
    function findByKind(string memory errorKind, string memory since) external returns (FindByKindOkResult memory) {
        bytes32 kindHash = keccak256(abi.encodePacked(errorKind));
        bytes32[] storage ids = _kindIndex[kindHash];

        string memory result = "";
        for (uint256 i = 0; i < ids.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            ErrorData storage e = _errors[ids[i]];
            result = string(abi.encodePacked(result, e.flowId, ":", e.message));
        }

        emit FindByKindCompleted("ok");
        return FindByKindOkResult({success: true, errors: result});
    }

    /// @notice errorHotspots
    function errorHotspots(string memory since, int256 topN) external returns (ErrorHotspotsOkResult memory) {
        require(topN > 0, "topN must be positive");

        // Return all error kinds as hotspot summary
        string memory result = "";
        uint256 count = 0;
        uint256 limit = uint256(topN);
        for (uint256 i = 0; i < _errorIds.length && count < limit; i++) {
            ErrorData storage e = _errors[_errorIds[i]];
            if (count > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, e.errorKind));
            count++;
        }

        emit ErrorHotspotsCompleted("ok");
        return ErrorHotspotsOkResult({success: true, hotspots: result});
    }

    /// @notice rootCause
    function rootCause(bytes32 error) external returns (RootCauseOkResult memory) {
        require(_errors[error].exists, "Error not found");

        ErrorData storage e = _errors[error];

        // Trace back through the flow to find the earliest error as likely root cause
        bytes32 flowHash = keccak256(abi.encodePacked(e.flowId));
        bytes32[] storage flowErrors = _flowIndex[flowHash];

        string memory chain = "";
        string memory likelyCause = e.message;
        string memory source = e.flowId;

        for (uint256 i = 0; i < flowErrors.length; i++) {
            if (i > 0) {
                chain = string(abi.encodePacked(chain, " -> "));
            }
            chain = string(abi.encodePacked(chain, _errors[flowErrors[i]].errorKind));
            // The earliest error in the flow is the likely root cause
            if (i == 0) {
                likelyCause = _errors[flowErrors[i]].message;
                source = _errors[flowErrors[i]].flowId;
            }
        }

        emit RootCauseCompleted("ok");
        return RootCauseOkResult({
            success: true,
            chain: chain,
            likelyCause: likelyCause,
            source: source
        });
    }

    /// @notice get
    function get(bytes32 error) external returns (GetOkResult memory) {
        require(_errors[error].exists, "Error not found");

        ErrorData storage data = _errors[error];

        emit GetCompleted("ok", error);
        return GetOkResult({
            success: true,
            error: error,
            flowId: data.flowId,
            errorKind: data.errorKind,
            errorMessage: data.message,
            timestamp: _uint2str(data.timestamp)
        });
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
