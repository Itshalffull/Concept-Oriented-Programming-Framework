// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LocalRuntime
/// @notice Local development runtime — provisions processes and manages local deployments.
contract LocalRuntime {

    // --- Storage ---

    /// @dev process ID => encoded process data
    mapping(bytes32 => bytes) private _processData;

    /// @dev tracks which process IDs exist
    mapping(bytes32 => bool) private _processExists;

    /// @dev ordered list of process IDs
    bytes32[] private _processKeys;

    /// @dev process ID => current command string
    mapping(bytes32 => string) private _currentCommand;

    /// @dev process ID => traffic weight
    mapping(bytes32 => int256) private _trafficWeight;

    /// @dev process ID => PID counter
    mapping(bytes32 => uint256) private _pidCounter;

    // --- Types ---

    struct ProvisionInput {
        string concept;
        string command;
        int256 port;
    }

    struct ProvisionOkResult {
        bool success;
        bytes32 process;
        int256 pid;
        string endpoint;
    }

    struct ProvisionPortInUseResult {
        bool success;
        int256 port;
        int256 existingPid;
    }

    struct DeployInput {
        bytes32 process;
        string command;
    }

    struct DeployOkResult {
        bool success;
        bytes32 process;
        int256 pid;
    }

    struct SetTrafficWeightInput {
        bytes32 process;
        int256 weight;
    }

    struct SetTrafficWeightOkResult {
        bool success;
        bytes32 process;
    }

    struct RollbackInput {
        bytes32 process;
        string previousCommand;
    }

    struct RollbackOkResult {
        bool success;
        bytes32 process;
        int256 pid;
    }

    struct DestroyOkResult {
        bool success;
        bytes32 process;
    }

    // --- Events ---

    event ProvisionCompleted(string variant, bytes32 process, int256 pid, int256 port, int256 existingPid);
    event DeployCompleted(string variant, bytes32 process, int256 pid);
    event SetTrafficWeightCompleted(string variant, bytes32 process);
    event RollbackCompleted(string variant, bytes32 process, int256 pid);
    event DestroyCompleted(string variant, bytes32 process);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "local";
        category = "runtime";
        capabilities = new string[](5);
        capabilities[0] = "provision";
        capabilities[1] = "deploy";
        capabilities[2] = "setTrafficWeight";
        capabilities[3] = "rollback";
        capabilities[4] = "destroy";
    }

    // --- Actions ---

    /// @notice Provision a local development process.
    function provision(string memory concept, string memory command, int256 port) external returns (ProvisionOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(command).length > 0, "Command must not be empty");
        require(port > 0, "Port must be positive");

        bytes32 process = keccak256(abi.encodePacked(concept, port));

        _processData[process] = abi.encode(concept, command, port, block.timestamp);
        if (!_processExists[process]) {
            _processExists[process] = true;
            _processKeys.push(process);
            _pidCounter[process] = 0;
            _trafficWeight[process] = 100;
        }

        _pidCounter[process] += 1;
        int256 pid = int256(_pidCounter[process]);
        _currentCommand[process] = command;

        string memory endpoint = string(abi.encodePacked("http://localhost:", _toStringInt(port)));

        emit ProvisionCompleted("ok", process, pid, port, int256(0));

        return ProvisionOkResult({success: true, process: process, pid: pid, endpoint: endpoint});
    }

    /// @notice Deploy a new command to a local process (restart with new command).
    function deploy(bytes32 process, string memory command) external returns (DeployOkResult memory) {
        require(_processExists[process], "Process not found - provision first");
        require(bytes(command).length > 0, "Command must not be empty");

        _pidCounter[process] += 1;
        int256 pid = int256(_pidCounter[process]);
        _currentCommand[process] = command;

        emit DeployCompleted("ok", process, pid);

        return DeployOkResult({success: true, process: process, pid: pid});
    }

    /// @notice Set the traffic weight for a local process.
    function setTrafficWeight(bytes32 process, int256 weight) external returns (SetTrafficWeightOkResult memory) {
        require(_processExists[process], "Process not found");
        require(weight >= 0 && weight <= 100, "Weight must be 0-100");

        _trafficWeight[process] = weight;

        emit SetTrafficWeightCompleted("ok", process);

        return SetTrafficWeightOkResult({success: true, process: process});
    }

    /// @notice Rollback a local process to a previous command.
    function rollback(bytes32 process, string memory previousCommand) external returns (RollbackOkResult memory) {
        require(_processExists[process], "Process not found");
        require(bytes(previousCommand).length > 0, "Previous command must not be empty");

        _pidCounter[process] += 1;
        int256 pid = int256(_pidCounter[process]);
        _currentCommand[process] = previousCommand;

        emit RollbackCompleted("ok", process, pid);

        return RollbackOkResult({success: true, process: process, pid: pid});
    }

    /// @notice Destroy a local process.
    function destroy(bytes32 process) external returns (DestroyOkResult memory) {
        require(_processExists[process], "Process not found");

        _processExists[process] = false;
        delete _processData[process];
        delete _currentCommand[process];
        delete _trafficWeight[process];

        emit DestroyCompleted("ok", process);

        return DestroyOkResult({success: true, process: process});
    }

    // --- Internal helpers ---

    function _toStringInt(int256 value) internal pure returns (string memory) {
        require(value >= 0, "Negative int not supported");
        return _toString(uint256(value));
    }

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
