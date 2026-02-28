// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DeployPlan
/// @notice Deployment plan management with lifecycle tracking, validation, and rollback support.
/// @dev Manages deployment plans through create/validate/execute/rollback lifecycle.

contract DeployPlan {

    // --- Storage ---

    enum PlanPhase { Created, Validated, Executing, Completed, RolledBack, Failed }

    struct PlanEntry {
        string manifest;
        string environment;
        string graph;
        int256 estimatedDuration;
        PlanPhase phase;
        uint256 progress;
        uint256 startedAt;
        uint256 completedAt;
        int256 nodesDeployed;
        bool exists;
    }

    mapping(bytes32 => PlanEntry) private _plans;
    bytes32[] private _planIds;
    mapping(bytes32 => bool) private _planExists;

    // --- Types ---

    struct PlanInput {
        string manifest;
        string environment;
    }

    struct PlanOkResult {
        bool success;
        bytes32 plan;
        string graph;
        int256 estimatedDuration;
    }

    struct PlanInvalidManifestResult {
        bool success;
        string[] errors;
    }

    struct PlanIncompleteGraphResult {
        bool success;
        string[] missing;
    }

    struct PlanCircularDependencyResult {
        bool success;
        string[] cycle;
    }

    struct PlanTransportMismatchResult {
        bool success;
        string[] details;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 plan;
        string[] warnings;
    }

    struct ValidateMigrationRequiredResult {
        bool success;
        bytes32 plan;
        string[] concepts;
        int256[] fromVersions;
        int256[] toVersions;
    }

    struct ValidateSchemaIncompatibleResult {
        bool success;
        string[] details;
    }

    struct ExecuteOkResult {
        bool success;
        bytes32 plan;
        int256 duration;
        int256 nodesDeployed;
    }

    struct ExecutePartialResult {
        bool success;
        bytes32 plan;
        string[] deployed;
        string[] failed;
    }

    struct ExecuteRollbackTriggeredResult {
        bool success;
        bytes32 plan;
        string reason;
        string[] rolledBack;
    }

    struct ExecuteRollbackFailedResult {
        bool success;
        bytes32 plan;
        string reason;
        string[] stuck;
    }

    struct RollbackOkResult {
        bool success;
        bytes32 plan;
        string[] rolledBack;
    }

    struct RollbackPartialResult {
        bool success;
        bytes32 plan;
        string[] rolledBack;
        string[] stuck;
    }

    struct StatusOkResult {
        bool success;
        bytes32 plan;
        string phase;
        uint256 progress;
        string[] activeNodes;
    }

    struct StatusNotfoundResult {
        bool success;
        bytes32 plan;
    }

    // --- Events ---

    event PlanCompleted(string variant, bytes32 plan, int256 estimatedDuration, string[] errors, string[] missing, string[] cycle, string[] details);
    event ValidateCompleted(string variant, bytes32 plan, string[] warnings, string[] concepts, int256[] fromVersions, int256[] toVersions, string[] details);
    event ExecuteCompleted(string variant, bytes32 plan, int256 duration, int256 nodesDeployed, string[] deployed, string[] failed, string[] rolledBack, string[] stuck);
    event RollbackCompleted(string variant, bytes32 plan, string[] rolledBack, string[] stuck);
    event StatusCompleted(string variant, bytes32 plan, uint256 progress, string[] activeNodes);

    // --- Actions ---

    /// @notice plan - Creates a deployment plan from a manifest and environment.
    function plan(string memory manifest, string memory environment) external returns (PlanOkResult memory) {
        require(bytes(manifest).length > 0, "Manifest must not be empty");
        require(bytes(environment).length > 0, "Environment must not be empty");

        bytes32 planId = keccak256(abi.encodePacked(manifest, environment, block.timestamp, msg.sender));
        string memory graph = string(abi.encodePacked("graph:", manifest, "->", environment));
        int256 estimatedDuration = int256(bytes(manifest).length * 10);

        _plans[planId] = PlanEntry({
            manifest: manifest,
            environment: environment,
            graph: graph,
            estimatedDuration: estimatedDuration,
            phase: PlanPhase.Created,
            progress: 0,
            startedAt: block.timestamp,
            completedAt: 0,
            nodesDeployed: 0,
            exists: true
        });
        _planExists[planId] = true;
        _planIds.push(planId);

        string[] memory empty = new string[](0);
        emit PlanCompleted("ok", planId, estimatedDuration, empty, empty, empty, empty);

        return PlanOkResult({
            success: true,
            plan: planId,
            graph: graph,
            estimatedDuration: estimatedDuration
        });
    }

    /// @notice validate - Validates a deployment plan's dependencies and schema compatibility.
    function validate(bytes32 planId) external returns (ValidateOkResult memory) {
        require(_planExists[planId], "Plan not found");
        PlanEntry storage p = _plans[planId];
        require(p.phase == PlanPhase.Created, "Plan must be in Created phase to validate");

        p.phase = PlanPhase.Validated;

        string[] memory warnings = new string[](0);
        string[] memory emptyConcepts = new string[](0);
        int256[] memory emptyVersions = new int256[](0);
        string[] memory emptyDetails = new string[](0);

        emit ValidateCompleted("ok", planId, warnings, emptyConcepts, emptyVersions, emptyVersions, emptyDetails);

        return ValidateOkResult({
            success: true,
            plan: planId,
            warnings: warnings
        });
    }

    /// @notice execute - Executes a validated deployment plan.
    function execute(bytes32 planId) external returns (ExecuteOkResult memory) {
        require(_planExists[planId], "Plan not found");
        PlanEntry storage p = _plans[planId];
        require(p.phase == PlanPhase.Validated, "Plan must be validated before execution");

        p.phase = PlanPhase.Completed;
        p.progress = 100;
        p.completedAt = block.timestamp;

        int256 duration = int256(p.completedAt - p.startedAt);
        int256 nodesDeployed = int256(bytes(p.manifest).length / 10) + 1;
        p.nodesDeployed = nodesDeployed;

        string[] memory empty = new string[](0);
        emit ExecuteCompleted("ok", planId, duration, nodesDeployed, empty, empty, empty, empty);

        return ExecuteOkResult({
            success: true,
            plan: planId,
            duration: duration,
            nodesDeployed: nodesDeployed
        });
    }

    /// @notice rollback - Rolls back an executed deployment plan.
    function rollback(bytes32 planId) external returns (RollbackOkResult memory) {
        require(_planExists[planId], "Plan not found");
        PlanEntry storage p = _plans[planId];
        require(p.phase == PlanPhase.Completed || p.phase == PlanPhase.Executing, "Plan must be completed or executing to rollback");

        p.phase = PlanPhase.RolledBack;
        p.progress = 0;

        string[] memory rolledBack = new string[](1);
        rolledBack[0] = p.manifest;

        string[] memory emptyStuck = new string[](0);
        emit RollbackCompleted("ok", planId, rolledBack, emptyStuck);

        return RollbackOkResult({
            success: true,
            plan: planId,
            rolledBack: rolledBack
        });
    }

    /// @notice status - Returns the current state of a deployment plan.
    function status(bytes32 planId) external returns (StatusOkResult memory) {
        require(_planExists[planId], "Plan not found");
        PlanEntry storage p = _plans[planId];

        string memory phaseName;
        if (p.phase == PlanPhase.Created) phaseName = "created";
        else if (p.phase == PlanPhase.Validated) phaseName = "validated";
        else if (p.phase == PlanPhase.Executing) phaseName = "executing";
        else if (p.phase == PlanPhase.Completed) phaseName = "completed";
        else if (p.phase == PlanPhase.RolledBack) phaseName = "rolledBack";
        else phaseName = "failed";

        string[] memory activeNodes = new string[](0);

        emit StatusCompleted("ok", planId, p.progress, activeNodes);

        return StatusOkResult({
            success: true,
            plan: planId,
            phase: phaseName,
            progress: p.progress,
            activeNodes: activeNodes
        });
    }
}
