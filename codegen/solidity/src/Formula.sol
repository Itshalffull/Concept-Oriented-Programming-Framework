// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Formula
/// @notice Concept-oriented formula management with expression caching and invalidation
/// @dev Implements the Formula concept from Clef specification.
///      Supports setting expressions with dependencies, caching results, and invalidation.

contract Formula {
    // --- Types ---

    struct FormulaData {
        string expression;
        string dependencies;
        string cachedResult;
        uint256 lastEvaluated;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps formula ID to its full data
    mapping(bytes32 => FormulaData) private _formulas;

    // --- Events ---

    event FormulaSet(bytes32 indexed formulaId);
    event FormulaEvaluated(bytes32 indexed formulaId);
    event FormulaInvalidated(bytes32 indexed formulaId);

    // --- Actions ---

    /// @notice Set or update a formula expression and its dependencies
    /// @param formulaId The unique identifier for this formula
    /// @param expression The formula expression string
    /// @param dependencies Comma-separated list of dependency identifiers
    function setExpression(bytes32 formulaId, string calldata expression, string calldata dependencies) external {
        require(formulaId != bytes32(0), "Formula ID cannot be zero");
        require(bytes(expression).length > 0, "Expression cannot be empty");

        _formulas[formulaId] = FormulaData({
            expression: expression,
            dependencies: dependencies,
            cachedResult: "",
            lastEvaluated: 0,
            exists: true
        });

        emit FormulaSet(formulaId);
    }

    /// @notice Cache a computed result for a formula
    /// @param formulaId The formula ID to cache a result for
    /// @param result The computed result to cache
    function cacheResult(bytes32 formulaId, string calldata result) external {
        require(_formulas[formulaId].exists, "Formula not found");

        FormulaData storage f = _formulas[formulaId];
        f.cachedResult = result;
        f.lastEvaluated = block.timestamp;

        emit FormulaEvaluated(formulaId);
    }

    /// @notice Invalidate a formula's cached result
    /// @param formulaId The formula ID to invalidate
    function invalidate(bytes32 formulaId) external {
        require(_formulas[formulaId].exists, "Formula not found");

        _formulas[formulaId].cachedResult = "";
        _formulas[formulaId].lastEvaluated = 0;

        emit FormulaInvalidated(formulaId);
    }

    // --- Views ---

    /// @notice Retrieve a formula's full data
    /// @param formulaId The formula ID
    /// @return The full formula data struct
    function getFormula(bytes32 formulaId) external view returns (FormulaData memory) {
        require(_formulas[formulaId].exists, "Formula not found");
        return _formulas[formulaId];
    }

    /// @notice Check if a formula exists
    /// @param formulaId The formula ID
    /// @return Whether the formula exists
    function formulaExists(bytes32 formulaId) external view returns (bool) {
        return _formulas[formulaId].exists;
    }
}
