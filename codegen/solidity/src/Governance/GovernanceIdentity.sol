// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GovernanceIdentity
/// @notice Membership, role-based access control, and permission management for governance participants
/// @dev Implements the Membership, Role, and Permission concepts from Clef specification.
///      Membership tracks join/leave/suspend/kick lifecycle. Role provides RBAC assign/revoke.
///      Permission enforces a who/where/what grant model for fine-grained access.

contract GovernanceIdentity {
    // --- Types ---

    enum MemberStatus { None, Active, Suspended, Left, Kicked }

    struct Member {
        address addr;
        MemberStatus status;
        uint256 joinedAt;
        uint256 updatedAt;
        bool exists;
    }

    struct Role {
        string name;
        string description;
        bool exists;
    }

    /// @dev Permission grant: who (role) can do what (action) where (resource)
    struct PermissionGrant {
        bytes32 roleId;
        bytes32 resource;   // "where" — the resource or scope
        bytes32 action;     // "what" — the permitted action
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps member ID -> Member record
    mapping(bytes32 => Member) private _members;

    /// @dev Maps role ID -> Role definition
    mapping(bytes32 => Role) private _roles;

    /// @dev Maps member ID -> role ID -> whether assigned
    mapping(bytes32 => mapping(bytes32 => bool)) private _memberRoles;

    /// @dev Maps member ID -> list of role IDs for enumeration
    mapping(bytes32 => bytes32[]) private _memberRoleList;

    /// @dev Permission grant key (keccak256(roleId, resource, action)) -> PermissionGrant
    mapping(bytes32 => PermissionGrant) private _permissions;

    /// @dev Counter for total active members
    uint256 private _activeMemberCount;

    // --- Events ---

    event MemberJoined(bytes32 indexed memberId, address addr);
    event MemberLeft(bytes32 indexed memberId);
    event MemberSuspended(bytes32 indexed memberId);
    event MemberKicked(bytes32 indexed memberId);
    event MemberReinstated(bytes32 indexed memberId);

    event RoleCreated(bytes32 indexed roleId, string name);
    event RoleAssigned(bytes32 indexed memberId, bytes32 indexed roleId);
    event RoleRevoked(bytes32 indexed memberId, bytes32 indexed roleId);

    event PermissionGranted(bytes32 indexed roleId, bytes32 resource, bytes32 action);
    event PermissionRevokedGrant(bytes32 indexed roleId, bytes32 resource, bytes32 action);

    // --- Membership Actions ---

    /// @notice Register a new member
    /// @param memberId Unique identifier for the member
    /// @param addr The member's address
    function join(bytes32 memberId, address addr) external {
        require(memberId != bytes32(0), "Member ID cannot be zero");
        require(addr != address(0), "Address cannot be zero");
        require(!_members[memberId].exists, "Member already exists");

        _members[memberId] = Member({
            addr: addr,
            status: MemberStatus.Active,
            joinedAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true
        });
        _activeMemberCount++;

        emit MemberJoined(memberId, addr);
    }

    /// @notice Voluntary departure by a member
    /// @param memberId The member leaving
    function leave(bytes32 memberId) external {
        require(_members[memberId].exists, "Member not found");
        require(_members[memberId].status == MemberStatus.Active, "Member not active");

        _members[memberId].status = MemberStatus.Left;
        _members[memberId].updatedAt = block.timestamp;
        _activeMemberCount--;

        emit MemberLeft(memberId);
    }

    /// @notice Suspend a member (reversible)
    /// @param memberId The member to suspend
    function suspend(bytes32 memberId) external {
        require(_members[memberId].exists, "Member not found");
        require(_members[memberId].status == MemberStatus.Active, "Member not active");

        _members[memberId].status = MemberStatus.Suspended;
        _members[memberId].updatedAt = block.timestamp;
        _activeMemberCount--;

        emit MemberSuspended(memberId);
    }

    /// @notice Kick a member (permanent removal)
    /// @param memberId The member to kick
    function kick(bytes32 memberId) external {
        require(_members[memberId].exists, "Member not found");
        MemberStatus s = _members[memberId].status;
        require(s == MemberStatus.Active || s == MemberStatus.Suspended, "Member not active or suspended");

        if (s == MemberStatus.Active) {
            _activeMemberCount--;
        }

        _members[memberId].status = MemberStatus.Kicked;
        _members[memberId].updatedAt = block.timestamp;

        emit MemberKicked(memberId);
    }

    /// @notice Reinstate a suspended member
    /// @param memberId The member to reinstate
    function reinstate(bytes32 memberId) external {
        require(_members[memberId].exists, "Member not found");
        require(_members[memberId].status == MemberStatus.Suspended, "Member not suspended");

        _members[memberId].status = MemberStatus.Active;
        _members[memberId].updatedAt = block.timestamp;
        _activeMemberCount++;

        emit MemberReinstated(memberId);
    }

    // --- Role Actions ---

    /// @notice Create a new role
    /// @param roleId Unique identifier for the role
    /// @param name Human-readable role name
    /// @param description Role description
    function createRole(bytes32 roleId, string calldata name, string calldata description) external {
        require(roleId != bytes32(0), "Role ID cannot be zero");
        require(!_roles[roleId].exists, "Role already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _roles[roleId] = Role({ name: name, description: description, exists: true });

        emit RoleCreated(roleId, name);
    }

    /// @notice Assign a role to a member
    /// @param memberId The member to assign the role to
    /// @param roleId The role to assign
    function assignRole(bytes32 memberId, bytes32 roleId) external {
        require(_members[memberId].exists, "Member not found");
        require(_members[memberId].status == MemberStatus.Active, "Member not active");
        require(_roles[roleId].exists, "Role not found");
        require(!_memberRoles[memberId][roleId], "Role already assigned");

        _memberRoles[memberId][roleId] = true;
        _memberRoleList[memberId].push(roleId);

        emit RoleAssigned(memberId, roleId);
    }

    /// @notice Revoke a role from a member
    /// @param memberId The member to revoke the role from
    /// @param roleId The role to revoke
    function revokeRole(bytes32 memberId, bytes32 roleId) external {
        require(_members[memberId].exists, "Member not found");
        require(_memberRoles[memberId][roleId], "Role not assigned");

        _memberRoles[memberId][roleId] = false;

        emit RoleRevoked(memberId, roleId);
    }

    // --- Permission Actions ---

    /// @notice Grant a permission: who (role) can do what (action) where (resource)
    /// @param roleId The role receiving the permission
    /// @param resource The resource scope identifier
    /// @param action The action identifier
    function grantPermission(bytes32 roleId, bytes32 resource, bytes32 action) external {
        require(_roles[roleId].exists, "Role not found");
        require(resource != bytes32(0), "Resource cannot be zero");
        require(action != bytes32(0), "Action cannot be zero");

        bytes32 key = keccak256(abi.encodePacked(roleId, resource, action));
        require(!_permissions[key].exists, "Permission already granted");

        _permissions[key] = PermissionGrant({
            roleId: roleId,
            resource: resource,
            action: action,
            exists: true
        });

        emit PermissionGranted(roleId, resource, action);
    }

    /// @notice Revoke a permission grant
    /// @param roleId The role losing the permission
    /// @param resource The resource scope identifier
    /// @param action The action identifier
    function revokePermission(bytes32 roleId, bytes32 resource, bytes32 action) external {
        bytes32 key = keccak256(abi.encodePacked(roleId, resource, action));
        require(_permissions[key].exists, "Permission not found");

        delete _permissions[key];

        emit PermissionRevokedGrant(roleId, resource, action);
    }

    // --- Views ---

    /// @notice Get member details
    /// @param memberId The member ID
    /// @return The Member struct
    function getMember(bytes32 memberId) external view returns (Member memory) {
        require(_members[memberId].exists, "Member not found");
        return _members[memberId];
    }

    /// @notice Check if a member has a specific role
    /// @param memberId The member ID
    /// @param roleId The role ID
    /// @return Whether the member has the role
    function hasRole(bytes32 memberId, bytes32 roleId) external view returns (bool) {
        return _memberRoles[memberId][roleId];
    }

    /// @notice Check if a member has permission for a resource/action via any assigned role
    /// @param memberId The member to check
    /// @param resource The resource scope
    /// @param action The action
    /// @return allowed Whether the member has the permission
    function checkPermission(bytes32 memberId, bytes32 resource, bytes32 action) external view returns (bool allowed) {
        bytes32[] storage roles = _memberRoleList[memberId];
        uint256 len = roles.length;

        for (uint256 i = 0; i < len; i++) {
            if (_memberRoles[memberId][roles[i]]) {
                bytes32 key = keccak256(abi.encodePacked(roles[i], resource, action));
                if (_permissions[key].exists) {
                    return true;
                }
            }
        }

        return false;
    }

    /// @notice Get the total number of active members
    /// @return count The active member count
    function activeMemberCount() external view returns (uint256 count) {
        return _activeMemberCount;
    }
}
