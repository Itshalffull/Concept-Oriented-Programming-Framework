// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CloudflareRuntime
/// @notice Cloudflare Workers runtime — provisions workers and manages deployments.
contract CloudflareRuntime {

    // --- Storage ---

    /// @dev worker ID => encoded worker data
    mapping(bytes32 => bytes) private _workerData;

    /// @dev tracks which worker IDs exist
    mapping(bytes32 => bool) private _workerExists;

    /// @dev ordered list of worker IDs
    bytes32[] private _workerKeys;

    /// @dev worker ID => current version string
    mapping(bytes32 => string) private _currentVersion;

    /// @dev worker ID => traffic weight
    mapping(bytes32 => int256) private _trafficWeight;

    /// @dev worker ID => version counter
    mapping(bytes32 => uint256) private _versionCounter;

    // --- Types ---

    struct ProvisionInput {
        string concept;
        string accountId;
        string[] routes;
    }

    struct ProvisionOkResult {
        bool success;
        bytes32 worker;
        string scriptName;
        string endpoint;
    }

    struct ProvisionRouteConflictResult {
        bool success;
        string route;
        string existingWorker;
    }

    struct DeployInput {
        bytes32 worker;
        string scriptContent;
    }

    struct DeployOkResult {
        bool success;
        bytes32 worker;
        string version;
    }

    struct DeployScriptTooLargeResult {
        bool success;
        bytes32 worker;
        int256 sizeBytes;
        int256 limitBytes;
    }

    struct SetTrafficWeightInput {
        bytes32 worker;
        int256 weight;
    }

    struct SetTrafficWeightOkResult {
        bool success;
        bytes32 worker;
    }

    struct RollbackInput {
        bytes32 worker;
        string targetVersion;
    }

    struct RollbackOkResult {
        bool success;
        bytes32 worker;
        string restoredVersion;
    }

    struct DestroyOkResult {
        bool success;
        bytes32 worker;
    }

    // --- Events ---

    event ProvisionCompleted(string variant, bytes32 worker);
    event DeployCompleted(string variant, bytes32 worker, int256 sizeBytes, int256 limitBytes);
    event SetTrafficWeightCompleted(string variant, bytes32 worker);
    event RollbackCompleted(string variant, bytes32 worker);
    event DestroyCompleted(string variant, bytes32 worker);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "cloudflare";
        category = "runtime";
        capabilities = new string[](5);
        capabilities[0] = "provision";
        capabilities[1] = "deploy";
        capabilities[2] = "setTrafficWeight";
        capabilities[3] = "rollback";
        capabilities[4] = "destroy";
    }

    // --- Actions ---

    /// @notice Provision a Cloudflare Worker.
    function provision(string memory concept, string memory accountId, string[] memory routes) external returns (ProvisionOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(accountId).length > 0, "Account ID must not be empty");

        bytes32 worker = keccak256(abi.encodePacked(concept, accountId));

        _workerData[worker] = abi.encode(concept, accountId, routes, block.timestamp);
        if (!_workerExists[worker]) {
            _workerExists[worker] = true;
            _workerKeys.push(worker);
            _versionCounter[worker] = 0;
            _trafficWeight[worker] = 100;
        }

        string memory scriptName = string(abi.encodePacked(concept, "-worker"));
        string memory endpoint = string(abi.encodePacked("https://", concept, ".workers.dev"));

        emit ProvisionCompleted("ok", worker);

        return ProvisionOkResult({success: true, worker: worker, scriptName: scriptName, endpoint: endpoint});
    }

    /// @notice Deploy a new version of a Cloudflare Worker.
    function deploy(bytes32 worker, string memory scriptContent) external returns (DeployOkResult memory) {
        require(_workerExists[worker], "Worker not found - provision first");
        require(bytes(scriptContent).length > 0, "Script content must not be empty");

        _versionCounter[worker] += 1;
        string memory version = string(abi.encodePacked("v", _toString(_versionCounter[worker])));
        _currentVersion[worker] = version;
        _workerData[worker] = abi.encode(scriptContent, version, block.timestamp);

        emit DeployCompleted("ok", worker, int256(bytes(scriptContent).length), int256(1048576));

        return DeployOkResult({success: true, worker: worker, version: version});
    }

    /// @notice Set the traffic weight for a Cloudflare Worker.
    function setTrafficWeight(bytes32 worker, int256 weight) external returns (SetTrafficWeightOkResult memory) {
        require(_workerExists[worker], "Worker not found");
        require(weight >= 0 && weight <= 100, "Weight must be 0-100");

        _trafficWeight[worker] = weight;

        emit SetTrafficWeightCompleted("ok", worker);

        return SetTrafficWeightOkResult({success: true, worker: worker});
    }

    /// @notice Rollback a Cloudflare Worker to a target version.
    function rollback(bytes32 worker, string memory targetVersion) external returns (RollbackOkResult memory) {
        require(_workerExists[worker], "Worker not found");
        require(bytes(targetVersion).length > 0, "Target version must not be empty");

        _currentVersion[worker] = targetVersion;

        emit RollbackCompleted("ok", worker);

        return RollbackOkResult({success: true, worker: worker, restoredVersion: targetVersion});
    }

    /// @notice Destroy a Cloudflare Worker.
    function destroy(bytes32 worker) external returns (DestroyOkResult memory) {
        require(_workerExists[worker], "Worker not found");

        _workerExists[worker] = false;
        delete _workerData[worker];
        delete _currentVersion[worker];
        delete _trafficWeight[worker];

        emit DestroyCompleted("ok", worker);

        return DestroyOkResult({success: true, worker: worker});
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
