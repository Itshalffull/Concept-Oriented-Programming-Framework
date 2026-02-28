// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Rollout
/// @notice Progressive rollout management with multi-step advancement, pause/resume, and abort.
/// @dev Manages canary/blue-green/rolling deployments through a step-based rollout lifecycle.

contract Rollout {

    // --- Storage ---

    enum RolloutStatus { Active, Paused, Completed, Aborted }

    struct RolloutEntry {
        string plan;
        string strategy;
        string[] steps;
        int256 currentStep;
        int256 currentWeight;
        RolloutStatus rolloutStatus;
        string pauseReason;
        uint256 startedAt;
        uint256 updatedAt;
        bool exists;
    }

    mapping(bytes32 => RolloutEntry) private _rollouts;
    bytes32[] private _rolloutIds;
    mapping(bytes32 => bool) private _rolloutExists;

    // --- Types ---

    struct BeginInput {
        string plan;
        string strategy;
        string[] steps;
    }

    struct BeginOkResult {
        bool success;
        bytes32 rollout;
    }

    struct BeginInvalidStrategyResult {
        bool success;
        string message;
    }

    struct AdvanceOkResult {
        bool success;
        bytes32 rollout;
        int256 newWeight;
        int256 step;
    }

    struct AdvanceCompleteResult {
        bool success;
        bytes32 rollout;
    }

    struct AdvancePausedResult {
        bool success;
        bytes32 rollout;
        string reason;
    }

    struct PauseInput {
        bytes32 rollout;
        string reason;
    }

    struct PauseOkResult {
        bool success;
        bytes32 rollout;
    }

    struct ResumeOkResult {
        bool success;
        bytes32 rollout;
        int256 currentWeight;
    }

    struct AbortOkResult {
        bool success;
        bytes32 rollout;
    }

    struct AbortAlreadyCompleteResult {
        bool success;
        bytes32 rollout;
    }

    struct StatusOkResult {
        bool success;
        bytes32 rollout;
        int256 step;
        int256 weight;
        string status;
        int256 elapsed;
    }

    // --- Events ---

    event BeginCompleted(string variant, bytes32 rollout);
    event AdvanceCompleted(string variant, bytes32 rollout, int256 newWeight, int256 step);
    event PauseCompleted(string variant, bytes32 rollout);
    event ResumeCompleted(string variant, bytes32 rollout, int256 currentWeight);
    event AbortCompleted(string variant, bytes32 rollout);
    event StatusCompleted(string variant, bytes32 rollout, int256 step, int256 weight, int256 elapsed);

    // --- Actions ---

    /// @notice begin - Starts a new progressive rollout with the given strategy and steps.
    function begin(string memory plan, string memory strategy, string[] memory steps) external returns (BeginOkResult memory) {
        require(bytes(plan).length > 0, "Plan must not be empty");
        require(bytes(strategy).length > 0, "Strategy must not be empty");
        require(steps.length > 0, "Must provide at least one step");

        bytes32 rolloutId = keccak256(abi.encodePacked(plan, strategy, block.timestamp, msg.sender));

        _rollouts[rolloutId] = RolloutEntry({
            plan: plan,
            strategy: strategy,
            steps: steps,
            currentStep: 0,
            currentWeight: 0,
            rolloutStatus: RolloutStatus.Active,
            pauseReason: "",
            startedAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true
        });
        _rolloutExists[rolloutId] = true;
        _rolloutIds.push(rolloutId);

        emit BeginCompleted("ok", rolloutId);

        return BeginOkResult({
            success: true,
            rollout: rolloutId
        });
    }

    /// @notice advance - Moves the rollout to the next step, increasing traffic weight.
    function advance(bytes32 rollout) external returns (AdvanceOkResult memory) {
        require(_rolloutExists[rollout], "Rollout not found");
        RolloutEntry storage r = _rollouts[rollout];
        require(r.rolloutStatus == RolloutStatus.Active, "Rollout must be active to advance");

        r.currentStep++;
        r.updatedAt = block.timestamp;

        // Calculate weight based on step progress
        int256 totalSteps = int256(r.steps.length);
        if (r.currentStep >= totalSteps) {
            r.currentWeight = 100;
            r.rolloutStatus = RolloutStatus.Completed;
            emit AdvanceCompleted("complete", rollout, 100, r.currentStep);
        } else {
            r.currentWeight = (r.currentStep * 100) / totalSteps;
            emit AdvanceCompleted("ok", rollout, r.currentWeight, r.currentStep);
        }

        return AdvanceOkResult({
            success: true,
            rollout: rollout,
            newWeight: r.currentWeight,
            step: r.currentStep
        });
    }

    /// @notice pause - Pauses an active rollout with a reason.
    function pause(bytes32 rollout, string memory reason) external returns (PauseOkResult memory) {
        require(_rolloutExists[rollout], "Rollout not found");
        RolloutEntry storage r = _rollouts[rollout];
        require(r.rolloutStatus == RolloutStatus.Active, "Rollout must be active to pause");

        r.rolloutStatus = RolloutStatus.Paused;
        r.pauseReason = reason;
        r.updatedAt = block.timestamp;

        emit PauseCompleted("ok", rollout);

        return PauseOkResult({
            success: true,
            rollout: rollout
        });
    }

    /// @notice resume - Resumes a paused rollout.
    function resume(bytes32 rollout) external returns (ResumeOkResult memory) {
        require(_rolloutExists[rollout], "Rollout not found");
        RolloutEntry storage r = _rollouts[rollout];
        require(r.rolloutStatus == RolloutStatus.Paused, "Rollout must be paused to resume");

        r.rolloutStatus = RolloutStatus.Active;
        r.pauseReason = "";
        r.updatedAt = block.timestamp;

        emit ResumeCompleted("ok", rollout, r.currentWeight);

        return ResumeOkResult({
            success: true,
            rollout: rollout,
            currentWeight: r.currentWeight
        });
    }

    /// @notice abort - Aborts a rollout, rolling back to the pre-rollout state.
    function abort(bytes32 rollout) external returns (AbortOkResult memory) {
        require(_rolloutExists[rollout], "Rollout not found");
        RolloutEntry storage r = _rollouts[rollout];
        require(r.rolloutStatus != RolloutStatus.Completed, "Cannot abort a completed rollout");

        r.rolloutStatus = RolloutStatus.Aborted;
        r.currentWeight = 0;
        r.updatedAt = block.timestamp;

        emit AbortCompleted("ok", rollout);

        return AbortOkResult({
            success: true,
            rollout: rollout
        });
    }

    /// @notice status - Returns the current state of a rollout.
    function status(bytes32 rollout) external returns (StatusOkResult memory) {
        require(_rolloutExists[rollout], "Rollout not found");
        RolloutEntry storage r = _rollouts[rollout];

        string memory statusStr;
        if (r.rolloutStatus == RolloutStatus.Active) statusStr = "active";
        else if (r.rolloutStatus == RolloutStatus.Paused) statusStr = "paused";
        else if (r.rolloutStatus == RolloutStatus.Completed) statusStr = "completed";
        else statusStr = "aborted";

        int256 elapsed = int256(block.timestamp - r.startedAt);

        emit StatusCompleted("ok", rollout, r.currentStep, r.currentWeight, elapsed);

        return StatusOkResult({
            success: true,
            rollout: rollout,
            step: r.currentStep,
            weight: r.currentWeight,
            status: statusStr,
            elapsed: elapsed
        });
    }
}
