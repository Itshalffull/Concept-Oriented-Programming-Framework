// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CloudFormationProvider
/// @notice AWS CloudFormation IaC provider — generates templates and manages stacks.
contract CloudFormationProvider {

    // --- Storage ---

    /// @dev stack ID => encoded stack data
    mapping(bytes32 => bytes) private _stackData;

    /// @dev tracks which stack IDs exist
    mapping(bytes32 => bool) private _stackExists;

    /// @dev ordered list of stack IDs
    bytes32[] private _stackKeys;

    /// @dev stack ID => applied flag
    mapping(bytes32 => bool) private _stackApplied;

    /// @dev stack ID => stack ARN-like ID
    mapping(bytes32 => string) private _stackId;

    // --- Types ---

    struct GenerateOkResult {
        bool success;
        bytes32 stack;
        string[] files;
    }

    struct PreviewOkResult {
        bool success;
        bytes32 stack;
        string changeSetId;
        int256 toCreate;
        int256 toUpdate;
        int256 toDelete;
    }

    struct PreviewChangeSetEmptyResult {
        bool success;
        bytes32 stack;
    }

    struct ApplyOkResult {
        bool success;
        bytes32 stack;
        string stackId;
        string[] created;
        string[] updated;
    }

    struct ApplyRollbackCompleteResult {
        bool success;
        bytes32 stack;
        string reason;
    }

    struct ApplyPartialResult {
        bool success;
        bytes32 stack;
        string[] created;
        string[] failed;
    }

    struct ApplyInsufficientCapabilitiesResult {
        bool success;
        bytes32 stack;
        string[] required;
    }

    struct TeardownOkResult {
        bool success;
        bytes32 stack;
        string[] destroyed;
    }

    struct TeardownDeletionFailedResult {
        bool success;
        bytes32 stack;
        string resource;
        string reason;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes32 stack, string[] files);
    event PreviewCompleted(string variant, bytes32 stack, int256 toCreate, int256 toUpdate, int256 toDelete);
    event ApplyCompleted(string variant, bytes32 stack, string[] created, string[] updated, string[] failed, string[] required);
    event TeardownCompleted(string variant, bytes32 stack, string[] destroyed);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "cloudformation";
        category = "iac";
        capabilities = new string[](4);
        capabilities[0] = "generate";
        capabilities[1] = "preview";
        capabilities[2] = "apply";
        capabilities[3] = "teardown";
    }

    // --- Actions ---

    /// @notice Generate CloudFormation templates from a deployment plan.
    function generate(string memory plan) external returns (GenerateOkResult memory) {
        require(bytes(plan).length > 0, "Plan must not be empty");

        bytes32 stack = keccak256(abi.encodePacked(plan, block.timestamp, msg.sender));

        _stackData[stack] = abi.encode(plan, block.timestamp);
        if (!_stackExists[stack]) {
            _stackExists[stack] = true;
            _stackKeys.push(stack);
        }

        string[] memory files = new string[](2);
        files[0] = "template.yaml";
        files[1] = "parameters.json";

        emit GenerateCompleted("ok", stack, files);

        return GenerateOkResult({success: true, stack: stack, files: files});
    }

    /// @notice Preview the changes a stack would make (create change set).
    function preview(bytes32 stack) external returns (PreviewOkResult memory) {
        require(_stackExists[stack], "Stack not found - generate first");

        string memory changeSetId = string(abi.encodePacked("cs-", _toHexPrefix(stack)));

        emit PreviewCompleted("ok", stack, int256(1), int256(0), int256(0));

        return PreviewOkResult({
            success: true,
            stack: stack,
            changeSetId: changeSetId,
            toCreate: int256(1),
            toUpdate: int256(0),
            toDelete: int256(0)
        });
    }

    /// @notice Apply the CloudFormation stack (execute change set).
    function applyStack(bytes32 stack) external returns (ApplyOkResult memory) {
        require(_stackExists[stack], "Stack not found - generate first");

        _stackApplied[stack] = true;
        string memory sid = string(abi.encodePacked("arn:aws:cloudformation:us-east-1:000000000000:stack/", _toHexPrefix(stack)));
        _stackId[stack] = sid;

        string[] memory created = new string[](1);
        created[0] = "AWS::Lambda::Function";
        string[] memory updated = new string[](0);
        string[] memory empty = new string[](0);

        emit ApplyCompleted("ok", stack, created, updated, empty, empty);

        return ApplyOkResult({success: true, stack: stack, stackId: sid, created: created, updated: updated});
    }

    /// @notice Tear down a CloudFormation stack.
    function teardown(bytes32 stack) external returns (TeardownOkResult memory) {
        require(_stackExists[stack], "Stack not found");

        string[] memory destroyed = new string[](1);
        destroyed[0] = "AWS::Lambda::Function";

        _stackExists[stack] = false;
        delete _stackData[stack];
        delete _stackApplied[stack];
        delete _stackId[stack];

        emit TeardownCompleted("ok", stack, destroyed);

        return TeardownOkResult({success: true, stack: stack, destroyed: destroyed});
    }

    // --- Internal helpers ---

    function _toHexPrefix(bytes32 value) internal pure returns (string memory) {
        bytes memory hex16 = "0123456789abcdef";
        bytes memory result = new bytes(8);
        for (uint256 i = 0; i < 4; i++) {
            result[i * 2] = hex16[uint8(value[i]) >> 4];
            result[i * 2 + 1] = hex16[uint8(value[i]) & 0x0f];
        }
        return string(result);
    }

}
