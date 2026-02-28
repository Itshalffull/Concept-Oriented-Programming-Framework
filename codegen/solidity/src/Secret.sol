// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Secret
/// @notice Secret management with versioned storage, rotation, and access control.
/// @dev Manages encrypted secrets with provider-scoped resolution, versioning, and cache invalidation.

contract Secret {

    // --- Storage ---

    struct SecretEntry {
        string name;
        string provider;
        bytes32 valueHash;
        string version;
        uint256 createdAt;
        uint256 rotatedAt;
        bool revoked;
        bool cached;
        bool exists;
    }

    mapping(bytes32 => SecretEntry) private _secrets;
    bytes32[] private _secretIds;
    mapping(bytes32 => bool) private _secretExists;

    uint256 private _versionCounter;

    // --- Types ---

    struct ResolveInput {
        string name;
        string provider;
    }

    struct ResolveOkResult {
        bool success;
        bytes32 secret;
        string version;
    }

    struct ResolveNotFoundResult {
        bool success;
        string name;
        string provider;
    }

    struct ResolveAccessDeniedResult {
        bool success;
        string name;
        string provider;
        string reason;
    }

    struct ResolveExpiredResult {
        bool success;
        string name;
        uint256 expiresAt;
    }

    struct ExistsInput {
        string name;
        string provider;
    }

    struct ExistsOkResult {
        bool success;
        string name;
        bool doesExist;
    }

    struct RotateInput {
        string name;
        string provider;
    }

    struct RotateOkResult {
        bool success;
        bytes32 secret;
        string newVersion;
    }

    struct RotateRotationUnsupportedResult {
        bool success;
        string name;
        string provider;
    }

    struct InvalidateCacheOkResult {
        bool success;
        bytes32 secret;
    }

    // --- Events ---

    event ResolveCompleted(string variant, bytes32 secret, uint256 expiresAt);
    event ExistsCompleted(string variant, bool doesExist);
    event RotateCompleted(string variant, bytes32 secret);
    event InvalidateCacheCompleted(string variant, bytes32 secret);
    event SecretStored(bytes32 indexed secret, string name, string provider);

    // --- Public helper to store secrets ---

    /// @notice storeSecret - Stores a new secret with a name and provider.
    function storeSecret(string memory name, string memory provider, bytes memory value) external returns (bytes32) {
        bytes32 secretId = keccak256(abi.encodePacked(name, provider));

        if (_secretExists[secretId]) {
            // Update existing secret with new version
            SecretEntry storage entry = _secrets[secretId];
            _versionCounter++;
            entry.valueHash = keccak256(value);
            entry.version = string(abi.encodePacked("v", _uint256ToString(_versionCounter)));
            entry.rotatedAt = block.timestamp;
            entry.revoked = false;
        } else {
            _versionCounter++;
            _secrets[secretId] = SecretEntry({
                name: name,
                provider: provider,
                valueHash: keccak256(value),
                version: string(abi.encodePacked("v", _uint256ToString(_versionCounter))),
                createdAt: block.timestamp,
                rotatedAt: block.timestamp,
                revoked: false,
                cached: true,
                exists: true
            });
            _secretExists[secretId] = true;
            _secretIds.push(secretId);
        }

        emit SecretStored(secretId, name, provider);
        return secretId;
    }

    // --- Actions ---

    /// @notice resolve - Resolves a secret by name and provider, returning its current version.
    function resolve(string memory name, string memory provider) external returns (ResolveOkResult memory) {
        bytes32 secretId = keccak256(abi.encodePacked(name, provider));
        require(_secretExists[secretId], "Secret not found");

        SecretEntry storage entry = _secrets[secretId];
        require(!entry.revoked, "Secret has been revoked");

        entry.cached = true;

        emit ResolveCompleted("ok", secretId, 0);

        return ResolveOkResult({
            success: true,
            secret: secretId,
            version: entry.version
        });
    }

    /// @notice secretExists - Checks whether a secret exists for the given name and provider.
    /// @dev Named secretExists to avoid collision with Solidity's exists keyword concerns.
    function secretExists(string memory name, string memory provider) external returns (ExistsOkResult memory) {
        bytes32 secretId = keccak256(abi.encodePacked(name, provider));
        bool doesExist = _secretExists[secretId] && !_secrets[secretId].revoked;

        emit ExistsCompleted("ok", doesExist);

        return ExistsOkResult({
            success: true,
            name: name,
            doesExist: doesExist
        });
    }

    /// @notice rotate - Generates a new version of the secret.
    function rotate(string memory name, string memory provider) external returns (RotateOkResult memory) {
        bytes32 secretId = keccak256(abi.encodePacked(name, provider));
        require(_secretExists[secretId], "Secret not found");

        SecretEntry storage entry = _secrets[secretId];
        require(!entry.revoked, "Secret has been revoked");

        _versionCounter++;
        string memory newVersion = string(abi.encodePacked("v", _uint256ToString(_versionCounter)));

        // Generate new value hash (rotation)
        entry.valueHash = keccak256(abi.encodePacked(entry.valueHash, block.timestamp, _versionCounter));
        entry.version = newVersion;
        entry.rotatedAt = block.timestamp;
        entry.cached = false;

        emit RotateCompleted("ok", secretId);

        return RotateOkResult({
            success: true,
            secret: secretId,
            newVersion: newVersion
        });
    }

    /// @notice invalidateCache - Invalidates the cached version of a secret.
    function invalidateCache(string memory name) external returns (InvalidateCacheOkResult memory) {
        // Find secret across all providers
        bytes32 found = bytes32(0);
        for (uint256 i = 0; i < _secretIds.length; i++) {
            bytes32 id = _secretIds[i];
            if (_secretExists[id]) {
                SecretEntry storage entry = _secrets[id];
                if (keccak256(bytes(entry.name)) == keccak256(bytes(name))) {
                    entry.cached = false;
                    found = id;
                    break;
                }
            }
        }
        require(found != bytes32(0), "Secret not found by name");

        emit InvalidateCacheCompleted("ok", found);

        return InvalidateCacheOkResult({
            success: true,
            secret: found
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
}
