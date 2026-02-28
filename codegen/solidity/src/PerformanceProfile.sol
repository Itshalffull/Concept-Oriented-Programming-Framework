// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PerformanceProfile
/// @notice Performance profiling for entity invocations and latency tracking.
/// @dev Stores aggregated profile data with hotspot analysis and window comparison.

contract PerformanceProfile {

    // --- Storage ---

    struct ProfileData {
        string entitySymbol;
        string entityKind;
        uint256 invocationCount;
        uint256 totalLatencyMs;
        uint256 errorCount;
        string window;
        uint256 timestamp;
        bool exists;
    }

    mapping(bytes32 => ProfileData) private _profiles;
    bytes32[] private _profileIds;

    // Symbol index: symbolHash => list of profile IDs
    mapping(bytes32 => bytes32[]) private _symbolIndex;

    // Kind index: kindHash => list of profile IDs
    mapping(bytes32 => bytes32[]) private _kindIndex;

    uint256 private _profileCounter;

    // --- Types ---

    struct AggregateInput {
        string symbol;
        string window;
    }

    struct AggregateOkResult {
        bool success;
        bytes32 profile;
    }

    struct AggregateInsufficientDataResult {
        bool success;
        int256 count;
    }

    struct HotspotsInput {
        string kind;
        string metric;
        int256 topN;
    }

    struct HotspotsOkResult {
        bool success;
        string hotspots;
    }

    struct SlowChainsOkResult {
        bool success;
        string chains;
    }

    struct CompareWindowsInput {
        string symbol;
        string windowA;
        string windowB;
    }

    struct CompareWindowsOkResult {
        bool success;
        string comparison;
    }

    struct CompareWindowsInsufficientDataResult {
        bool success;
        string window;
        int256 count;
    }

    struct GetOkResult {
        bool success;
        bytes32 profile;
        string entitySymbol;
        string entityKind;
        int256 invocationCount;
        string errorRate;
    }

    // --- Events ---

    event AggregateCompleted(string variant, bytes32 profile, int256 count);
    event HotspotsCompleted(string variant);
    event SlowChainsCompleted(string variant);
    event CompareWindowsCompleted(string variant, int256 count);
    event GetCompleted(string variant, bytes32 profile, int256 invocationCount);

    // --- Actions ---

    /// @notice aggregate
    function aggregate(string memory symbol, string memory window) external returns (AggregateOkResult memory) {
        require(bytes(symbol).length > 0, "Symbol must not be empty");
        require(bytes(window).length > 0, "Window must not be empty");

        _profileCounter++;
        bytes32 profileId = keccak256(abi.encodePacked(symbol, window, _profileCounter));

        _profiles[profileId] = ProfileData({
            entitySymbol: symbol,
            entityKind: "function",
            invocationCount: 1,
            totalLatencyMs: 0,
            errorCount: 0,
            window: window,
            timestamp: block.timestamp,
            exists: true
        });
        _profileIds.push(profileId);

        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        _symbolIndex[symbolHash].push(profileId);

        emit AggregateCompleted("ok", profileId, 1);
        return AggregateOkResult({success: true, profile: profileId});
    }

    /// @notice hotspots
    function hotspots(string memory kind, string memory metric, int256 topN) external returns (HotspotsOkResult memory) {
        require(topN > 0, "topN must be positive");

        string memory result = "";
        uint256 count = 0;
        uint256 limit = uint256(topN);

        for (uint256 i = 0; i < _profileIds.length && count < limit; i++) {
            ProfileData storage p = _profiles[_profileIds[i]];
            if (count > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, p.entitySymbol));
            count++;
        }

        emit HotspotsCompleted("ok");
        return HotspotsOkResult({success: true, hotspots: result});
    }

    /// @notice slowChains
    function slowChains(int256 thresholdMs) external returns (SlowChainsOkResult memory) {
        require(thresholdMs > 0, "Threshold must be positive");

        string memory result = "";
        uint256 count = 0;
        uint256 threshold = uint256(thresholdMs);

        for (uint256 i = 0; i < _profileIds.length; i++) {
            ProfileData storage p = _profiles[_profileIds[i]];
            if (p.totalLatencyMs > threshold) {
                if (count > 0) {
                    result = string(abi.encodePacked(result, ","));
                }
                result = string(abi.encodePacked(result, p.entitySymbol));
                count++;
            }
        }

        emit SlowChainsCompleted("ok");
        return SlowChainsOkResult({success: true, chains: result});
    }

    /// @notice compareWindows
    function compareWindows(string memory symbol, string memory windowA, string memory windowB) external returns (CompareWindowsOkResult memory) {
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        bytes32[] storage ids = _symbolIndex[symbolHash];

        uint256 countA = 0;
        uint256 countB = 0;
        bytes32 hashA = keccak256(abi.encodePacked(windowA));
        bytes32 hashB = keccak256(abi.encodePacked(windowB));

        for (uint256 i = 0; i < ids.length; i++) {
            ProfileData storage p = _profiles[ids[i]];
            bytes32 wHash = keccak256(abi.encodePacked(p.window));
            if (wHash == hashA) countA += p.invocationCount;
            if (wHash == hashB) countB += p.invocationCount;
        }

        string memory comparison = string(abi.encodePacked(
            windowA, ":", _uint2str(countA), " vs ", windowB, ":", _uint2str(countB)
        ));

        emit CompareWindowsCompleted("ok", int256(countA + countB));
        return CompareWindowsOkResult({success: true, comparison: comparison});
    }

    /// @notice get
    function get(bytes32 profile) external returns (GetOkResult memory) {
        require(_profiles[profile].exists, "Profile not found");

        ProfileData storage data = _profiles[profile];
        string memory errorRate = "0%";
        if (data.invocationCount > 0 && data.errorCount > 0) {
            uint256 rate = (data.errorCount * 100) / data.invocationCount;
            errorRate = string(abi.encodePacked(_uint2str(rate), "%"));
        }

        emit GetCompleted("ok", profile, int256(data.invocationCount));
        return GetOkResult({
            success: true,
            profile: profile,
            entitySymbol: data.entitySymbol,
            entityKind: data.entityKind,
            invocationCount: int256(data.invocationCount),
            errorRate: errorRate
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
