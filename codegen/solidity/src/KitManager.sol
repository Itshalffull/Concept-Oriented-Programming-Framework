// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title KitManager
/// @notice Suite (kit) lifecycle manager for Clef projects
/// @dev Implements the KitManager concept from Clef specification.
///      Manages suite initialization, validation, testing, listing, and override checking.

contract KitManager {

    // --- Types ---

    struct KitRecord {
        string name;
        string path;
        int256 concepts;
        int256 syncs;
        uint256 createdAt;
        bool exists;
    }

    struct InitOkResult {
        bool success;
        bytes32 kit;
        string path;
    }

    struct InitAlreadyExistsResult {
        bool success;
        string name;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 kit;
        int256 concepts;
        int256 syncs;
    }

    struct ValidateErrorResult {
        bool success;
        string message;
    }

    struct TestOkResult {
        bool success;
        bytes32 kit;
        int256 passed;
        int256 failed;
    }

    struct TestErrorResult {
        bool success;
        string message;
    }

    struct ListOkResult {
        bool success;
        string[] suites;
    }

    struct CheckOverridesOkResult {
        bool success;
        int256 valid;
        string[] warnings;
    }

    struct CheckOverridesInvalidOverrideResult {
        bool success;
        string overrideName;
        string reason;
    }

    // --- Storage ---

    /// @dev Maps kit ID to its KitRecord
    mapping(bytes32 => KitRecord) private _kits;

    /// @dev Maps name hash to kit ID for duplicate detection
    mapping(bytes32 => bytes32) private _nameToId;

    /// @dev Ordered list of all kit IDs
    bytes32[] private _kitIds;

    /// @dev Ordered list of kit names for listing
    string[] private _kitNames;

    /// @dev Nonce for unique kit ID generation
    uint256 private _nonce;

    // --- Events ---

    event InitCompleted(string variant, bytes32 kit);
    event ValidateCompleted(string variant, bytes32 kit, int256 concepts, int256 syncs);
    event TestCompleted(string variant, bytes32 kit, int256 passed, int256 failed);
    event ListCompleted(string variant, string[] suites);
    event CheckOverridesCompleted(string variant, int256 valid, string[] warnings);

    // --- Actions ---

    /// @notice init - initialises a new suite (kit) by name
    /// @param name The suite name (must be unique)
    /// @return result The init result with kit ID and path
    function init(string memory name) external returns (InitOkResult memory result) {
        require(bytes(name).length > 0, "Name cannot be empty");

        // Check for duplicate kit name
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        require(_nameToId[nameHash] == bytes32(0), "Kit already exists");

        bytes32 kitId = keccak256(abi.encodePacked(name, block.timestamp, _nonce));
        _nonce++;

        string memory path = string(abi.encodePacked("./suites/", name));

        _kits[kitId] = KitRecord({
            name: name,
            path: path,
            concepts: 0,
            syncs: 0,
            createdAt: block.timestamp,
            exists: true
        });
        _nameToId[nameHash] = kitId;
        _kitIds.push(kitId);
        _kitNames.push(name);

        result = InitOkResult({
            success: true,
            kit: kitId,
            path: path
        });

        emit InitCompleted("ok", kitId);
    }

    /// @notice validate - validates a suite at the given path
    /// @param path The path to the suite to validate
    /// @return result The validation result with concept and sync counts
    function validate(string memory path) external returns (ValidateOkResult memory result) {
        require(bytes(path).length > 0, "Path cannot be empty");

        bytes32 pathHash = keccak256(abi.encodePacked(path));

        // Look up or derive a kit ID from the path
        bytes32 kitId = keccak256(abi.encodePacked(path, "validate"));

        // Simulated validation: count concepts and syncs from the path hash
        int256 concepts = int256(uint256(pathHash) % 20) + 1;
        int256 syncs = int256(uint256(pathHash) % 10);

        result = ValidateOkResult({
            success: true,
            kit: kitId,
            concepts: concepts,
            syncs: syncs
        });

        emit ValidateCompleted("ok", kitId, concepts, syncs);
    }

    /// @notice runTests - runs tests for a suite at the given path
    /// @param path The path to the suite to test
    /// @return result The test result with pass/fail counts
    function runTests(string memory path) external returns (TestOkResult memory result) {
        require(bytes(path).length > 0, "Path cannot be empty");

        bytes32 kitId = keccak256(abi.encodePacked(path, "test"));

        // Simulated test execution
        int256 passed = int256(uint256(keccak256(abi.encodePacked(path))) % 50) + 1;
        int256 failed = int256(0);

        result = TestOkResult({
            success: true,
            kit: kitId,
            passed: passed,
            failed: failed
        });

        emit TestCompleted("ok", kitId, passed, failed);
    }

    /// @notice list - returns all registered suite names
    /// @return result The list result with suite names
    function list() external returns (ListOkResult memory result) {
        result = ListOkResult({
            success: true,
            suites: _kitNames
        });

        emit ListCompleted("ok", _kitNames);
    }

    /// @notice checkOverrides - validates overrides for a suite at the given path
    /// @param path The path to the suite to check overrides for
    /// @return result The check result with valid count and any warnings
    function checkOverrides(string memory path) external returns (CheckOverridesOkResult memory result) {
        require(bytes(path).length > 0, "Path cannot be empty");

        // Simulated override checking: all overrides valid, no warnings
        string[] memory warnings = new string[](0);
        int256 valid = int256(uint256(keccak256(abi.encodePacked(path))) % 10) + 1;

        result = CheckOverridesOkResult({
            success: true,
            valid: valid,
            warnings: warnings
        });

        emit CheckOverridesCompleted("ok", valid, warnings);
    }

    // --- Views ---

    /// @notice Retrieve a kit record by ID
    /// @param kitId The kit ID to look up
    /// @return name The kit name
    /// @return path The kit path
    function getKit(bytes32 kitId) external view returns (string memory name, string memory path) {
        require(_kits[kitId].exists, "Kit not found");
        KitRecord storage rec = _kits[kitId];
        return (rec.name, rec.path);
    }

    /// @notice Check if a kit exists by name
    /// @param name The kit name to check
    /// @return Whether the kit exists
    function kitExists(string memory name) external view returns (bool) {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        return _nameToId[nameHash] != bytes32(0);
    }

    /// @notice Get the total number of registered kits
    /// @return The number of kits
    function kitCount() external view returns (uint256) {
        return _kitIds.length;
    }
}
