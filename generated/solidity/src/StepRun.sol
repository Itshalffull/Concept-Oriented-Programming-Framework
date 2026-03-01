// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title StepRun
/// @notice Tracks individual step execution within a process run.
/// @dev Steps transition: Pending -> Active -> Completed|Failed|Cancelled|Skipped

contract StepRun {

    // --- Types ---

    enum Status { Pending, Active, Completed, Failed, Cancelled, Skipped }

    struct StepRunData {
        bytes32 stepRunId;
        bytes32 runRef;
        bytes32 stepRef;
        Status status;
        uint256 startedAt;
        uint256 completedAt;
        string resultData;
        bool exists;
    }

    struct StepRunView {
        bytes32 stepRunId;
        bytes32 runRef;
        bytes32 stepRef;
        Status status;
        uint256 startedAt;
        uint256 completedAt;
        string resultData;
    }

    // --- Storage ---

    mapping(bytes32 => StepRunData) private stepRuns;
    mapping(bytes32 => bytes32[]) private runSteps;

    // --- Events ---

    event StartStepCompleted(bytes32 indexed stepRunId, bytes32 indexed runRef, bytes32 indexed stepRef);
    event CompleteStepCompleted(bytes32 indexed stepRunId);
    event FailStepCompleted(bytes32 indexed stepRunId);
    event CancelStepCompleted(bytes32 indexed stepRunId);
    event SkipStepCompleted(bytes32 indexed stepRunId);

    // --- Actions ---

    /// @notice Start a step, transitioning from Pending to Active
    function startStep(bytes32 stepRunId, bytes32 runRef, bytes32 stepRef) external {
        require(!stepRuns[stepRunId].exists, "StepRun: already exists");

        stepRuns[stepRunId] = StepRunData({
            stepRunId: stepRunId,
            runRef: runRef,
            stepRef: stepRef,
            status: Status.Active,
            startedAt: block.timestamp,
            completedAt: 0,
            resultData: "",
            exists: true
        });

        runSteps[runRef].push(stepRunId);

        emit StartStepCompleted(stepRunId, runRef, stepRef);
    }

    /// @notice Complete an active step with optional result data
    function completeStep(bytes32 stepRunId, string calldata resultData) external {
        StepRunData storage step = stepRuns[stepRunId];
        require(step.exists, "StepRun: not found");
        require(step.status == Status.Active, "StepRun: must be Active to complete");

        step.status = Status.Completed;
        step.completedAt = block.timestamp;
        step.resultData = resultData;

        emit CompleteStepCompleted(stepRunId);
    }

    /// @notice Mark an active step as failed
    function failStep(bytes32 stepRunId, string calldata resultData) external {
        StepRunData storage step = stepRuns[stepRunId];
        require(step.exists, "StepRun: not found");
        require(step.status == Status.Active, "StepRun: must be Active to fail");

        step.status = Status.Failed;
        step.completedAt = block.timestamp;
        step.resultData = resultData;

        emit FailStepCompleted(stepRunId);
    }

    /// @notice Cancel a pending or active step
    function cancelStep(bytes32 stepRunId) external {
        StepRunData storage step = stepRuns[stepRunId];
        require(step.exists, "StepRun: not found");
        require(
            step.status == Status.Pending || step.status == Status.Active,
            "StepRun: must be Pending or Active to cancel"
        );

        step.status = Status.Cancelled;
        step.completedAt = block.timestamp;

        emit CancelStepCompleted(stepRunId);
    }

    /// @notice Skip a pending step (bypass execution)
    function skipStep(bytes32 stepRunId, bytes32 runRef, bytes32 stepRef) external {
        // If the step doesn't exist yet, create it in Skipped state directly
        if (!stepRuns[stepRunId].exists) {
            stepRuns[stepRunId] = StepRunData({
                stepRunId: stepRunId,
                runRef: runRef,
                stepRef: stepRef,
                status: Status.Skipped,
                startedAt: 0,
                completedAt: block.timestamp,
                resultData: "",
                exists: true
            });
            runSteps[runRef].push(stepRunId);
        } else {
            StepRunData storage step = stepRuns[stepRunId];
            require(step.status == Status.Pending, "StepRun: must be Pending to skip");
            step.status = Status.Skipped;
            step.completedAt = block.timestamp;
        }

        emit SkipStepCompleted(stepRunId);
    }

    /// @notice Retrieve step run data
    function getStep(bytes32 stepRunId) external view returns (StepRunView memory) {
        StepRunData storage step = stepRuns[stepRunId];
        require(step.exists, "StepRun: not found");

        return StepRunView({
            stepRunId: step.stepRunId,
            runRef: step.runRef,
            stepRef: step.stepRef,
            status: step.status,
            startedAt: step.startedAt,
            completedAt: step.completedAt,
            resultData: step.resultData
        });
    }

    /// @notice Get all step run IDs for a given process run
    function getStepsByRun(bytes32 runRef) external view returns (bytes32[] memory) {
        return runSteps[runRef];
    }
}
