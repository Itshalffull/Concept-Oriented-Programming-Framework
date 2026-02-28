// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VercelRuntime
/// @notice Vercel runtime — provisions projects and manages deployments.
contract VercelRuntime {

    // --- Storage ---

    /// @dev project ID => encoded project data
    mapping(bytes32 => bytes) private _projectData;

    /// @dev tracks which project IDs exist
    mapping(bytes32 => bool) private _projectExists;

    /// @dev ordered list of project IDs
    bytes32[] private _projectKeys;

    /// @dev project ID => current deployment ID string
    mapping(bytes32 => string) private _currentDeployment;

    /// @dev project ID => traffic weight
    mapping(bytes32 => int256) private _trafficWeight;

    /// @dev project ID => deployment counter
    mapping(bytes32 => uint256) private _deployCounter;

    // --- Types ---

    struct ProvisionInput {
        string concept;
        string teamId;
        string framework;
    }

    struct ProvisionOkResult {
        bool success;
        bytes32 project;
        string projectId;
        string endpoint;
    }

    struct ProvisionDomainConflictResult {
        bool success;
        string domain;
        string existingProject;
    }

    struct DeployInput {
        bytes32 project;
        string sourceDirectory;
    }

    struct DeployOkResult {
        bool success;
        bytes32 project;
        string deploymentId;
        string deploymentUrl;
    }

    struct DeployBuildFailedResult {
        bool success;
        bytes32 project;
        string[] errors;
    }

    struct SetTrafficWeightInput {
        bytes32 project;
        int256 weight;
    }

    struct SetTrafficWeightOkResult {
        bool success;
        bytes32 project;
    }

    struct RollbackInput {
        bytes32 project;
        string targetDeploymentId;
    }

    struct RollbackOkResult {
        bool success;
        bytes32 project;
        string restoredDeploymentId;
    }

    struct DestroyOkResult {
        bool success;
        bytes32 project;
    }

    // --- Events ---

    event ProvisionCompleted(string variant, bytes32 project);
    event DeployCompleted(string variant, bytes32 project, string[] errors);
    event SetTrafficWeightCompleted(string variant, bytes32 project);
    event RollbackCompleted(string variant, bytes32 project);
    event DestroyCompleted(string variant, bytes32 project);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "vercel";
        category = "runtime";
        capabilities = new string[](5);
        capabilities[0] = "provision";
        capabilities[1] = "deploy";
        capabilities[2] = "setTrafficWeight";
        capabilities[3] = "rollback";
        capabilities[4] = "destroy";
    }

    // --- Actions ---

    /// @notice Provision a Vercel project.
    function provision(string memory concept, string memory teamId, string memory framework) external returns (ProvisionOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(teamId).length > 0, "Team ID must not be empty");

        bytes32 project = keccak256(abi.encodePacked(concept, teamId));

        _projectData[project] = abi.encode(concept, teamId, framework, block.timestamp);
        if (!_projectExists[project]) {
            _projectExists[project] = true;
            _projectKeys.push(project);
            _deployCounter[project] = 0;
            _trafficWeight[project] = 100;
        }

        string memory projectId = string(abi.encodePacked("prj_", concept));
        string memory endpoint = string(abi.encodePacked("https://", concept, ".vercel.app"));

        emit ProvisionCompleted("ok", project);

        return ProvisionOkResult({success: true, project: project, projectId: projectId, endpoint: endpoint});
    }

    /// @notice Deploy a new version to a Vercel project.
    function deploy(bytes32 project, string memory sourceDirectory) external returns (DeployOkResult memory) {
        require(_projectExists[project], "Project not found - provision first");
        require(bytes(sourceDirectory).length > 0, "Source directory must not be empty");

        _deployCounter[project] += 1;
        string memory deploymentId = string(abi.encodePacked("dpl_", _toString(_deployCounter[project])));
        _currentDeployment[project] = deploymentId;
        _projectData[project] = abi.encode(sourceDirectory, deploymentId, block.timestamp);

        string memory deploymentUrl = string(abi.encodePacked("https://", deploymentId, ".vercel.app"));

        string[] memory empty = new string[](0);

        emit DeployCompleted("ok", project, empty);

        return DeployOkResult({success: true, project: project, deploymentId: deploymentId, deploymentUrl: deploymentUrl});
    }

    /// @notice Set the traffic weight for a Vercel project.
    function setTrafficWeight(bytes32 project, int256 weight) external returns (SetTrafficWeightOkResult memory) {
        require(_projectExists[project], "Project not found");
        require(weight >= 0 && weight <= 100, "Weight must be 0-100");

        _trafficWeight[project] = weight;

        emit SetTrafficWeightCompleted("ok", project);

        return SetTrafficWeightOkResult({success: true, project: project});
    }

    /// @notice Rollback a Vercel project to a target deployment.
    function rollback(bytes32 project, string memory targetDeploymentId) external returns (RollbackOkResult memory) {
        require(_projectExists[project], "Project not found");
        require(bytes(targetDeploymentId).length > 0, "Target deployment ID must not be empty");

        _currentDeployment[project] = targetDeploymentId;

        emit RollbackCompleted("ok", project);

        return RollbackOkResult({success: true, project: project, restoredDeploymentId: targetDeploymentId});
    }

    /// @notice Destroy a Vercel project.
    function destroy(bytes32 project) external returns (DestroyOkResult memory) {
        require(_projectExists[project], "Project not found");

        _projectExists[project] = false;
        delete _projectData[project];
        delete _currentDeployment[project];
        delete _trafficWeight[project];

        emit DestroyCompleted("ok", project);

        return DestroyOkResult({success: true, project: project});
    }

    // --- Internal helpers ---

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

}
