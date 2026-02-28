// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Generator
/// @notice Generated from Generator concept specification
/// @dev Manages interface generation plans and code generation from projections

contract Generator {

    // --- Storage ---

    struct PlanInfo {
        string kit;
        string interfaceManifest;
        string[] targets;
        string[] concepts;
        int256 estimatedFiles;
        bool generated;
        int256 filesGenerated;
        int256 filesUnchanged;
        uint256 created;
        bool exists;
    }

    mapping(bytes32 => PlanInfo) private _plans;
    bytes32[] private _planKeys;
    uint256 private _nonce;

    // --- Types ---

    struct PlanInput {
        string kit;
        string interfaceManifest;
    }

    struct PlanOkResult {
        bool success;
        bytes32 plan;
        string[] targets;
        string[] concepts;
        int256 estimatedFiles;
    }

    struct PlanNoTargetsConfiguredResult {
        bool success;
        string kit;
    }

    struct PlanMissingProviderResult {
        bool success;
        string target;
    }

    struct PlanProjectionFailedResult {
        bool success;
        string concept;
        string reason;
    }

    struct GenerateOkResult {
        bool success;
        bytes32 plan;
        int256 filesGenerated;
        int256 filesUnchanged;
        int256 duration;
    }

    struct GeneratePartialResult {
        bool success;
        bytes32 plan;
        string[] generated;
        string[] failed;
    }

    struct GenerateBlockedResult {
        bool success;
        bytes32 plan;
        string[] breakingChanges;
    }

    struct RegenerateInput {
        bytes32 plan;
        string[] targets;
    }

    struct RegenerateOkResult {
        bool success;
        bytes32 plan;
        int256 filesRegenerated;
    }

    // --- Events ---

    event PlanCompleted(string variant, bytes32 plan, string[] targets, string[] concepts, int256 estimatedFiles);
    event GenerateCompleted(string variant, bytes32 plan, int256 filesGenerated, int256 filesUnchanged, int256 duration, string[] generated, string[] failed, string[] breakingChanges);
    event RegenerateCompleted(string variant, bytes32 plan, int256 filesRegenerated);

    // --- Actions ---

    /// @notice plan
    function plan(string memory kit, string memory interfaceManifest) external returns (PlanOkResult memory) {
        require(bytes(kit).length > 0, "Kit must not be empty");
        require(bytes(interfaceManifest).length > 0, "Interface manifest must not be empty");

        bytes32 planId = keccak256(abi.encodePacked(kit, interfaceManifest, block.timestamp, _nonce++));

        // Derive default targets and concepts from the kit
        string[] memory targets = new string[](1);
        targets[0] = kit;

        string[] memory concepts = new string[](1);
        concepts[0] = interfaceManifest;

        int256 estimatedFiles = int256(1);

        _plans[planId] = PlanInfo({
            kit: kit,
            interfaceManifest: interfaceManifest,
            targets: targets,
            concepts: concepts,
            estimatedFiles: estimatedFiles,
            generated: false,
            filesGenerated: 0,
            filesUnchanged: 0,
            created: block.timestamp,
            exists: true
        });
        _planKeys.push(planId);

        emit PlanCompleted("ok", planId, targets, concepts, estimatedFiles);

        return PlanOkResult({
            success: true,
            plan: planId,
            targets: targets,
            concepts: concepts,
            estimatedFiles: estimatedFiles
        });
    }

    /// @notice generate
    function generate(bytes32 planId) external returns (GenerateOkResult memory) {
        require(_plans[planId].exists, "Plan does not exist");
        require(!_plans[planId].generated, "Plan already generated");

        PlanInfo storage info = _plans[planId];

        int256 filesGenerated = info.estimatedFiles;
        int256 filesUnchanged = int256(0);
        int256 duration = int256(block.timestamp - info.created);

        info.generated = true;
        info.filesGenerated = filesGenerated;
        info.filesUnchanged = filesUnchanged;

        string[] memory emptyList = new string[](0);
        emit GenerateCompleted("ok", planId, filesGenerated, filesUnchanged, duration, emptyList, emptyList, emptyList);

        return GenerateOkResult({
            success: true,
            plan: planId,
            filesGenerated: filesGenerated,
            filesUnchanged: filesUnchanged,
            duration: duration
        });
    }

    /// @notice regenerate
    function regenerate(bytes32 planId, string[] memory targets) external returns (RegenerateOkResult memory) {
        require(_plans[planId].exists, "Plan does not exist");
        require(_plans[planId].generated, "Plan has not been generated yet");
        require(targets.length > 0, "Targets must not be empty");

        int256 filesRegenerated = int256(targets.length);

        _plans[planId].filesGenerated = _plans[planId].filesGenerated + filesRegenerated;

        emit RegenerateCompleted("ok", planId, filesRegenerated);

        return RegenerateOkResult({
            success: true,
            plan: planId,
            filesRegenerated: filesRegenerated
        });
    }

}
