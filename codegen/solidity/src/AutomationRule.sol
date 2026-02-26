// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AutomationRule
/// @notice Concept-oriented automation rule management with trigger-condition-action patterns
/// @dev Implements the AutomationRule concept from COPF specification.
///      Supports defining rules with triggers, conditions, and actions, plus enable/disable toggling.

contract AutomationRule {
    // --- Types ---

    struct Rule {
        string trigger;
        string conditions;
        string actions;
        bool enabled;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps rule ID to its full data
    mapping(bytes32 => Rule) private _rules;

    // --- Events ---

    event RuleDefined(bytes32 indexed ruleId);
    event RuleEnabled(bytes32 indexed ruleId);
    event RuleDisabled(bytes32 indexed ruleId);

    // --- Actions ---

    /// @notice Define a new automation rule
    /// @param ruleId The unique identifier for the rule
    /// @param trigger The trigger event or condition
    /// @param conditions Additional conditions that must be met
    /// @param actions The actions to execute when triggered
    function defineRule(
        bytes32 ruleId,
        string calldata trigger,
        string calldata conditions,
        string calldata actions
    ) external {
        require(ruleId != bytes32(0), "Rule ID cannot be zero");
        require(bytes(trigger).length > 0, "Trigger cannot be empty");
        require(bytes(actions).length > 0, "Actions cannot be empty");

        _rules[ruleId] = Rule({
            trigger: trigger,
            conditions: conditions,
            actions: actions,
            enabled: false,
            exists: true
        });

        emit RuleDefined(ruleId);
    }

    /// @notice Enable an automation rule
    /// @param ruleId The rule ID to enable
    function enable(bytes32 ruleId) external {
        require(_rules[ruleId].exists, "Rule not found");
        require(!_rules[ruleId].enabled, "Rule already enabled");

        _rules[ruleId].enabled = true;

        emit RuleEnabled(ruleId);
    }

    /// @notice Disable an automation rule
    /// @param ruleId The rule ID to disable
    function disable(bytes32 ruleId) external {
        require(_rules[ruleId].exists, "Rule not found");
        require(_rules[ruleId].enabled, "Rule already disabled");

        _rules[ruleId].enabled = false;

        emit RuleDisabled(ruleId);
    }

    // --- Views ---

    /// @notice Retrieve a rule's full data
    /// @param ruleId The rule ID
    /// @return The full rule data struct
    function getRule(bytes32 ruleId) external view returns (Rule memory) {
        require(_rules[ruleId].exists, "Rule not found");
        return _rules[ruleId];
    }

    /// @notice Check if a rule is enabled
    /// @param ruleId The rule ID
    /// @return Whether the rule is currently enabled
    function isEnabled(bytes32 ruleId) external view returns (bool) {
        require(_rules[ruleId].exists, "Rule not found");
        return _rules[ruleId].enabled;
    }
}
