// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DockerComposeIacProvider
/// @notice Docker Compose IaC provider — generates compose files and manages services.
contract DockerComposeIacProvider {

    // --- Storage ---

    /// @dev compose file ID => encoded compose data
    mapping(bytes32 => bytes) private _composeData;

    /// @dev tracks which compose file IDs exist
    mapping(bytes32 => bool) private _composeExists;

    /// @dev ordered list of compose file IDs
    bytes32[] private _composeKeys;

    /// @dev compose file ID => applied flag
    mapping(bytes32 => bool) private _composeApplied;

    // --- Types ---

    struct GenerateOkResult {
        bool success;
        bytes32 composeFile;
        string[] files;
    }

    struct PreviewOkResult {
        bool success;
        bytes32 composeFile;
        int256 toCreate;
        int256 toUpdate;
        int256 toDelete;
    }

    struct ApplyOkResult {
        bool success;
        bytes32 composeFile;
        string[] created;
        string[] updated;
    }

    struct ApplyPortConflictResult {
        bool success;
        int256 port;
        string existingService;
    }

    struct TeardownOkResult {
        bool success;
        bytes32 composeFile;
        string[] destroyed;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes32 composeFile, string[] files);
    event PreviewCompleted(string variant, bytes32 composeFile, int256 toCreate, int256 toUpdate, int256 toDelete);
    event ApplyCompleted(string variant, bytes32 composeFile, string[] created, string[] updated, int256 port);
    event TeardownCompleted(string variant, bytes32 composeFile, string[] destroyed);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "docker-compose";
        category = "iac";
        capabilities = new string[](4);
        capabilities[0] = "generate";
        capabilities[1] = "preview";
        capabilities[2] = "apply";
        capabilities[3] = "teardown";
    }

    // --- Actions ---

    /// @notice Generate a docker-compose file from a deployment plan.
    function generate(string memory plan) external returns (GenerateOkResult memory) {
        require(bytes(plan).length > 0, "Plan must not be empty");

        bytes32 composeFile = keccak256(abi.encodePacked(plan, block.timestamp, msg.sender));

        _composeData[composeFile] = abi.encode(plan, block.timestamp);
        if (!_composeExists[composeFile]) {
            _composeExists[composeFile] = true;
            _composeKeys.push(composeFile);
        }

        string[] memory files = new string[](1);
        files[0] = "docker-compose.yaml";

        emit GenerateCompleted("ok", composeFile, files);

        return GenerateOkResult({success: true, composeFile: composeFile, files: files});
    }

    /// @notice Preview the changes a compose file would make.
    function preview(bytes32 composeFile) external returns (PreviewOkResult memory) {
        require(_composeExists[composeFile], "Compose file not found - generate first");

        emit PreviewCompleted("ok", composeFile, int256(1), int256(0), int256(0));

        return PreviewOkResult({
            success: true,
            composeFile: composeFile,
            toCreate: int256(1),
            toUpdate: int256(0),
            toDelete: int256(0)
        });
    }

    /// @notice Apply the docker-compose configuration (bring up services).
    function applyConfig(bytes32 composeFile) external returns (ApplyOkResult memory) {
        require(_composeExists[composeFile], "Compose file not found - generate first");

        _composeApplied[composeFile] = true;

        string[] memory created = new string[](1);
        created[0] = "app-service";
        string[] memory updated = new string[](0);

        emit ApplyCompleted("ok", composeFile, created, updated, int256(0));

        return ApplyOkResult({success: true, composeFile: composeFile, created: created, updated: updated});
    }

    /// @notice Tear down docker-compose services.
    function teardown(bytes32 composeFile) external returns (TeardownOkResult memory) {
        require(_composeExists[composeFile], "Compose file not found");

        string[] memory destroyed = new string[](1);
        destroyed[0] = "app-service";

        _composeExists[composeFile] = false;
        delete _composeData[composeFile];
        delete _composeApplied[composeFile];

        emit TeardownCompleted("ok", composeFile, destroyed);

        return TeardownOkResult({success: true, composeFile: composeFile, destroyed: destroyed});
    }

}
