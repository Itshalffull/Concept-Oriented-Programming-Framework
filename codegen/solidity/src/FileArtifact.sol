// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FileArtifact
/// @notice File artifact registration and tracking
/// @dev Implements the FileArtifact concept from Clef specification.
///      Supports registering file artifacts with metadata, setting provenance
///      information, finding artifacts by role or generation source, and retrieval.

contract FileArtifact {
    // --- Types ---

    struct ArtifactEntry {
        string node;
        string role;
        string language;
        string encoding;
        string spec;
        string generator;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps artifact ID to its entry
    mapping(bytes32 => ArtifactEntry) private _artifacts;

    /// @dev Ordered list of all artifact IDs
    bytes32[] private _artifactKeys;

    /// @dev Maps node path hash to artifact ID for deduplication
    mapping(bytes32 => bytes32) private _nodeToArtifact;

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 artifact);
    event SetProvenanceCompleted(string variant);
    event FindByRoleCompleted(string variant);
    event FindGeneratedFromCompleted(string variant);
    event GetCompleted(string variant, bytes32 artifact);

    // --- Actions ---

    /// @notice Register a new file artifact
    /// @param node The file path or node identifier
    /// @param role The artifact's role (e.g. "spec", "handler", "test", "generated")
    /// @param language The programming language
    /// @return artifactId The unique identifier for this artifact
    function register(string memory node, string memory role, string memory language) external returns (bytes32 artifactId) {
        require(bytes(node).length > 0, "Node cannot be empty");

        bytes32 nodeHash = keccak256(abi.encodePacked(node));
        artifactId = keccak256(abi.encodePacked(node, role, language));

        // Check if already registered
        require(!_artifacts[artifactId].exists, "Artifact already registered");

        _artifacts[artifactId] = ArtifactEntry({
            node: node,
            role: role,
            language: language,
            encoding: "utf-8",
            spec: "",
            generator: "",
            exists: true
        });

        _nodeToArtifact[nodeHash] = artifactId;
        _artifactKeys.push(artifactId);

        emit RegisterCompleted("ok", artifactId);
        return artifactId;
    }

    /// @notice Set provenance information on a registered artifact
    /// @param artifactId The artifact to update
    /// @param spec The specification file that generated this artifact
    /// @param generator The generator that produced this artifact
    function setProvenance(bytes32 artifactId, string memory spec, string memory generator) external {
        require(_artifacts[artifactId].exists, "Artifact not found");

        _artifacts[artifactId].spec = spec;
        _artifacts[artifactId].generator = generator;

        emit SetProvenanceCompleted("ok");
    }

    /// @notice Find all artifacts with a given role
    /// @param role The role to filter by
    /// @return artifacts Serialized list of matching artifact IDs
    function findByRole(string memory role) external view returns (string memory artifacts) {
        require(bytes(role).length > 0, "Role cannot be empty");

        bytes32 roleHash = keccak256(bytes(role));
        bytes memory buf;
        uint256 found = 0;

        for (uint256 i = 0; i < _artifactKeys.length; i++) {
            bytes32 key = _artifactKeys[i];
            if (_artifacts[key].exists && keccak256(bytes(_artifacts[key].role)) == roleHash) {
                if (found > 0) {
                    buf = abi.encodePacked(buf, ",");
                }
                buf = abi.encodePacked(buf, _artifacts[key].node);
                found++;
            }
        }

        artifacts = string(abi.encodePacked("[", buf, "]"));
        return artifacts;
    }

    /// @notice Find all artifacts generated from a given spec
    /// @param spec The specification file to filter by
    /// @return artifacts Serialized list of matching artifact IDs
    function findGeneratedFrom(string memory spec) external view returns (string memory artifacts) {
        require(bytes(spec).length > 0, "Spec cannot be empty");

        bytes32 specHash = keccak256(bytes(spec));
        bytes memory buf;
        uint256 found = 0;

        for (uint256 i = 0; i < _artifactKeys.length; i++) {
            bytes32 key = _artifactKeys[i];
            if (_artifacts[key].exists && keccak256(bytes(_artifacts[key].spec)) == specHash) {
                if (found > 0) {
                    buf = abi.encodePacked(buf, ",");
                }
                buf = abi.encodePacked(buf, _artifacts[key].node);
                found++;
            }
        }

        artifacts = string(abi.encodePacked("[", buf, "]"));
        return artifacts;
    }

    /// @notice Get detailed information about an artifact
    /// @param artifactId The artifact to look up
    /// @return node The file path
    /// @return role The artifact role
    /// @return language The programming language
    /// @return encoding The file encoding
    function get(bytes32 artifactId) external view returns (string memory node, string memory role, string memory language, string memory encoding) {
        require(_artifacts[artifactId].exists, "Artifact not found");

        ArtifactEntry storage entry = _artifacts[artifactId];
        return (entry.node, entry.role, entry.language, entry.encoding);
    }

    /// @notice Check whether an artifact exists
    /// @param artifactId The artifact to check
    /// @return Whether the artifact exists
    function artifactExists(bytes32 artifactId) external view returns (bool) {
        return _artifacts[artifactId].exists;
    }
}
