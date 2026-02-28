// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ProjectScaffold
/// @notice Project scaffolding manager for Clef projects
/// @dev Implements the ProjectScaffold concept from Clef specification.
///      Creates new project scaffolds with unique IDs and prevents duplicate names.

contract ProjectScaffold {

    // --- Types ---

    struct ProjectRecord {
        string name;
        string path;
        uint256 createdAt;
        bool exists;
    }

    struct ScaffoldOkResult {
        bool success;
        bytes32 project;
        string path;
    }

    struct ScaffoldAlreadyExistsResult {
        bool success;
        string name;
    }

    // --- Storage ---

    /// @dev Maps project ID to its ProjectRecord
    mapping(bytes32 => ProjectRecord) private _projects;

    /// @dev Maps name hash to project ID for duplicate detection
    mapping(bytes32 => bytes32) private _nameToId;

    /// @dev Ordered list of all project IDs
    bytes32[] private _projectIds;

    /// @dev Nonce for unique project ID generation
    uint256 private _nonce;

    // --- Events ---

    event ScaffoldCompleted(string variant, bytes32 project);

    // --- Actions ---

    /// @notice scaffold - creates a new project scaffold
    /// @param name The project name (must be unique)
    /// @return result The scaffold result with project ID and path
    function scaffold(string memory name) external returns (ScaffoldOkResult memory result) {
        require(bytes(name).length > 0, "Name cannot be empty");

        // Check for duplicate project name
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        require(_nameToId[nameHash] == bytes32(0), "Project already exists");

        bytes32 projectId = keccak256(abi.encodePacked(name, block.timestamp, _nonce));
        _nonce++;

        string memory path = string(abi.encodePacked("./", name));

        _projects[projectId] = ProjectRecord({
            name: name,
            path: path,
            createdAt: block.timestamp,
            exists: true
        });
        _nameToId[nameHash] = projectId;
        _projectIds.push(projectId);

        result = ScaffoldOkResult({
            success: true,
            project: projectId,
            path: path
        });

        emit ScaffoldCompleted("ok", projectId);
    }

    // --- Views ---

    /// @notice Retrieve a project record by ID
    /// @param projectId The project ID to look up
    /// @return name The project name
    /// @return path The project path
    function getProject(bytes32 projectId) external view returns (string memory name, string memory path) {
        require(_projects[projectId].exists, "Project not found");
        ProjectRecord storage rec = _projects[projectId];
        return (rec.name, rec.path);
    }

    /// @notice Check if a project exists by name
    /// @param name The project name to check
    /// @return Whether the project exists
    function projectExists(string memory name) external view returns (bool) {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        return _nameToId[nameHash] != bytes32(0);
    }

    /// @notice List all project IDs
    /// @return The array of project IDs
    function list() external view returns (bytes32[] memory) {
        return _projectIds;
    }
}
