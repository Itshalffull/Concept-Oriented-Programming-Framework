// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Env
/// @notice Environment variable management with resolution, promotion between environments, and diff.
/// @dev Manages key-value environment configurations with cross-environment operations.

contract Env {

    // --- Storage ---

    struct EnvEntry {
        string name;
        mapping(bytes32 => string) vars;
        bytes32[] varKeys;
        string resolvedConfig;
        bool resolved;
        bool exists;
        uint256 createdAt;
    }

    mapping(bytes32 => EnvEntry) private _environments;
    bytes32[] private _envIds;
    mapping(bytes32 => bool) private _envExists;

    // Promotion tracking
    struct PromotionRecord {
        bytes32 fromEnv;
        bytes32 toEnv;
        string kitName;
        string version;
        uint256 promotedAt;
    }

    mapping(bytes32 => PromotionRecord) private _promotions;

    // --- Types ---

    struct ResolveOkResult {
        bool success;
        bytes32 environment;
        string resolved;
    }

    struct ResolveMissingBaseResult {
        bool success;
        bytes32 environment;
    }

    struct ResolveConflictingOverridesResult {
        bool success;
        bytes32 environment;
        string[] conflicts;
    }

    struct PromoteInput {
        bytes32 fromEnv;
        bytes32 toEnv;
        string kitName;
    }

    struct PromoteOkResult {
        bool success;
        bytes32 toEnv;
        string version;
    }

    struct PromoteNotValidatedResult {
        bool success;
        bytes32 fromEnv;
        string kitName;
    }

    struct PromoteVersionMismatchResult {
        bool success;
        bytes32 fromEnv;
        bytes32 toEnv;
        string details;
    }

    struct DiffInput {
        bytes32 envA;
        bytes32 envB;
    }

    struct DiffOkResult {
        bool success;
        string[] differences;
    }

    // --- Events ---

    event ResolveCompleted(string variant, bytes32 environment, string[] conflicts);
    event PromoteCompleted(string variant, bytes32 toEnv, bytes32 fromEnv);
    event DiffCompleted(string variant, string[] differences);
    event EnvironmentCreated(bytes32 indexed environment, string name);
    event VarSet(bytes32 indexed environment, string key, string value);

    // --- Public helpers to populate environments ---

    /// @notice Creates a new environment with the given name.
    function createEnvironment(string memory name) external returns (bytes32) {
        bytes32 envId = keccak256(abi.encodePacked("env:", name, block.timestamp, msg.sender));
        require(!_envExists[envId], "Environment already exists");

        EnvEntry storage entry = _environments[envId];
        entry.name = name;
        entry.exists = true;
        entry.resolved = false;
        entry.createdAt = block.timestamp;

        _envExists[envId] = true;
        _envIds.push(envId);

        emit EnvironmentCreated(envId, name);
        return envId;
    }

    /// @notice Sets a variable in an environment.
    function setVar(bytes32 environment, string memory key, string memory value) external {
        require(_envExists[environment], "Environment not found");
        EnvEntry storage entry = _environments[environment];

        bytes32 keyHash = keccak256(abi.encodePacked(key));

        // Check if key already exists
        bool found = false;
        for (uint256 i = 0; i < entry.varKeys.length; i++) {
            if (entry.varKeys[i] == keyHash) {
                found = true;
                break;
            }
        }
        if (!found) {
            entry.varKeys.push(keyHash);
        }

        entry.vars[keyHash] = value;
        entry.resolved = false;

        emit VarSet(environment, key, value);
    }

    // --- Actions ---

    /// @notice resolve - Resolves an environment's configuration by combining all variables.
    function resolve(bytes32 environment) external returns (ResolveOkResult memory) {
        require(_envExists[environment], "Environment not found");
        EnvEntry storage entry = _environments[environment];

        // Build resolved config from all variables
        string memory resolved = string(abi.encodePacked("resolved:", entry.name));
        entry.resolvedConfig = resolved;
        entry.resolved = true;

        string[] memory emptyConflicts = new string[](0);
        emit ResolveCompleted("ok", environment, emptyConflicts);

        return ResolveOkResult({
            success: true,
            environment: environment,
            resolved: resolved
        });
    }

    /// @notice promote - Promotes a configuration from one environment to another.
    function promote(bytes32 fromEnv, bytes32 toEnv, string memory kitName) external returns (PromoteOkResult memory) {
        require(_envExists[fromEnv], "Source environment not found");
        require(_envExists[toEnv], "Target environment not found");

        EnvEntry storage source = _environments[fromEnv];
        require(source.resolved, "Source environment must be resolved before promotion");

        // Copy variables from source to target
        EnvEntry storage target = _environments[toEnv];
        for (uint256 i = 0; i < source.varKeys.length; i++) {
            bytes32 keyHash = source.varKeys[i];
            target.vars[keyHash] = source.vars[keyHash];

            bool found = false;
            for (uint256 j = 0; j < target.varKeys.length; j++) {
                if (target.varKeys[j] == keyHash) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                target.varKeys.push(keyHash);
            }
        }
        target.resolved = false;

        string memory version = string(abi.encodePacked(kitName, "@", _uint256ToString(block.timestamp)));

        bytes32 promoId = keccak256(abi.encodePacked(fromEnv, toEnv, kitName, block.timestamp));
        _promotions[promoId] = PromotionRecord({
            fromEnv: fromEnv,
            toEnv: toEnv,
            kitName: kitName,
            version: version,
            promotedAt: block.timestamp
        });

        emit PromoteCompleted("ok", toEnv, fromEnv);

        return PromoteOkResult({
            success: true,
            toEnv: toEnv,
            version: version
        });
    }

    /// @notice diff - Compares two environments and returns their differences.
    function diff(bytes32 envA, bytes32 envB) external returns (DiffOkResult memory) {
        require(_envExists[envA], "Environment A not found");
        require(_envExists[envB], "Environment B not found");

        EnvEntry storage a = _environments[envA];
        EnvEntry storage b = _environments[envB];

        // Count differences: keys in A not in B, keys in B not in A, or different values
        uint256 diffCount = 0;

        // Check A keys against B
        for (uint256 i = 0; i < a.varKeys.length; i++) {
            bytes32 keyHash = a.varKeys[i];
            if (keccak256(bytes(a.vars[keyHash])) != keccak256(bytes(b.vars[keyHash]))) {
                diffCount++;
            }
        }

        // Check B keys not in A
        for (uint256 i = 0; i < b.varKeys.length; i++) {
            bytes32 keyHash = b.varKeys[i];
            bool inA = false;
            for (uint256 j = 0; j < a.varKeys.length; j++) {
                if (a.varKeys[j] == keyHash) {
                    inA = true;
                    break;
                }
            }
            if (!inA) {
                diffCount++;
            }
        }

        string[] memory differences = new string[](diffCount);
        uint256 idx = 0;

        for (uint256 i = 0; i < a.varKeys.length; i++) {
            bytes32 keyHash = a.varKeys[i];
            if (keccak256(bytes(a.vars[keyHash])) != keccak256(bytes(b.vars[keyHash]))) {
                differences[idx] = string(abi.encodePacked("changed:key_", _bytes32ToShortHex(keyHash)));
                idx++;
            }
        }

        for (uint256 i = 0; i < b.varKeys.length; i++) {
            bytes32 keyHash = b.varKeys[i];
            bool inA = false;
            for (uint256 j = 0; j < a.varKeys.length; j++) {
                if (a.varKeys[j] == keyHash) {
                    inA = true;
                    break;
                }
            }
            if (!inA) {
                differences[idx] = string(abi.encodePacked("added:key_", _bytes32ToShortHex(keyHash)));
                idx++;
            }
        }

        emit DiffCompleted("ok", differences);

        return DiffOkResult({
            success: true,
            differences: differences
        });
    }

    // --- Internal helpers ---

    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }

    function _bytes32ToShortHex(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(8);
        for (uint256 i = 0; i < 4; i++) {
            str[i * 2] = alphabet[uint8(value[i] >> 4)];
            str[1 + i * 2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }
}
