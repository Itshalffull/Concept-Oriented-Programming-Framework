// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GenerationPlan
/// @notice Generation run tracking with step recording, completion, and historical reporting.
/// @dev Manages code generation runs through begin/recordStep/complete lifecycle with summary stats.

contract GenerationPlan {

    // --- Storage ---

    struct StepEntry {
        string stepKey;
        string status; // "ok", "cached", "failed", "skipped"
        int256 filesProduced;
        int256 duration;
        bool cached;
    }

    struct RunEntry {
        StepEntry[] steps;
        uint256 startedAt;
        uint256 completedAt;
        bool completed;
        bool exists;
    }

    mapping(bytes32 => RunEntry) private _runs;
    bytes32[] private _runIds;
    mapping(bytes32 => bool) private _runExists;

    bytes32 private _activeRun;
    bool private _hasActiveRun;

    // --- Types ---

    struct BeginOkResult {
        bool success;
        bytes32 run;
    }

    struct RecordStepInput {
        string stepKey;
        string status;
        int256 filesProduced;
        int256 duration;
        bool cached;
    }

    struct CompleteOkResult {
        bool success;
        bytes32 run;
    }

    struct StatusOkResult {
        bool success;
        bytes[] steps;
    }

    struct SummaryOkResult {
        bool success;
        int256 total;
        int256 executed;
        int256 cached;
        int256 failed;
        int256 totalDuration;
        int256 filesProduced;
    }

    struct HistoryOkResult {
        bool success;
        bytes[] runs;
    }

    // --- Events ---

    event BeginCompleted(string variant, bytes32 run);
    event RecordStepCompleted(string variant);
    event CompleteCompleted(string variant, bytes32 run);
    event StatusCompleted(string variant, bytes[] steps);
    event SummaryCompleted(string variant, int256 total, int256 executed, int256 cached, int256 failed, int256 totalDuration, int256 filesProduced);
    event HistoryCompleted(string variant, bytes[] runs);

    // --- Actions ---

    /// @notice begin - Starts a new generation run.
    function begin() external returns (BeginOkResult memory) {
        require(!_hasActiveRun, "A generation run is already active");

        bytes32 runId = keccak256(abi.encodePacked(block.timestamp, msg.sender, _runIds.length));

        RunEntry storage run = _runs[runId];
        run.startedAt = block.timestamp;
        run.completed = false;
        run.exists = true;

        _runExists[runId] = true;
        _runIds.push(runId);

        _activeRun = runId;
        _hasActiveRun = true;

        emit BeginCompleted("ok", runId);

        return BeginOkResult({
            success: true,
            run: runId
        });
    }

    /// @notice recordStep - Logs progress of a generation step in the active run.
    /// @return True if the step was recorded successfully.
    function recordStep(string memory stepKey, string memory stepStatus, int256 filesProduced, int256 duration, bool cached) external returns (bool) {
        require(_hasActiveRun, "No active generation run");

        RunEntry storage run = _runs[_activeRun];
        require(!run.completed, "Active run is already completed");

        run.steps.push(StepEntry({
            stepKey: stepKey,
            status: stepStatus,
            filesProduced: filesProduced,
            duration: duration,
            cached: cached
        }));

        emit RecordStepCompleted("ok");
        return true;
    }

    /// @notice complete - Completes the active generation run.
    function complete() external returns (CompleteOkResult memory) {
        require(_hasActiveRun, "No active generation run");

        RunEntry storage run = _runs[_activeRun];
        require(!run.completed, "Active run is already completed");

        run.completed = true;
        run.completedAt = block.timestamp;

        bytes32 completedRunId = _activeRun;
        _hasActiveRun = false;
        _activeRun = bytes32(0);

        emit CompleteCompleted("ok", completedRunId);

        return CompleteOkResult({
            success: true,
            run: completedRunId
        });
    }

    /// @notice status - Returns the steps recorded in a generation run.
    function status(bytes32 run) external returns (StatusOkResult memory) {
        require(_runExists[run], "Run not found");

        RunEntry storage r = _runs[run];
        bytes[] memory stepData = new bytes[](r.steps.length);

        for (uint256 i = 0; i < r.steps.length; i++) {
            StepEntry storage step = r.steps[i];
            stepData[i] = abi.encode(step.stepKey, step.status, step.filesProduced, step.duration, step.cached);
        }

        emit StatusCompleted("ok", stepData);

        return StatusOkResult({
            success: true,
            steps: stepData
        });
    }

    /// @notice summary - Returns aggregate statistics for a generation run.
    function summary(bytes32 run) external returns (SummaryOkResult memory) {
        require(_runExists[run], "Run not found");

        RunEntry storage r = _runs[run];

        int256 total = int256(r.steps.length);
        int256 executed = 0;
        int256 cachedCount = 0;
        int256 failed = 0;
        int256 totalDuration = 0;
        int256 filesProduced = 0;

        for (uint256 i = 0; i < r.steps.length; i++) {
            StepEntry storage step = r.steps[i];
            totalDuration += step.duration;
            filesProduced += step.filesProduced;

            if (step.cached) {
                cachedCount++;
            } else if (keccak256(bytes(step.status)) == keccak256(bytes("failed"))) {
                failed++;
            } else {
                executed++;
            }
        }

        emit SummaryCompleted("ok", total, executed, cachedCount, failed, totalDuration, filesProduced);

        return SummaryOkResult({
            success: true,
            total: total,
            executed: executed,
            cached: cachedCount,
            failed: failed,
            totalDuration: totalDuration,
            filesProduced: filesProduced
        });
    }

    /// @notice history - Returns metadata for recent generation runs.
    function history(int256 limit) external returns (HistoryOkResult memory) {
        uint256 count = _runIds.length;
        uint256 resultCount = limit > 0 && uint256(limit) < count ? uint256(limit) : count;

        bytes[] memory runData = new bytes[](resultCount);

        // Return most recent runs first
        for (uint256 i = 0; i < resultCount; i++) {
            uint256 idx = count - 1 - i;
            bytes32 runId = _runIds[idx];
            RunEntry storage r = _runs[runId];
            runData[i] = abi.encode(runId, r.startedAt, r.completedAt, r.completed, r.steps.length);
        }

        emit HistoryCompleted("ok", runData);

        return HistoryOkResult({
            success: true,
            runs: runData
        });
    }
}
