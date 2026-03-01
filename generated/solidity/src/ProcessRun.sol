// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ProcessRun
/// @notice Manages process execution runs with full lifecycle status transitions.
/// @dev Supports parent-child run hierarchies and suspend/resume.

contract ProcessRun {

    // --- Types ---

    enum Status { Pending, Running, Completed, Failed, Cancelled, Suspended }

    struct RunData {
        bytes32 runId;
        bytes32 specRef;
        bytes32 parentRunId;
        Status status;
        uint256 startedAt;
        uint256 completedAt;
        bool exists;
    }

    struct RunView {
        bytes32 runId;
        bytes32 specRef;
        bytes32 parentRunId;
        Status status;
        uint256 startedAt;
        uint256 completedAt;
    }

    // --- Storage ---

    mapping(bytes32 => RunData) private runs;
    mapping(bytes32 => bytes32[]) private childRuns;
    bytes32[] private allRunIds;

    // --- Events ---

    event StartRunCompleted(bytes32 indexed runId, bytes32 indexed specRef);
    event StartChildCompleted(bytes32 indexed childRunId, bytes32 indexed parentRunId);
    event CompleteRunCompleted(bytes32 indexed runId);
    event FailRunCompleted(bytes32 indexed runId);
    event CancelRunCompleted(bytes32 indexed runId);
    event SuspendRunCompleted(bytes32 indexed runId);
    event ResumeRunCompleted(bytes32 indexed runId);

    // --- Actions ---

    /// @notice Start a new process run
    function startRun(bytes32 runId, bytes32 specRef) external {
        require(!runs[runId].exists, "ProcessRun: run already exists");

        runs[runId] = RunData({
            runId: runId,
            specRef: specRef,
            parentRunId: bytes32(0),
            status: Status.Running,
            startedAt: block.timestamp,
            completedAt: 0,
            exists: true
        });

        allRunIds.push(runId);

        emit StartRunCompleted(runId, specRef);
    }

    /// @notice Start a child run linked to a parent
    function startChild(bytes32 childRunId, bytes32 parentRunId, bytes32 specRef) external {
        require(!runs[childRunId].exists, "ProcessRun: child run already exists");
        require(runs[parentRunId].exists, "ProcessRun: parent run not found");
        require(runs[parentRunId].status == Status.Running, "ProcessRun: parent must be Running");

        runs[childRunId] = RunData({
            runId: childRunId,
            specRef: specRef,
            parentRunId: parentRunId,
            status: Status.Running,
            startedAt: block.timestamp,
            completedAt: 0,
            exists: true
        });

        childRuns[parentRunId].push(childRunId);
        allRunIds.push(childRunId);

        emit StartChildCompleted(childRunId, parentRunId);
    }

    /// @notice Complete a running process run
    function completeRun(bytes32 runId) external {
        RunData storage run = runs[runId];
        require(run.exists, "ProcessRun: not found");
        require(run.status == Status.Running, "ProcessRun: must be Running to complete");

        run.status = Status.Completed;
        run.completedAt = block.timestamp;

        emit CompleteRunCompleted(runId);
    }

    /// @notice Mark a running process run as failed
    function failRun(bytes32 runId) external {
        RunData storage run = runs[runId];
        require(run.exists, "ProcessRun: not found");
        require(run.status == Status.Running, "ProcessRun: must be Running to fail");

        run.status = Status.Failed;
        run.completedAt = block.timestamp;

        emit FailRunCompleted(runId);
    }

    /// @notice Cancel a pending or running process run
    function cancelRun(bytes32 runId) external {
        RunData storage run = runs[runId];
        require(run.exists, "ProcessRun: not found");
        require(
            run.status == Status.Pending || run.status == Status.Running,
            "ProcessRun: must be Pending or Running to cancel"
        );

        run.status = Status.Cancelled;
        run.completedAt = block.timestamp;

        emit CancelRunCompleted(runId);
    }

    /// @notice Suspend a running process run
    function suspendRun(bytes32 runId) external {
        RunData storage run = runs[runId];
        require(run.exists, "ProcessRun: not found");
        require(run.status == Status.Running, "ProcessRun: must be Running to suspend");

        run.status = Status.Suspended;

        emit SuspendRunCompleted(runId);
    }

    /// @notice Resume a suspended process run
    function resumeRun(bytes32 runId) external {
        RunData storage run = runs[runId];
        require(run.exists, "ProcessRun: not found");
        require(run.status == Status.Suspended, "ProcessRun: must be Suspended to resume");

        run.status = Status.Running;

        emit ResumeRunCompleted(runId);
    }

    /// @notice Get the current status and data of a run
    function getStatus(bytes32 runId) external view returns (RunView memory) {
        RunData storage run = runs[runId];
        require(run.exists, "ProcessRun: not found");

        return RunView({
            runId: run.runId,
            specRef: run.specRef,
            parentRunId: run.parentRunId,
            status: run.status,
            startedAt: run.startedAt,
            completedAt: run.completedAt
        });
    }

    /// @notice Get child run IDs for a parent run
    function getChildRuns(bytes32 parentRunId) external view returns (bytes32[] memory) {
        return childRuns[parentRunId];
    }
}
