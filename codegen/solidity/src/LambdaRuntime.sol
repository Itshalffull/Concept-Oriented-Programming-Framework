// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LambdaRuntime
/// @notice AWS Lambda runtime — provisions functions and manages deployments.
contract LambdaRuntime {

    // --- Storage ---

    /// @dev function ID => encoded function data
    mapping(bytes32 => bytes) private _fnData;

    /// @dev tracks which function IDs exist
    mapping(bytes32 => bool) private _fnExists;

    /// @dev ordered list of function IDs
    bytes32[] private _fnKeys;

    /// @dev function ID => current version string
    mapping(bytes32 => string) private _currentVersion;

    /// @dev function ID => traffic weight (alias weight)
    mapping(bytes32 => int256) private _trafficWeight;

    /// @dev function ID => version counter
    mapping(bytes32 => uint256) private _versionCounter;

    // --- Types ---

    struct ProvisionInput {
        string concept;
        int256 memoryMb;
        int256 timeout;
        string region;
    }

    struct ProvisionOkResult {
        bool success;
        bytes32 fnId;
        string functionArn;
        string endpoint;
    }

    struct ProvisionQuotaExceededResult {
        bool success;
        string region;
        string limit;
    }

    struct ProvisionIamErrorResult {
        bool success;
        string policy;
        string reason;
    }

    struct DeployInput {
        bytes32 fnId;
        string artifactLocation;
    }

    struct DeployOkResult {
        bool success;
        bytes32 fnId;
        string version;
    }

    struct DeployPackageTooLargeResult {
        bool success;
        bytes32 fnId;
        int256 sizeBytes;
        int256 limitBytes;
    }

    struct DeployRuntimeUnsupportedResult {
        bool success;
        bytes32 fnId;
        string runtime;
    }

    struct SetTrafficWeightInput {
        bytes32 fnId;
        int256 aliasWeight;
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

    struct DestroyResourceInUseResult {
        bool success;
        bytes32 fnId;
        string[] dependents;
    }

    // --- Events ---

    event ProvisionCompleted(string variant, bytes32 fnId);
    event DeployCompleted(string variant, bytes32 fnId, int256 sizeBytes, int256 limitBytes);
    event SetTrafficWeightCompleted(string variant, bytes32 fnId);
    event RollbackCompleted(string variant, bytes32 fnId);
    event DestroyCompleted(string variant, bytes32 fnId, string[] dependents);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "lambda";
        category = "runtime";
        capabilities = new string[](5);
        capabilities[0] = "provision";
        capabilities[1] = "deploy";
        capabilities[2] = "setTrafficWeight";
        capabilities[3] = "rollback";
        capabilities[4] = "destroy";
    }

    // --- Actions ---

    /// @notice Provision an AWS Lambda function.
    function provision(string memory concept, int256 memoryMb, int256 timeout, string memory region) external returns (ProvisionOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(region).length > 0, "Region must not be empty");
        require(memoryMb > 0, "Memory must be positive");
        require(timeout > 0, "Timeout must be positive");

        bytes32 fnId = keccak256(abi.encodePacked(concept, region));

        _fnData[fnId] = abi.encode(concept, memoryMb, timeout, region, block.timestamp);
        if (!_fnExists[fnId]) {
            _fnExists[fnId] = true;
            _fnKeys.push(fnId);
            _versionCounter[fnId] = 0;
            _trafficWeight[fnId] = 100;
        }

        string memory functionArn = string(abi.encodePacked("arn:aws:lambda:", region, ":000000000000:function:", concept));
        string memory endpoint = string(abi.encodePacked("https://", concept, ".lambda-url.", region, ".on.aws"));

        emit ProvisionCompleted("ok", fnId);

        return ProvisionOkResult({success: true, fnId: fnId, functionArn: functionArn, endpoint: endpoint});
    }

    /// @notice Deploy a new version of an AWS Lambda function.
    function deploy(bytes32 fnId, string memory artifactLocation) external returns (DeployOkResult memory) {
        require(_fnExists[fnId], "Function not found - provision first");
        require(bytes(artifactLocation).length > 0, "Artifact location must not be empty");

        _versionCounter[fnId] += 1;
        string memory version = string(abi.encodePacked("v", _toString(_versionCounter[fnId])));
        _currentVersion[fnId] = version;
        _fnData[fnId] = abi.encode(artifactLocation, version, block.timestamp);

        emit DeployCompleted("ok", fnId, int256(0), int256(262144000));

        return DeployOkResult({success: true, fnId: fnId, version: version});
    }

    /// @notice Set the traffic weight (alias weight) for a Lambda function.
    function setTrafficWeight(bytes32 fnId, int256 aliasWeight) external returns (SetTrafficWeightOkResult memory) {
        require(_fnExists[fnId], "Function not found");
        require(aliasWeight >= 0 && aliasWeight <= 100, "Alias weight must be 0-100");

        _trafficWeight[fnId] = aliasWeight;

        emit SetTrafficWeightCompleted("ok", fnId);

        return SetTrafficWeightOkResult({success: true, fnId: fnId});
    }

    /// @notice Rollback a Lambda function to a target version.
    function rollback(bytes32 fnId, string memory targetVersion) external returns (RollbackOkResult memory) {
        require(_fnExists[fnId], "Function not found");
        require(bytes(targetVersion).length > 0, "Target version must not be empty");

        _currentVersion[fnId] = targetVersion;

        emit RollbackCompleted("ok", fnId);

        return RollbackOkResult({success: true, fnId: fnId, restoredVersion: targetVersion});
    }

    /// @notice Destroy a Lambda function.
    function destroy(bytes32 fnId) external returns (DestroyOkResult memory) {
        require(_fnExists[fnId], "Function not found");

        _fnExists[fnId] = false;
        delete _fnData[fnId];
        delete _currentVersion[fnId];
        delete _trafficWeight[fnId];

        string[] memory empty = new string[](0);

        emit DestroyCompleted("ok", fnId, empty);

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
