// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Middleware
/// @notice Generated from Middleware concept specification
/// @dev Manages interface middleware registration, resolution, and injection

contract Middleware {

    // --- Storage ---

    struct MiddlewareInfo {
        string traitName;
        string target;
        string implementation;
        string position;
        uint256 created;
        bool exists;
    }

    mapping(bytes32 => MiddlewareInfo) private _definitions;
    bytes32[] private _definitionKeys;

    // (trait, target) -> middleware ID for fast lookup
    mapping(bytes32 => bytes32) private _traitTargetIndex;
    mapping(bytes32 => bool) private _traitTargetExists;

    uint256 private _nonce;

    // --- Types ---

    struct ResolveInput {
        string[] traits;
        string target;
    }

    struct ResolveOkResult {
        bool success;
        string[] middlewares;
        int256[] order;
    }

    struct ResolveMissingImplementationResult {
        bool success;
        string trait;
        string target;
    }

    struct ResolveIncompatibleTraitsResult {
        bool success;
        string trait1;
        string trait2;
        string reason;
    }

    struct InjectInput {
        string output;
        string[] middlewares;
        string target;
    }

    struct InjectOkResult {
        bool success;
        string output;
        int256 injectedCount;
    }

    struct RegisterInput {
        string trait;
        string target;
        string implementation;
        string position;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 middleware;
    }

    struct RegisterDuplicateRegistrationResult {
        bool success;
        string trait;
        string target;
    }

    // --- Events ---

    event ResolveCompleted(string variant, string[] middlewares, int256[] order);
    event InjectCompleted(string variant, int256 injectedCount);
    event RegisterCompleted(string variant, bytes32 middleware);

    // --- Actions ---

    /// @notice resolve
    function resolve(string[] memory traits, string memory target) external returns (ResolveOkResult memory) {
        require(traits.length > 0, "Traits must not be empty");
        require(bytes(target).length > 0, "Target must not be empty");

        string[] memory middlewares = new string[](traits.length);
        int256[] memory order = new int256[](traits.length);

        for (uint256 i = 0; i < traits.length; i++) {
            bytes32 lookupKey = keccak256(abi.encodePacked(traits[i], target));
            require(_traitTargetExists[lookupKey], "Missing implementation for trait");

            bytes32 middlewareId = _traitTargetIndex[lookupKey];
            middlewares[i] = _definitions[middlewareId].implementation;
            order[i] = int256(i);
        }

        emit ResolveCompleted("ok", middlewares, order);

        return ResolveOkResult({
            success: true,
            middlewares: middlewares,
            order: order
        });
    }

    /// @notice inject
    function inject(string memory output, string[] memory middlewares, string memory target) external returns (InjectOkResult memory) {
        require(bytes(output).length > 0, "Output must not be empty");
        require(bytes(target).length > 0, "Target must not be empty");

        // Build the injected output by wrapping with middleware calls
        string memory injectedOutput = output;
        for (uint256 i = 0; i < middlewares.length; i++) {
            injectedOutput = string(abi.encodePacked(
                middlewares[i], "(", injectedOutput, ")"
            ));
        }

        int256 injectedCount = int256(middlewares.length);

        emit InjectCompleted("ok", injectedCount);

        return InjectOkResult({
            success: true,
            output: injectedOutput,
            injectedCount: injectedCount
        });
    }

    /// @notice register
    function register(string memory traitName, string memory target, string memory implementation, string memory position) external returns (RegisterOkResult memory) {
        require(bytes(traitName).length > 0, "Trait must not be empty");
        require(bytes(target).length > 0, "Target must not be empty");
        require(bytes(implementation).length > 0, "Implementation must not be empty");
        require(bytes(position).length > 0, "Position must not be empty");

        // Check for duplicate registrations
        bytes32 lookupKey = keccak256(abi.encodePacked(traitName, target));
        require(!_traitTargetExists[lookupKey], "Middleware already registered for this trait and target");

        bytes32 middlewareId = keccak256(abi.encodePacked(traitName, target, block.timestamp, _nonce++));

        _definitions[middlewareId] = MiddlewareInfo({
            traitName: traitName,
            target: target,
            implementation: implementation,
            position: position,
            created: block.timestamp,
            exists: true
        });
        _definitionKeys.push(middlewareId);

        _traitTargetIndex[lookupKey] = middlewareId;
        _traitTargetExists[lookupKey] = true;

        emit RegisterCompleted("ok", middlewareId);

        return RegisterOkResult({
            success: true,
            middleware: middlewareId
        });
    }

}
