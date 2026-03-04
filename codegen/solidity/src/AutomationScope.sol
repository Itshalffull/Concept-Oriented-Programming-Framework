// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AutomationScope
/// @notice Automation scope and rule boundary manager
/// @dev Implements the AutomationScope concept from Clef specification.
///      Manages scoped rule sets, mode configuration, and action-level access checks.

contract AutomationScope {

    // --- Types ---

    struct ConfigureOkResult {
        bool success;
        bytes32 scopeId;
        string mode;
    }

    struct ConfigureInvalidErrorResult {
        bool success;
        string message;
    }

    struct AddRuleOkResult {
        bool success;
        bytes32 scopeId;
        bytes32 ruleId;
    }

    struct AddRuleDuplicateErrorResult {
        bool success;
        string message;
    }

    struct RemoveRuleOkResult {
        bool success;
        bytes32 scopeId;
        bytes32 ruleId;
    }

    struct RemoveRuleNotFoundErrorResult {
        bool success;
        string message;
    }

    struct CheckOkResult {
        bool success;
        bytes32 scopeId;
        bool allowed;
    }

    struct CheckScopeNotFoundErrorResult {
        bool success;
        string message;
    }

    struct ListRulesOkResult {
        bool success;
        bytes32 scopeId;
        uint256 count;
    }

    struct ListRulesEmptyErrorResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Maps scope ID to existence
    mapping(bytes32 => bool) private _scopes;

    /// @dev Ordered list of scope IDs
    bytes32[] private _scopeKeys;

    /// @dev Maps scope ID to its configured mode string
    mapping(bytes32 => string) private _scopeModes;

    /// @dev Maps scope ID to rule ID to existence
    mapping(bytes32 => mapping(bytes32 => bool)) private _rules;

    /// @dev Maps scope ID to its ordered list of rule IDs
    mapping(bytes32 => bytes32[]) private _ruleKeys;

    /// @dev Maps rule ID to its pattern string
    mapping(bytes32 => string) private _rulePatterns;

    /// @dev Maps rule ID to its category string
    mapping(bytes32 => string) private _ruleCategories;

    // --- Events ---

    event ConfigureCompleted(string variant, bytes32 id);
    event AddRuleCompleted(string variant, bytes32 id);
    event RemoveRuleCompleted(string variant, bytes32 id);
    event CheckCompleted(string variant, bytes32 id);
    event ListRulesCompleted(string variant, bytes32 id);

    // --- Actions ---

    /// @notice configure — create or update a scope with a given mode
    function configure(
        string calldata scope,
        string calldata mode
    ) external returns (ConfigureOkResult memory) {
        bytes32 scopeId = keccak256(abi.encodePacked(scope));

        if (!_scopes[scopeId]) {
            _scopes[scopeId] = true;
            _scopeKeys.push(scopeId);
        }

        _scopeModes[scopeId] = mode;

        emit ConfigureCompleted("ok", scopeId);

        return ConfigureOkResult({success: true, scopeId: scopeId, mode: mode});
    }

    /// @notice addRule — attach a pattern-based rule to a scope
    function addRule(
        string calldata scope,
        string calldata pattern,
        string calldata category
    ) external returns (AddRuleOkResult memory) {
        bytes32 scopeId = keccak256(abi.encodePacked(scope));
        require(_scopes[scopeId], "Scope not found");

        bytes32 ruleId = keccak256(abi.encodePacked(scopeId, pattern, category));
        require(!_rules[scopeId][ruleId], "Rule already exists in scope");

        _rules[scopeId][ruleId] = true;
        _ruleKeys[scopeId].push(ruleId);
        _rulePatterns[ruleId] = pattern;
        _ruleCategories[ruleId] = category;

        emit AddRuleCompleted("ok", ruleId);

        return AddRuleOkResult({success: true, scopeId: scopeId, ruleId: ruleId});
    }

    /// @notice removeRule — detach a pattern-based rule from a scope
    function removeRule(
        string calldata scope,
        string calldata pattern
    ) external returns (RemoveRuleOkResult memory) {
        bytes32 scopeId = keccak256(abi.encodePacked(scope));
        require(_scopes[scopeId], "Scope not found");

        bytes32 ruleId = keccak256(abi.encodePacked(scopeId, pattern));
        require(_rules[scopeId][ruleId], "Rule not found in scope");

        _rules[scopeId][ruleId] = false;

        emit RemoveRuleCompleted("ok", ruleId);

        return RemoveRuleOkResult({success: true, scopeId: scopeId, ruleId: ruleId});
    }

    /// @notice check — verify whether an action reference is allowed within a scope
    function check(
        string calldata scope,
        string calldata actionRef
    ) external returns (CheckOkResult memory) {
        bytes32 scopeId = keccak256(abi.encodePacked(scope));
        require(_scopes[scopeId], "Scope not found");

        bytes32 actionKey = keccak256(abi.encodePacked(scopeId, actionRef));
        bool allowed = _rules[scopeId][actionKey];

        emit CheckCompleted("ok", scopeId);

        return CheckOkResult({success: true, scopeId: scopeId, allowed: allowed});
    }

    /// @notice listRules — enumerate all rules within a scope
    function listRules(
        string calldata scope
    ) external returns (ListRulesOkResult memory) {
        bytes32 scopeId = keccak256(abi.encodePacked(scope));
        require(_scopes[scopeId], "Scope not found");

        uint256 count = _ruleKeys[scopeId].length;

        emit ListRulesCompleted("ok", scopeId);

        return ListRulesOkResult({success: true, scopeId: scopeId, count: count});
    }

}
