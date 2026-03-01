// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ProcessSpec
/// @notice Manages process specification lifecycle: draft, active, deprecated.
/// @dev See Architecture doc for process specification concepts.

contract ProcessSpec {

    // --- Types ---

    enum Status { Draft, Active, Deprecated }

    struct Step {
        bytes32 stepId;
        string name;
    }

    struct Edge {
        bytes32 from;
        bytes32 to;
    }

    struct ProcessSpecData {
        string name;
        uint256 version;
        Status status;
        bytes32[] stepIds;
        mapping(bytes32 => Step) steps;
        Edge[] edges;
        bool exists;
    }

    struct ProcessSpecView {
        string name;
        uint256 version;
        Status status;
        uint256 stepCount;
        uint256 edgeCount;
    }

    struct CreateInput {
        bytes32 specId;
        string name;
        uint256 version;
        bytes32[] stepIds;
        string[] stepNames;
        bytes32[] edgeFroms;
        bytes32[] edgeTos;
    }

    struct UpdateInput {
        bytes32 specId;
        string name;
        bytes32[] stepIds;
        string[] stepNames;
        bytes32[] edgeFroms;
        bytes32[] edgeTos;
    }

    // --- Storage ---

    mapping(bytes32 => ProcessSpecData) private specs;
    bytes32[] private specIds;

    // --- Events ---

    event CreateCompleted(bytes32 indexed specId, string name, uint256 version);
    event PublishCompleted(bytes32 indexed specId);
    event DeprecateCompleted(bytes32 indexed specId);
    event UpdateCompleted(bytes32 indexed specId, string name);
    event GetCompleted(bytes32 indexed specId, string name, uint256 version, uint8 status);

    // --- Actions ---

    /// @notice Create a new process specification in Draft status
    function create(CreateInput calldata input) external {
        require(!specs[input.specId].exists, "ProcessSpec: already exists");
        require(input.stepIds.length == input.stepNames.length, "ProcessSpec: step arrays mismatch");
        require(input.edgeFroms.length == input.edgeTos.length, "ProcessSpec: edge arrays mismatch");
        require(bytes(input.name).length > 0, "ProcessSpec: name required");

        ProcessSpecData storage spec = specs[input.specId];
        spec.name = input.name;
        spec.version = input.version;
        spec.status = Status.Draft;
        spec.exists = true;

        for (uint256 i = 0; i < input.stepIds.length; i++) {
            spec.stepIds.push(input.stepIds[i]);
            spec.steps[input.stepIds[i]] = Step({
                stepId: input.stepIds[i],
                name: input.stepNames[i]
            });
        }

        for (uint256 i = 0; i < input.edgeFroms.length; i++) {
            spec.edges.push(Edge({
                from: input.edgeFroms[i],
                to: input.edgeTos[i]
            }));
        }

        specIds.push(input.specId);

        emit CreateCompleted(input.specId, input.name, input.version);
    }

    /// @notice Publish a draft specification, transitioning it to Active
    function publish(bytes32 specId) external {
        ProcessSpecData storage spec = specs[specId];
        require(spec.exists, "ProcessSpec: not found");
        require(spec.status == Status.Draft, "ProcessSpec: must be Draft to publish");

        spec.status = Status.Active;

        emit PublishCompleted(specId);
    }

    /// @notice Deprecate an active specification
    function deprecate(bytes32 specId) external {
        ProcessSpecData storage spec = specs[specId];
        require(spec.exists, "ProcessSpec: not found");
        require(spec.status == Status.Active, "ProcessSpec: must be Active to deprecate");

        spec.status = Status.Deprecated;

        emit DeprecateCompleted(specId);
    }

    /// @notice Update a draft specification's name, steps, and edges
    function update(UpdateInput calldata input) external {
        ProcessSpecData storage spec = specs[input.specId];
        require(spec.exists, "ProcessSpec: not found");
        require(spec.status == Status.Draft, "ProcessSpec: must be Draft to update");
        require(input.stepIds.length == input.stepNames.length, "ProcessSpec: step arrays mismatch");
        require(input.edgeFroms.length == input.edgeTos.length, "ProcessSpec: edge arrays mismatch");

        spec.name = input.name;

        // Clear existing steps
        for (uint256 i = 0; i < spec.stepIds.length; i++) {
            delete spec.steps[spec.stepIds[i]];
        }
        delete spec.stepIds;
        delete spec.edges;

        // Re-populate
        for (uint256 i = 0; i < input.stepIds.length; i++) {
            spec.stepIds.push(input.stepIds[i]);
            spec.steps[input.stepIds[i]] = Step({
                stepId: input.stepIds[i],
                name: input.stepNames[i]
            });
        }

        for (uint256 i = 0; i < input.edgeFroms.length; i++) {
            spec.edges.push(Edge({
                from: input.edgeFroms[i],
                to: input.edgeTos[i]
            }));
        }

        emit UpdateCompleted(input.specId, input.name);
    }

    /// @notice Retrieve a process specification's view data
    function get(bytes32 specId) external view returns (ProcessSpecView memory) {
        ProcessSpecData storage spec = specs[specId];
        require(spec.exists, "ProcessSpec: not found");

        return ProcessSpecView({
            name: spec.name,
            version: spec.version,
            status: spec.status,
            stepCount: spec.stepIds.length,
            edgeCount: spec.edges.length
        });
    }

    /// @notice Get the step IDs for a given spec
    function getStepIds(bytes32 specId) external view returns (bytes32[] memory) {
        ProcessSpecData storage spec = specs[specId];
        require(spec.exists, "ProcessSpec: not found");
        return spec.stepIds;
    }

    /// @notice Get a specific step by spec ID and step ID
    function getStep(bytes32 specId, bytes32 stepId) external view returns (Step memory) {
        ProcessSpecData storage spec = specs[specId];
        require(spec.exists, "ProcessSpec: not found");
        Step memory step = spec.steps[stepId];
        require(step.stepId != bytes32(0), "ProcessSpec: step not found");
        return step;
    }

    /// @notice Get edges for a given spec
    function getEdges(bytes32 specId) external view returns (Edge[] memory) {
        ProcessSpecData storage spec = specs[specId];
        require(spec.exists, "ProcessSpec: not found");
        return spec.edges;
    }
}
