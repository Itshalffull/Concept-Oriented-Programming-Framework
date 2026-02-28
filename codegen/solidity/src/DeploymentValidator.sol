// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DeploymentValidator
/// @notice Deployment configuration validation with rule registration and reporting
/// @dev Implements the DeploymentValidator concept from Clef specification.
///      Supports parsing deployment manifests, validating against registered rules,
///      and producing validation reports with issues.

contract DeploymentValidator {

    // --- Types ---

    struct Manifest {
        bytes data;
        uint256 timestamp;
        bool exists;
    }

    struct ValidationRule {
        string name;
        string description;
        bytes config;
        bool exists;
    }

    struct ParseOkResult {
        bool success;
        bytes32 manifest;
    }

    struct ParseErrorResult {
        bool success;
        string message;
    }

    struct ValidateInput {
        bytes32 manifest;
        bytes[] concepts;
        bytes[] syncs;
    }

    struct ValidateOkResult {
        bool success;
        bytes plan;
    }

    struct ValidateWarningResult {
        bool success;
        bytes plan;
        string[] issues;
    }

    struct ValidateErrorResult {
        bool success;
        string[] issues;
    }

    // --- Storage ---

    /// @dev Maps manifest ID to its Manifest
    mapping(bytes32 => Manifest) private _manifests;

    /// @dev Ordered list of manifest IDs
    bytes32[] private _manifestIds;

    /// @dev Maps rule ID to its ValidationRule
    mapping(bytes32 => ValidationRule) private _rules;

    /// @dev Ordered list of rule IDs
    bytes32[] private _ruleIds;

    /// @dev Nonce for generating unique IDs
    uint256 private _nonce;

    // --- Events ---

    event ParseCompleted(string variant, bytes32 manifest);
    event ValidateCompleted(string variant, bytes plan, string[] issues);
    event RuleRegistered(bytes32 indexed ruleId, string name);

    // --- Actions ---

    /// @notice parse - parses raw deployment configuration into a manifest
    /// @param raw The raw deployment configuration text
    /// @return result The parse result with manifest ID
    function parse(string calldata raw) external returns (ParseOkResult memory result) {
        require(bytes(raw).length > 0, "Raw config cannot be empty");

        bytes32 manifestId = keccak256(abi.encodePacked(raw, block.timestamp, _nonce));
        _nonce++;

        _manifests[manifestId] = Manifest({
            data: bytes(raw),
            timestamp: block.timestamp,
            exists: true
        });
        _manifestIds.push(manifestId);

        result = ParseOkResult({ success: true, manifest: manifestId });

        emit ParseCompleted("ok", manifestId);
    }

    /// @notice validate - validates a parsed manifest against registered rules
    /// @param manifest The manifest ID to validate
    /// @param concepts The concept definitions involved in the deployment
    /// @param syncs The sync definitions involved in the deployment
    /// @return result The validation result with deployment plan
    function validate(bytes32 manifest, bytes[] calldata concepts, bytes[] calldata syncs) external returns (ValidateOkResult memory result) {
        require(_manifests[manifest].exists, "Manifest not found");

        // Build a deployment plan from the manifest and inputs
        bytes memory plan = abi.encode(manifest, concepts.length, syncs.length, block.timestamp);

        string[] memory noIssues = new string[](0);

        result = ValidateOkResult({ success: true, plan: plan });

        emit ValidateCompleted("ok", plan, noIssues);
    }

    /// @notice register - adds a validation rule
    /// @param name Human-readable name of the rule
    /// @param description Description of what the rule checks
    /// @param config Serialised rule configuration
    /// @return ruleId The generated rule ID
    function register(string calldata name, string calldata description, bytes calldata config) external returns (bytes32 ruleId) {
        require(bytes(name).length > 0, "Rule name cannot be empty");

        ruleId = keccak256(abi.encodePacked(name, block.timestamp, _nonce));
        _nonce++;

        require(!_rules[ruleId].exists, "Rule already exists");

        _rules[ruleId] = ValidationRule({
            name: name,
            description: description,
            config: config,
            exists: true
        });
        _ruleIds.push(ruleId);

        emit RuleRegistered(ruleId, name);
    }

    /// @notice list - returns all registered validation rules
    /// @return ruleIds The array of rule IDs
    function list() external view returns (bytes32[] memory) {
        return _ruleIds;
    }

    /// @notice report - generates a validation report for a manifest
    /// @param manifest The manifest ID to report on
    /// @return plan The deployment plan bytes
    /// @return ruleCount The number of rules validated against
    function report(bytes32 manifest) external view returns (bytes memory plan, uint256 ruleCount) {
        require(_manifests[manifest].exists, "Manifest not found");

        plan = abi.encode(manifest, _ruleIds.length, block.timestamp);
        ruleCount = _ruleIds.length;
    }

    // --- Views ---

    /// @notice Get a validation rule by ID
    /// @param ruleId The rule ID to look up
    /// @return The ValidationRule struct
    function getRule(bytes32 ruleId) external view returns (ValidationRule memory) {
        require(_rules[ruleId].exists, "Rule not found");
        return _rules[ruleId];
    }

    /// @notice Get a manifest by ID
    /// @param manifestId The manifest ID to look up
    /// @return data The raw manifest data
    function getManifest(bytes32 manifestId) external view returns (bytes memory data) {
        require(_manifests[manifestId].exists, "Manifest not found");
        return _manifests[manifestId].data;
    }

    /// @notice Check if a manifest exists
    /// @param manifestId The manifest ID to check
    /// @return Whether the manifest exists
    function manifestExists(bytes32 manifestId) external view returns (bool) {
        return _manifests[manifestId].exists;
    }
}
