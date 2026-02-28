// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TerraformProvider
/// @notice Terraform IaC provider — generates HCL configurations and manages workspaces.
contract TerraformProvider {

    // --- Storage ---

    /// @dev workspace ID => encoded workspace data
    mapping(bytes32 => bytes) private _workspaceData;

    /// @dev tracks which workspace IDs exist
    mapping(bytes32 => bool) private _workspaceExists;

    /// @dev ordered list of workspace IDs
    bytes32[] private _workspaceKeys;

    /// @dev workspace ID => applied flag
    mapping(bytes32 => bool) private _workspaceApplied;

    // --- Types ---

    struct GenerateOkResult {
        bool success;
        bytes32 workspace;
        string[] files;
    }

    struct PreviewOkResult {
        bool success;
        bytes32 workspace;
        int256 toCreate;
        int256 toUpdate;
        int256 toDelete;
    }

    struct PreviewStateLockedResult {
        bool success;
        bytes32 workspace;
        string lockId;
        string lockedBy;
    }

    struct PreviewBackendInitRequiredResult {
        bool success;
        bytes32 workspace;
    }

    struct ApplyOkResult {
        bool success;
        bytes32 workspace;
        string[] created;
        string[] updated;
    }

    struct ApplyStateLockedResult {
        bool success;
        bytes32 workspace;
        string lockId;
    }

    struct ApplyPartialResult {
        bool success;
        bytes32 workspace;
        string[] created;
        string[] failed;
    }

    struct TeardownOkResult {
        bool success;
        bytes32 workspace;
        string[] destroyed;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes32 workspace, string[] files);
    event PreviewCompleted(string variant, bytes32 workspace, int256 toCreate, int256 toUpdate, int256 toDelete);
    event ApplyCompleted(string variant, bytes32 workspace, string[] created, string[] updated, string[] failed);
    event TeardownCompleted(string variant, bytes32 workspace, string[] destroyed);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "terraform";
        category = "iac";
        capabilities = new string[](4);
        capabilities[0] = "generate";
        capabilities[1] = "preview";
        capabilities[2] = "apply";
        capabilities[3] = "teardown";
    }

    // --- Actions ---

    /// @notice Generate Terraform HCL files from a deployment plan.
    function generate(string memory plan) external returns (GenerateOkResult memory) {
        require(bytes(plan).length > 0, "Plan must not be empty");

        bytes32 workspace = keccak256(abi.encodePacked(plan, block.timestamp, msg.sender));

        _workspaceData[workspace] = abi.encode(plan, block.timestamp);
        if (!_workspaceExists[workspace]) {
            _workspaceExists[workspace] = true;
            _workspaceKeys.push(workspace);
        }

        string[] memory files = new string[](3);
        files[0] = "main.tf";
        files[1] = "variables.tf";
        files[2] = "outputs.tf";

        emit GenerateCompleted("ok", workspace, files);

        return GenerateOkResult({success: true, workspace: workspace, files: files});
    }

    /// @notice Preview the changes a Terraform workspace would make (plan).
    function preview(bytes32 workspace) external returns (PreviewOkResult memory) {
        require(_workspaceExists[workspace], "Workspace not found - generate first");

        emit PreviewCompleted("ok", workspace, int256(1), int256(0), int256(0));

        return PreviewOkResult({
            success: true,
            workspace: workspace,
            toCreate: int256(1),
            toUpdate: int256(0),
            toDelete: int256(0)
        });
    }

    /// @notice Apply the Terraform workspace (create/update resources).
    function applyChanges(bytes32 workspace) external returns (ApplyOkResult memory) {
        require(_workspaceExists[workspace], "Workspace not found - generate first");

        _workspaceApplied[workspace] = true;

        string[] memory created = new string[](1);
        created[0] = "aws_lambda_function.main";
        string[] memory updated = new string[](0);
        string[] memory empty = new string[](0);

        emit ApplyCompleted("ok", workspace, created, updated, empty);

        return ApplyOkResult({success: true, workspace: workspace, created: created, updated: updated});
    }

    /// @notice Tear down a Terraform workspace (destroy all resources).
    function teardown(bytes32 workspace) external returns (TeardownOkResult memory) {
        require(_workspaceExists[workspace], "Workspace not found");

        string[] memory destroyed = new string[](1);
        destroyed[0] = "aws_lambda_function.main";

        _workspaceExists[workspace] = false;
        delete _workspaceData[workspace];
        delete _workspaceApplied[workspace];

        emit TeardownCompleted("ok", workspace, destroyed);

        return TeardownOkResult({success: true, workspace: workspace, destroyed: destroyed});
    }

}
