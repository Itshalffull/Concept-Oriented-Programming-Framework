// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Component
/// @notice Concept-oriented component registry with placement and visibility management
/// @dev Implements the Component concept from Clef specification.
///      Supports registering components, placing them in regions with weights,
///      and setting visibility conditions.

contract Component {
    // --- Types ---

    struct ComponentData {
        string config;
        bool exists;
    }

    struct Placement {
        bytes32 componentId;
        string region;
        int256 weight;
        string conditions;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps component ID to its configuration
    mapping(bytes32 => ComponentData) private _components;

    /// @dev Maps placement ID to its placement data
    mapping(bytes32 => Placement) private _placements;

    // --- Events ---

    event ComponentRegistered(bytes32 indexed componentId);
    event Placed(bytes32 indexed placementId, bytes32 indexed componentId, string region);
    event VisibilitySet(bytes32 indexed placementId);

    // --- Actions ---

    /// @notice Register a new component
    /// @param componentId The unique identifier for the component
    /// @param config The component's configuration data
    function register(bytes32 componentId, string calldata config) external {
        require(componentId != bytes32(0), "Component ID cannot be zero");
        require(!_components[componentId].exists, "Component already exists");

        _components[componentId] = ComponentData({
            config: config,
            exists: true
        });

        emit ComponentRegistered(componentId);
    }

    /// @notice Place a component in a region with a weight
    /// @param placementId The unique identifier for this placement
    /// @param componentId The component to place
    /// @param region The region to place the component in
    /// @param weight The ordering weight (higher = later)
    function place(
        bytes32 placementId,
        bytes32 componentId,
        string calldata region,
        int256 weight
    ) external {
        require(placementId != bytes32(0), "Placement ID cannot be zero");
        require(_components[componentId].exists, "Component not found");
        require(bytes(region).length > 0, "Region cannot be empty");

        _placements[placementId] = Placement({
            componentId: componentId,
            region: region,
            weight: weight,
            conditions: "",
            exists: true
        });

        emit Placed(placementId, componentId, region);
    }

    /// @notice Set visibility conditions for a placement
    /// @param placementId The placement ID to update
    /// @param conditions The visibility condition expression
    function setVisibility(bytes32 placementId, string calldata conditions) external {
        require(_placements[placementId].exists, "Placement not found");

        _placements[placementId].conditions = conditions;

        emit VisibilitySet(placementId);
    }

    // --- Views ---

    /// @notice Retrieve a component's data
    /// @param componentId The component ID
    /// @return The component data struct
    function getComponent(bytes32 componentId) external view returns (ComponentData memory) {
        require(_components[componentId].exists, "Component not found");
        return _components[componentId];
    }

    /// @notice Retrieve a placement's data
    /// @param placementId The placement ID
    /// @return The placement data struct
    function getPlacement(bytes32 placementId) external view returns (Placement memory) {
        require(_placements[placementId].exists, "Placement not found");
        return _placements[placementId];
    }
}
