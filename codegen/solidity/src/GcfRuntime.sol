// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GcfRuntime
/// @notice Google Cloud Functions runtime — provisions functions and manages deployments.
contract GcfRuntime {

    // --- Storage ---

    /// @dev function ID => encoded function data
    mapping(bytes32 => bytes) private _fnData;

    /// @dev tracks which function IDs exist
    mapping(bytes32 => bool) private _fnExists;

    /// @dev ordered list of function IDs
    bytes32[] private _fnKeys;

    /// @dev function ID => current version string
    mapping(bytes32 => string) private _currentVersion;

    /// @dev function ID => traffic weight
    mapping(bytes32 => int256) private _trafficWeight;

    /// @dev function ID => version counter
    mapping(bytes32 => uint256) private _versionCounter;

    // --- Types ---

    struct ProvisionInput {
        string concept;
        string projectId;
        string region;
        string runtime;
        string triggerType;
    }

    struct ProvisionOkResult {
        bool success;
        bytes32 fnId;
        string endpoint;
    }

    struct ProvisionGen2RequiredResult {
        bool success;
        string concept;
        string reason;
    }

    struct ProvisionTriggerConflictResult {
        bool success;
        string triggerType;
        string existing;
    }

    struct DeployInput {
        bytes32 fnId;
        string sourceArchive;
    }

    struct DeployOkResult {
        bool success;
        bytes32 fnId;
        string version;
    }

    struct DeployBuildFailedResult {
        bool success;
        bytes32 fnId;
        string[] errors;
    }

    struct SetTrafficWeightInput {
        bytes32 fnId;
        int256 weight;
    }

    struct SetTrafficWeightOkResult {
        bool success;
        bytes32 fnId;
    }

    struct RollbackInput {
        bytes32 fnId;
        string targetVersion;
    }

    struct RollbackOkResult {
        bool success;
        bytes32 fnId;
        string restoredVersion;
    }

    struct DestroyOkResult {
        bool success;
        bytes32 fnId;
    }

    // --- Events ---

    event ProvisionCompleted(string variant, bytes32 fnId);
    event DeployCompleted(string variant, bytes32 fnId, string[] errors);
    event SetTrafficWeightCompleted(string variant, bytes32 fnId);
    event RollbackCompleted(string variant, bytes32 fnId);
    event DestroyCompleted(string variant, bytes32 fnId);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "gcf";
        category = "runtime";
        capabilities = new string[](5);
        capabilities[0] = "provision";
        capabilities[1] = "deploy";
        capabilities[2] = "setTrafficWeight";
        capabilities[3] = "rollback";
        capabilities[4] = "destroy";
    }

    // --- Actions ---

    /// @notice Provision a Google Cloud Function.
    function provision(string memory concept, string memory projectId, string memory region, string memory runtime, string memory triggerType) external returns (ProvisionOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(projectId).length > 0, "Project ID must not be empty");

        bytes32 fnId = keccak256(abi.encodePacked(concept, projectId, region));

        _fnData[fnId] = abi.encode(concept, projectId, region, runtime, triggerType, block.timestamp);
        if (!_fnExists[fnId]) {
            _fnExists[fnId] = true;
            _fnKeys.push(fnId);
            _versionCounter[fnId] = 0;
            _trafficWeight[fnId] = 100;
        }

        string memory endpoint = string(abi.encodePacked("https://", region, "-", projectId, ".cloudfunctions.net/", concept));

        emit ProvisionCompleted("ok", fnId);

        return ProvisionOkResult({success: true, fnId: fnId, endpoint: endpoint});
    }

    /// @notice Deploy a new version of a Google Cloud Function.
    function deploy(bytes32 fnId, string memory sourceArchive) external returns (DeployOkResult memory) {
        require(_fnExists[fnId], "Function not found - provision first");
        require(bytes(sourceArchive).length > 0, "Source archive must not be empty");

        _versionCounter[fnId] += 1;
        string memory version = string(abi.encodePacked("v", _toString(_versionCounter[fnId])));
        _currentVersion[fnId] = version;
        _fnData[fnId] = abi.encode(sourceArchive, version, block.timestamp);

        string[] memory empty = new string[](0);

        emit DeployCompleted("ok", fnId, empty);

        return DeployOkResult({success: true, fnId: fnId, version: version});
    }

    /// @notice Set the traffic weight for a Google Cloud Function.
    function setTrafficWeight(bytes32 fnId, int256 weight) external returns (SetTrafficWeightOkResult memory) {
        require(_fnExists[fnId], "Function not found");
        require(weight >= 0 && weight <= 100, "Weight must be 0-100");

        _trafficWeight[fnId] = weight;

        emit SetTrafficWeightCompleted("ok", fnId);

        return SetTrafficWeightOkResult({success: true, fnId: fnId});
    }

    /// @notice Rollback a Google Cloud Function to a target version.
    function rollback(bytes32 fnId, string memory targetVersion) external returns (RollbackOkResult memory) {
        require(_fnExists[fnId], "Function not found");
        require(bytes(targetVersion).length > 0, "Target version must not be empty");

        _currentVersion[fnId] = targetVersion;

        emit RollbackCompleted("ok", fnId);

        return RollbackOkResult({success: true, fnId: fnId, restoredVersion: targetVersion});
    }

    /// @notice Destroy a Google Cloud Function.
    function destroy(bytes32 fnId) external returns (DestroyOkResult memory) {
        require(_fnExists[fnId], "Function not found");

        _fnExists[fnId] = false;
        delete _fnData[fnId];
        delete _currentVersion[fnId];
        delete _trafficWeight[fnId];

        emit DestroyCompleted("ok", fnId);

        return DestroyOkResult({success: true, fnId: fnId});
    }

    // --- Internal helpers ---

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

}
