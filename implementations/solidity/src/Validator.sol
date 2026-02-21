// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Validator
/// @notice Concept-oriented validation framework with constraints and per-field rules
/// @dev Implements the Validator concept from COPF specification.
///      Supports registering reusable constraints and applying validation rules
///      to schema fields.

contract Validator {
    // --- Types ---

    struct Constraint {
        string evaluatorConfig;
        bool exists;
    }

    struct ValidationRule {
        bytes32 constraintId;
        string params;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps constraint ID to its evaluator configuration
    mapping(bytes32 => Constraint) private _constraints;

    /// @dev Maps schema ID -> field ID -> validation rule
    mapping(bytes32 => mapping(bytes32 => ValidationRule)) private _rules;

    // --- Events ---

    event ConstraintRegistered(bytes32 indexed constraintId);
    event RuleAdded(bytes32 indexed schemaId, bytes32 indexed fieldId);

    // --- Actions ---

    /// @notice Register a reusable validation constraint
    /// @param constraintId The unique identifier for the constraint
    /// @param evaluatorConfig The evaluator configuration for the constraint
    function registerConstraint(bytes32 constraintId, string calldata evaluatorConfig) external {
        require(constraintId != bytes32(0), "Constraint ID cannot be zero");
        require(bytes(evaluatorConfig).length > 0, "Evaluator config cannot be empty");

        _constraints[constraintId] = Constraint({
            evaluatorConfig: evaluatorConfig,
            exists: true
        });

        emit ConstraintRegistered(constraintId);
    }

    /// @notice Add a validation rule to a schema field
    /// @param schemaId The schema to add the rule to
    /// @param fieldId The field within the schema
    /// @param constraintId The constraint to apply
    /// @param params Parameters for the constraint evaluation
    function addRule(
        bytes32 schemaId,
        bytes32 fieldId,
        bytes32 constraintId,
        string calldata params
    ) external {
        require(schemaId != bytes32(0), "Schema ID cannot be zero");
        require(fieldId != bytes32(0), "Field ID cannot be zero");
        require(_constraints[constraintId].exists, "Constraint not found");

        _rules[schemaId][fieldId] = ValidationRule({
            constraintId: constraintId,
            params: params,
            exists: true
        });

        emit RuleAdded(schemaId, fieldId);
    }

    // --- Views ---

    /// @notice Retrieve a constraint's configuration
    /// @param constraintId The constraint ID
    /// @return The constraint data struct
    function getConstraint(bytes32 constraintId) external view returns (Constraint memory) {
        require(_constraints[constraintId].exists, "Constraint not found");
        return _constraints[constraintId];
    }

    /// @notice Retrieve a validation rule for a schema field
    /// @param schemaId The schema ID
    /// @param fieldId The field ID
    /// @return The validation rule struct
    function getRule(bytes32 schemaId, bytes32 fieldId) external view returns (ValidationRule memory) {
        require(_rules[schemaId][fieldId].exists, "Rule not found");
        return _rules[schemaId][fieldId];
    }

    /// @notice Check if a constraint exists
    /// @param constraintId The constraint ID
    /// @return Whether the constraint is registered
    function constraintExists(bytes32 constraintId) external view returns (bool) {
        return _constraints[constraintId].exists;
    }
}
