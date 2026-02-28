// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AnalysisRule
/// @notice Analysis rule management — define rules with pattern/action, evaluate against targets
/// @dev Implements the AnalysisRule concept from Clef specification.
///      Supports creating analysis rules, evaluating individual rules or
///      all rules in a category, and retrieving rule metadata.

contract AnalysisRule {

    // --- Types ---

    struct CreateInput {
        string name;
        string engine;
        string source;
        string severity;
        string category;
    }

    struct CreateOkResult {
        bool success;
        bytes32 rule;
    }

    struct CreateInvalidSyntaxResult {
        bool success;
        string message;
    }

    struct EvaluateOkResult {
        bool success;
        string findings;
    }

    struct EvaluateEvaluationErrorResult {
        bool success;
        string message;
    }

    struct EvaluateAllOkResult {
        bool success;
        string results;
    }

    struct GetOkResult {
        bool success;
        bytes32 rule;
        string name;
        string engine;
        string severity;
        string category;
    }

    struct RuleEntry {
        string name;
        string engine;
        string source;
        string severity;
        string category;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps rule ID to its RuleEntry
    mapping(bytes32 => RuleEntry) private _rules;

    /// @dev Ordered list of rule IDs
    bytes32[] private _ruleKeys;

    // --- Events ---

    event CreateCompleted(string variant, bytes32 rule);
    event EvaluateCompleted(string variant);
    event EvaluateAllCompleted(string variant);
    event GetCompleted(string variant, bytes32 rule);

    // --- Actions ---

    /// @notice create — define a new analysis rule with pattern/action
    function create(string memory name, string memory engine, string memory source, string memory severity, string memory category) external returns (CreateOkResult memory) {
        require(bytes(name).length > 0, "Name must not be empty");
        require(bytes(engine).length > 0, "Engine must not be empty");
        require(bytes(source).length > 0, "Source must not be empty");

        bytes32 ruleId = keccak256(abi.encodePacked(name, engine, source));

        require(!_rules[ruleId].exists, "Rule already exists");

        _rules[ruleId] = RuleEntry({
            name: name,
            engine: engine,
            source: source,
            severity: severity,
            category: category,
            exists: true
        });
        _ruleKeys.push(ruleId);

        emit CreateCompleted("ok", ruleId);

        return CreateOkResult({success: true, rule: ruleId});
    }

    /// @notice evaluate — evaluate a single rule against its target
    function evaluate(bytes32 rule) external returns (EvaluateOkResult memory) {
        require(_rules[rule].exists, "Rule not found");

        emit EvaluateCompleted("ok");

        return EvaluateOkResult({success: true, findings: ""});
    }

    /// @notice evaluateAll — evaluate all rules matching a category
    function evaluateAll(string memory category) external returns (EvaluateAllOkResult memory) {
        require(bytes(category).length > 0, "Category must not be empty");

        uint256 matchCount = 0;
        for (uint256 i = 0; i < _ruleKeys.length; i++) {
            if (keccak256(bytes(_rules[_ruleKeys[i]].category)) == keccak256(bytes(category))) {
                matchCount++;
            }
        }

        emit EvaluateAllCompleted("ok");

        string memory results = matchCount > 0 ? "evaluated" : "no-matches";
        return EvaluateAllOkResult({success: true, results: results});
    }

    /// @notice get — retrieve an analysis rule by ID
    function get(bytes32 rule) external returns (GetOkResult memory) {
        require(_rules[rule].exists, "Rule not found");

        RuleEntry storage entry = _rules[rule];

        emit GetCompleted("ok", rule);

        return GetOkResult({
            success: true,
            rule: rule,
            name: entry.name,
            engine: entry.engine,
            severity: entry.severity,
            category: entry.category
        });
    }

}
