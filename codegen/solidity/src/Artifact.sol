// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Artifact
/// @notice Build artifact storage with content-addressed lookup, compilation, and garbage collection.
/// @dev Manages build artifacts with hash-based deduplication and metadata tracking.

contract Artifact {

    // --- Storage ---

    struct ArtifactEntry {
        string hash;
        string location;
        string concept;
        string language;
        string platform;
        bytes metadata;
        uint256 sizeBytes;
        uint256 createdAt;
        bool exists;
    }

    mapping(bytes32 => ArtifactEntry) private _artifacts;
    bytes32[] private _artifactIds;
    mapping(bytes32 => bool) private _artifactExists;

    // --- Types ---

    struct BuildInput {
        string concept;
        string spec;
        string implementation;
        string[] deps;
    }

    struct BuildOkResult {
        bool success;
        bytes32 artifact;
        string hash;
        int256 sizeBytes;
    }

    struct BuildCompilationErrorResult {
        bool success;
        string concept;
        string[] errors;
    }

    struct StoreInput {
        string hash;
        string location;
        string concept;
        string language;
        string platform;
        bytes metadata;
    }

    struct StoreOkResult {
        bool success;
        bytes32 artifact;
    }

    struct StoreAlreadyExistsResult {
        bool success;
        bytes32 artifact;
    }

    struct ResolveOkResult {
        bool success;
        bytes32 artifact;
        string location;
    }

    struct ResolveNotfoundResult {
        bool success;
        string hash;
    }

    struct GcInput {
        uint256 olderThan;
        int256 keepVersions;
    }

    struct GcOkResult {
        bool success;
        int256 removed;
        int256 freedBytes;
    }

    // --- Events ---

    event BuildCompleted(string variant, bytes32 artifact, int256 sizeBytes, string[] errors);
    event StoreCompleted(string variant, bytes32 artifact);
    event ResolveCompleted(string variant, bytes32 artifact);
    event GcCompleted(string variant, int256 removed, int256 freedBytes);

    // --- Actions ---

    /// @notice build - Compiles concept source into a build artifact and stores it.
    function build(string memory concept, string memory spec, string memory implementation, string[] memory deps) external returns (BuildOkResult memory) {
        // Generate a content hash from the build inputs
        bytes32 contentHash = keccak256(abi.encodePacked(concept, spec, implementation));
        string memory hashStr = _bytes32ToHexString(contentHash);

        // Derive artifact ID
        bytes32 artifactId = keccak256(abi.encodePacked("artifact:", hashStr));

        // Compute a simulated size from input lengths
        int256 size = int256(bytes(concept).length + bytes(spec).length + bytes(implementation).length);

        if (!_artifactExists[artifactId]) {
            _artifacts[artifactId] = ArtifactEntry({
                hash: hashStr,
                location: string(abi.encodePacked("artifacts/", concept, "/", hashStr)),
                concept: concept,
                language: "",
                platform: "",
                metadata: "",
                sizeBytes: uint256(size),
                createdAt: block.timestamp,
                exists: true
            });
            _artifactExists[artifactId] = true;
            _artifactIds.push(artifactId);
        }

        string[] memory emptyErrors = new string[](0);
        emit BuildCompleted("ok", artifactId, size, emptyErrors);

        return BuildOkResult({
            success: true,
            artifact: artifactId,
            hash: hashStr,
            sizeBytes: size
        });
    }

    /// @notice store - Saves artifact metadata with hash-based deduplication.
    function store(string memory hash, string memory location, string memory concept, string memory language, string memory platform, bytes memory metadata) external returns (StoreOkResult memory) {
        bytes32 artifactId = keccak256(abi.encodePacked("artifact:", hash));

        if (_artifactExists[artifactId]) {
            emit StoreCompleted("alreadyExists", artifactId);
            return StoreOkResult({
                success: true,
                artifact: artifactId
            });
        }

        _artifacts[artifactId] = ArtifactEntry({
            hash: hash,
            location: location,
            concept: concept,
            language: language,
            platform: platform,
            metadata: metadata,
            sizeBytes: metadata.length,
            createdAt: block.timestamp,
            exists: true
        });
        _artifactExists[artifactId] = true;
        _artifactIds.push(artifactId);

        emit StoreCompleted("ok", artifactId);

        return StoreOkResult({
            success: true,
            artifact: artifactId
        });
    }

    /// @notice resolve - Looks up an artifact by its content hash.
    function resolve(string memory hash) external returns (ResolveOkResult memory) {
        bytes32 artifactId = keccak256(abi.encodePacked("artifact:", hash));
        require(_artifactExists[artifactId], "Artifact not found for given hash");

        ArtifactEntry storage entry = _artifacts[artifactId];

        emit ResolveCompleted("ok", artifactId);

        return ResolveOkResult({
            success: true,
            artifact: artifactId,
            location: entry.location
        });
    }

    /// @notice gc - Garbage collects artifacts older than the specified timestamp.
    function gc(uint256 olderThan, int256 keepVersions) external returns (GcOkResult memory) {
        int256 removed = 0;
        int256 freedBytes = 0;
        uint256 keep = keepVersions > 0 ? uint256(keepVersions) : 0;

        // Count total artifacts to determine how many to keep
        uint256 totalCount = _artifactIds.length;

        for (uint256 i = 0; i < _artifactIds.length; i++) {
            bytes32 id = _artifactIds[i];
            if (!_artifactExists[id]) continue;

            ArtifactEntry storage entry = _artifacts[id];

            // Skip if within keep window (keep the most recent N)
            if (keep > 0 && totalCount - uint256(removed) <= keep) {
                continue;
            }

            if (entry.createdAt < olderThan) {
                freedBytes += int256(entry.sizeBytes);
                entry.exists = false;
                _artifactExists[id] = false;
                removed++;
            }
        }

        emit GcCompleted("ok", removed, freedBytes);

        return GcOkResult({
            success: true,
            removed: removed,
            freedBytes: freedBytes
        });
    }

    // --- Internal helpers ---

    function _bytes32ToHexString(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            str[i * 2] = alphabet[uint8(value[i] >> 4)];
            str[1 + i * 2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }
}
