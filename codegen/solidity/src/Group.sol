// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Group
/// @notice Concept-oriented group management with membership roles and content association
/// @dev Implements the Group concept from COPF specification.
///      Supports creating groups, managing members with roles, and associating content.

contract Group {
    // --- Types ---

    struct GroupData {
        string name;
        string groupType;
        bool exists;
    }

    struct Membership {
        bytes32 role;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps group ID to its data
    mapping(bytes32 => GroupData) private _groups;

    /// @dev Maps group ID -> user ID -> membership data
    mapping(bytes32 => mapping(bytes32 => Membership)) private _memberships;

    /// @dev Maps group ID to array of member user IDs
    mapping(bytes32 => bytes32[]) private _groupMembers;

    /// @dev Maps group ID -> node ID -> whether node belongs to the group
    mapping(bytes32 => mapping(bytes32 => bool)) private _groupContent;

    // --- Events ---

    event GroupCreated(bytes32 indexed groupId);
    event MemberAdded(bytes32 indexed groupId, bytes32 indexed userId);
    event ContentAdded(bytes32 indexed groupId, bytes32 indexed nodeId);

    // --- Actions ---

    /// @notice Create a new group
    /// @param groupId The unique identifier for the group
    /// @param name The human-readable group name
    /// @param groupType The type of group (e.g., "team", "project", "community")
    function createGroup(bytes32 groupId, string calldata name, string calldata groupType) external {
        require(groupId != bytes32(0), "Group ID cannot be zero");
        require(!_groups[groupId].exists, "Group already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _groups[groupId] = GroupData({
            name: name,
            groupType: groupType,
            exists: true
        });

        emit GroupCreated(groupId);
    }

    /// @notice Add a member to a group with a role
    /// @param groupId The group ID
    /// @param userId The user to add
    /// @param role The role hash for the member
    function addMember(bytes32 groupId, bytes32 userId, bytes32 role) external {
        require(_groups[groupId].exists, "Group not found");
        require(userId != bytes32(0), "User ID cannot be zero");
        require(!_memberships[groupId][userId].exists, "Member already exists");

        _memberships[groupId][userId] = Membership({
            role: role,
            exists: true
        });

        _groupMembers[groupId].push(userId);

        emit MemberAdded(groupId, userId);
    }

    /// @notice Associate content (a node) with a group
    /// @param groupId The group ID
    /// @param nodeId The node ID to associate
    function addContent(bytes32 groupId, bytes32 nodeId) external {
        require(_groups[groupId].exists, "Group not found");
        require(nodeId != bytes32(0), "Node ID cannot be zero");
        require(!_groupContent[groupId][nodeId], "Content already added");

        _groupContent[groupId][nodeId] = true;

        emit ContentAdded(groupId, nodeId);
    }

    // --- Views ---

    /// @notice Check if a user is a member of a group
    /// @param groupId The group ID
    /// @param userId The user ID
    /// @return Whether the user is a member
    function isMember(bytes32 groupId, bytes32 userId) external view returns (bool) {
        return _memberships[groupId][userId].exists;
    }

    /// @notice Retrieve a group's data
    /// @param groupId The group ID
    /// @return The group data struct
    function getGroup(bytes32 groupId) external view returns (GroupData memory) {
        require(_groups[groupId].exists, "Group not found");
        return _groups[groupId];
    }

    /// @notice Get a member's role in a group
    /// @param groupId The group ID
    /// @param userId The user ID
    /// @return The role hash
    function getMemberRole(bytes32 groupId, bytes32 userId) external view returns (bytes32) {
        require(_memberships[groupId][userId].exists, "Member not found");
        return _memberships[groupId][userId].role;
    }

    /// @notice Check if a node is associated content of a group
    /// @param groupId The group ID
    /// @param nodeId The node ID
    /// @return Whether the node is group content
    function isContent(bytes32 groupId, bytes32 nodeId) external view returns (bool) {
        return _groupContent[groupId][nodeId];
    }
}
