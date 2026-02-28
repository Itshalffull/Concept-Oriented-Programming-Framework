// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ActionGuide
/// @notice Generated from ActionGuide concept specification
/// @dev Manages action documentation workflows with step-based guides

contract ActionGuide {

    // --- Storage ---

    struct WorkflowInfo {
        string concept;
        string[] steps;
        string content;
        uint256 created;
        bool exists;
    }

    mapping(bytes32 => WorkflowInfo) private _workflows;
    bytes32[] private _workflowKeys;
    uint256 private _nonce;

    // --- Types ---

    struct DefineInput {
        string concept;
        string[] steps;
        string content;
    }

    struct DefineOkResult {
        bool success;
        bytes32 workflow;
        int256 stepCount;
    }

    struct DefineInvalidActionResult {
        bool success;
        string action;
    }

    struct RenderInput {
        bytes32 workflow;
        string format;
    }

    struct RenderOkResult {
        bool success;
        string content;
    }

    struct RenderUnknownFormatResult {
        bool success;
        string format;
    }

    // --- Events ---

    event DefineCompleted(string variant, bytes32 workflow, int256 stepCount);
    event RenderCompleted(string variant);

    // --- Actions ---

    /// @notice defineGuide (renamed from 'define' to avoid Solidity reserved keyword)
    function defineGuide(string memory concept, string[] memory steps, string memory content) external returns (DefineOkResult memory) {
        require(bytes(concept).length > 0, "Concept name must not be empty");
        require(bytes(content).length > 0, "Content must not be empty");

        bytes32 workflowId = keccak256(abi.encodePacked(concept, block.timestamp, _nonce++));

        string[] memory stepsCopy = new string[](steps.length);
        for (uint256 i = 0; i < steps.length; i++) {
            stepsCopy[i] = steps[i];
        }

        _workflows[workflowId] = WorkflowInfo({
            concept: concept,
            steps: stepsCopy,
            content: content,
            created: block.timestamp,
            exists: true
        });
        _workflowKeys.push(workflowId);

        int256 stepCount = int256(steps.length);

        emit DefineCompleted("ok", workflowId, stepCount);

        return DefineOkResult({
            success: true,
            workflow: workflowId,
            stepCount: stepCount
        });
    }

    /// @notice render
    function render(bytes32 workflow, string memory format) external returns (RenderOkResult memory) {
        require(_workflows[workflow].exists, "Workflow does not exist");
        require(bytes(format).length > 0, "Format must not be empty");

        WorkflowInfo storage info = _workflows[workflow];

        // Build rendered output from the workflow content and format
        string memory rendered = string(abi.encodePacked(
            "# ", info.concept, "\n\n",
            "Format: ", format, "\n\n",
            info.content
        ));

        emit RenderCompleted("ok");

        return RenderOkResult({
            success: true,
            content: rendered
        });
    }

}
