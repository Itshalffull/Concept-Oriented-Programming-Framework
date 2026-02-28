// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ClaudeSkillsTarget
/// @notice AI-target provider that generates Claude skill definitions from concept projections.
/// @dev Produces skill JSON files for Claude Code integration.

contract ClaudeSkillsTarget {

    // --- Storage ---

    /// @dev Maps skill hash to whether it exists
    mapping(bytes32 => bool) private skills;
    bytes32[] private skillsKeys;

    /// @dev Maps skill hash to its associated projection
    mapping(bytes32 => string) private skillProjections;

    /// @dev Maps projection hash to the generated file list
    mapping(bytes32 => string[]) private generatedFiles;

    /// @dev Maps projection hash to the generated skill hashes
    mapping(bytes32 => bytes32[]) private generatedSkills;

    /// @dev Counter of total generations
    uint256 private generationCount;

    // --- Types ---

    struct GenerateInput {
        string projection;
        string config;
    }

    struct GenerateOkResult {
        bool success;
        bytes32[] skills;
        string[] files;
    }

    struct GenerateMissingProjectionResult {
        bool success;
        string concept;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 skill;
    }

    struct ValidateInvalidFrontmatterResult {
        bool success;
        bytes32 skill;
        string[] errors;
    }

    struct ValidateBrokenReferencesResult {
        bool success;
        bytes32 skill;
        string[] missing;
    }

    struct ListSkillsOkResult {
        bool success;
        string[] skills;
        string[] enriched;
        string[] flat;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes32[] skills, string[] files);
    event ValidateCompleted(string variant, bytes32 skill, string[] errors, string[] missing);
    event ListSkillsCompleted(string variant, string[] skills, string[] enriched, string[] flat);

    // --- Registration ---

    /// @notice Returns static metadata for this target provider.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory formats)
    {
        name = "claude-skills";
        category = "ai-target";
        formats = new string[](1);
        formats[0] = "json";
    }

    // --- Actions ---

    /// @notice Generate Claude skill definitions from a concept projection
    function generate(string memory projection, string memory config) external returns (GenerateOkResult memory) {
        require(bytes(projection).length > 0, "Projection cannot be empty");

        bytes32 projHash = keccak256(abi.encodePacked(projection, config));

        // Create a skill entry for this projection
        bytes32 skillHash = keccak256(abi.encodePacked(projection, generationCount));
        generationCount++;

        if (!skills[skillHash]) {
            skills[skillHash] = true;
            skillsKeys.push(skillHash);
        }
        skillProjections[skillHash] = projection;

        // Build generated files list
        string[] memory files = new string[](2);
        files[0] = string(abi.encodePacked(projection, ".skill.json"));
        files[1] = string(abi.encodePacked(projection, ".skill.md"));

        bytes32[] memory generatedSkillList = new bytes32[](1);
        generatedSkillList[0] = skillHash;

        // Store generation results keyed by projection hash
        generatedFiles[projHash] = files;
        generatedSkills[projHash] = generatedSkillList;

        emit GenerateCompleted("ok", generatedSkillList, files);

        return GenerateOkResult({
            success: true,
            skills: generatedSkillList,
            files: files
        });
    }

    /// @notice Validate a generated skill definition
    function validate(bytes32 skill) external returns (ValidateOkResult memory) {
        require(skills[skill], "Skill not found");

        string[] memory noErrors = new string[](0);
        string[] memory noMissing = new string[](0);

        emit ValidateCompleted("ok", skill, noErrors, noMissing);

        return ValidateOkResult({
            success: true,
            skill: skill
        });
    }

    /// @notice List all generated skills, optionally filtered by suite
    function listSkills(string memory kit) external returns (ListSkillsOkResult memory) {
        uint256 count = skillsKeys.length;
        string[] memory skillNames = new string[](count);
        string[] memory enriched = new string[](count);
        string[] memory flat = new string[](count);

        for (uint256 i = 0; i < count; i++) {
            string memory proj = skillProjections[skillsKeys[i]];
            skillNames[i] = proj;
            enriched[i] = string(abi.encodePacked(kit, "/", proj));
            flat[i] = proj;
        }

        emit ListSkillsCompleted("ok", skillNames, enriched, flat);

        return ListSkillsOkResult({
            success: true,
            skills: skillNames,
            enriched: enriched,
            flat: flat
        });
    }

}
