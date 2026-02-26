// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DataQuality
/// @notice Validation gating and quarantine for data quality enforcement
/// @dev Implements the DataQuality concept from COPF specification.
///      Supports creating rulesets, validating items against rulesets with scoring,
///      quarantining items that fail validation, and releasing them after remediation.

contract DataQuality {
    // --- Types ---

    struct Ruleset {
        string name;
        bool exists;
    }

    struct QuarantinedItem {
        bytes32 itemId;
        string reason;
        bool released;
        bool exists;
    }

    struct QualityScore {
        bytes32 itemId;
        bytes32 rulesetId;
        bool valid;
        uint256 score;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps ruleset ID to its Ruleset entry
    mapping(bytes32 => Ruleset) private _rulesets;

    /// @dev Maps item ID to its QuarantinedItem entry
    mapping(bytes32 => QuarantinedItem) private _quarantined;

    /// @dev Maps item ID -> ruleset ID -> QualityScore
    mapping(bytes32 => mapping(bytes32 => QualityScore)) private _qualityScores;

    // --- Events ---

    event RulesetCreated(bytes32 indexed rulesetId, string name);
    event ItemValidated(bytes32 indexed itemId, bytes32 indexed rulesetId, bool valid, uint256 score);
    event ItemQuarantined(bytes32 indexed itemId, string reason);
    event ItemReleased(bytes32 indexed itemId);

    // --- Actions ---

    /// @notice Create a new validation ruleset
    /// @param rulesetId Unique identifier for the ruleset
    /// @param name Human-readable name of the ruleset
    function createRuleset(bytes32 rulesetId, string calldata name) external {
        require(rulesetId != bytes32(0), "Ruleset ID cannot be zero");
        require(!_rulesets[rulesetId].exists, "Ruleset already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _rulesets[rulesetId] = Ruleset({
            name: name,
            exists: true
        });

        emit RulesetCreated(rulesetId, name);
    }

    /// @notice Validate an item against a ruleset
    /// @param itemId The item to validate
    /// @param rulesetId The ruleset to validate against
    /// @return valid Whether the item passes validation
    /// @return score The quality score (0-100)
    function validate(bytes32 itemId, bytes32 rulesetId) external returns (bool valid, uint256 score) {
        require(itemId != bytes32(0), "Item ID cannot be zero");
        require(_rulesets[rulesetId].exists, "Ruleset not found");

        // Default: item is valid with a perfect score; actual validation is off-chain
        valid = true;
        score = 100;

        _qualityScores[itemId][rulesetId] = QualityScore({
            itemId: itemId,
            rulesetId: rulesetId,
            valid: valid,
            score: score,
            exists: true
        });

        emit ItemValidated(itemId, rulesetId, valid, score);

        return (valid, score);
    }

    /// @notice Quarantine an item that failed validation
    /// @param itemId The item to quarantine
    /// @param reason The reason for quarantine
    function quarantine(bytes32 itemId, string calldata reason) external {
        require(itemId != bytes32(0), "Item ID cannot be zero");
        require(!_quarantined[itemId].exists, "Item already quarantined");

        _quarantined[itemId] = QuarantinedItem({
            itemId: itemId,
            reason: reason,
            released: false,
            exists: true
        });

        emit ItemQuarantined(itemId, reason);
    }

    /// @notice Release a quarantined item after remediation
    /// @param itemId The item to release
    function release(bytes32 itemId) external {
        require(_quarantined[itemId].exists, "Item not quarantined");
        require(!_quarantined[itemId].released, "Item already released");

        _quarantined[itemId].released = true;

        emit ItemReleased(itemId);
    }

    // --- Views ---

    /// @notice Retrieve a ruleset entry
    /// @param rulesetId The ruleset to look up
    /// @return The Ruleset struct
    function getRuleset(bytes32 rulesetId) external view returns (Ruleset memory) {
        require(_rulesets[rulesetId].exists, "Ruleset not found");
        return _rulesets[rulesetId];
    }

    /// @notice Retrieve a quarantined item entry
    /// @param itemId The item to look up
    /// @return The QuarantinedItem struct
    function getQuarantinedItem(bytes32 itemId) external view returns (QuarantinedItem memory) {
        require(_quarantined[itemId].exists, "Item not quarantined");
        return _quarantined[itemId];
    }

    /// @notice Retrieve a quality score for an item and ruleset
    /// @param itemId The item to look up
    /// @param rulesetId The ruleset to look up
    /// @return The QualityScore struct
    function getQualityScore(bytes32 itemId, bytes32 rulesetId) external view returns (QualityScore memory) {
        require(_qualityScores[itemId][rulesetId].exists, "Quality score not found");
        return _qualityScores[itemId][rulesetId];
    }

    /// @notice Check whether a ruleset exists
    /// @param rulesetId The ruleset to check
    /// @return Whether the ruleset exists
    function rulesetExists(bytes32 rulesetId) external view returns (bool) {
        return _rulesets[rulesetId].exists;
    }

    /// @notice Check whether an item is quarantined
    /// @param itemId The item to check
    /// @return Whether the item is quarantined
    function isQuarantined(bytes32 itemId) external view returns (bool) {
        return _quarantined[itemId].exists && !_quarantined[itemId].released;
    }
}
