// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ProcessVariable
/// @notice Manages scoped variables within process runs.
/// @dev Variables are keyed by composite of run_ref + variable name.

contract ProcessVariable {

    // --- Types ---

    struct VarData {
        string value;
        bool exists;
    }

    struct VarEntry {
        string name;
        string value;
    }

    // --- Storage ---

    /// @dev Composite key: keccak256(abi.encodePacked(runRef, name)) -> VarData
    mapping(bytes32 => VarData) private vars;

    /// @dev Track variable names per run for listing
    mapping(bytes32 => string[]) private runVarNames;
    mapping(bytes32 => mapping(bytes32 => bool)) private runVarNameExists;

    // --- Events ---

    event SetVarCompleted(bytes32 indexed runRef, string name, string value);
    event MergeVarCompleted(bytes32 indexed runRef, string name, string value);
    event DeleteVarCompleted(bytes32 indexed runRef, string name);

    // --- Internal ---

    function _compositeKey(bytes32 runRef, string memory name) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(runRef, name));
    }

    function _nameHash(string memory name) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(name));
    }

    // --- Actions ---

    /// @notice Set a variable value for a run (create or overwrite)
    function setVar(bytes32 runRef, string calldata name, string calldata value) external {
        require(bytes(name).length > 0, "ProcessVariable: name required");

        bytes32 key = _compositeKey(runRef, name);
        bytes32 nameKey = _nameHash(name);

        // Track name for listing if first time
        if (!runVarNameExists[runRef][nameKey]) {
            runVarNames[runRef].push(name);
            runVarNameExists[runRef][nameKey] = true;
        }

        vars[key] = VarData({ value: value, exists: true });

        emit SetVarCompleted(runRef, name, value);
    }

    /// @notice Get a variable's value
    function getVar(bytes32 runRef, string calldata name) external view returns (string memory) {
        bytes32 key = _compositeKey(runRef, name);
        require(vars[key].exists, "ProcessVariable: variable not found");
        return vars[key].value;
    }

    /// @notice Merge (concatenate) a value into an existing variable
    function mergeVar(bytes32 runRef, string calldata name, string calldata appendValue) external {
        bytes32 key = _compositeKey(runRef, name);
        require(vars[key].exists, "ProcessVariable: variable not found for merge");

        string memory current = vars[key].value;
        vars[key].value = string(abi.encodePacked(current, appendValue));

        emit MergeVarCompleted(runRef, name, vars[key].value);
    }

    /// @notice Delete a variable
    function deleteVar(bytes32 runRef, string calldata name) external {
        bytes32 key = _compositeKey(runRef, name);
        require(vars[key].exists, "ProcessVariable: variable not found");

        delete vars[key];

        // Mark as deleted but leave in name list (soft delete for gas efficiency)
        bytes32 nameKey = _nameHash(name);
        runVarNameExists[runRef][nameKey] = false;

        emit DeleteVarCompleted(runRef, name);
    }

    /// @notice List all existing variable entries for a run
    function listVars(bytes32 runRef) external view returns (VarEntry[] memory) {
        string[] memory names = runVarNames[runRef];

        // Count existing vars
        uint256 count = 0;
        for (uint256 i = 0; i < names.length; i++) {
            bytes32 key = _compositeKey(runRef, names[i]);
            if (vars[key].exists) {
                count++;
            }
        }

        // Collect
        VarEntry[] memory result = new VarEntry[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < names.length; i++) {
            bytes32 key = _compositeKey(runRef, names[i]);
            if (vars[key].exists) {
                result[idx] = VarEntry({ name: names[i], value: vars[key].value });
                idx++;
            }
        }

        return result;
    }
}
