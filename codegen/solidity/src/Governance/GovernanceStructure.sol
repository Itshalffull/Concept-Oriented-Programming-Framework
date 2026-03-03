// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GovernanceStructure
/// @notice Organizational structure primitives for governance: polities, circles, delegation, and voting weight
/// @dev Implements the Polity, Circle, Delegation, and Weight concepts from Clef specification.
///      Polity manages top-level governance bodies. Circle provides holacratic sub-groups.
///      Delegation supports transitive power transfer with cycle detection.
///      Weight provides multi-source aggregation with block-based snapshots.

contract GovernanceStructure {
    // --- Types ---

    enum PolityStatus { Active, Dissolved }

    struct Polity {
        string name;
        string charter;
        PolityStatus status;
        uint256 establishedAt;
        bool exists;
    }

    struct Circle {
        bytes32 polityId;
        string name;
        string purpose;
        bytes32 parentCircleId;   // bytes32(0) if top-level
        bool exists;
    }

    struct DelegationRecord {
        bytes32 delegator;
        bytes32 delegatee;
        bytes32 scope;           // scope of delegation (e.g., polityId or circleId)
        uint256 createdAt;
        bool active;
        bool exists;
    }

    struct WeightSnapshot {
        uint256 blockNumber;
        uint256 weight;
    }

    // --- Storage ---

    /// @dev Maps polity ID -> Polity record
    mapping(bytes32 => Polity) private _polities;

    /// @dev Maps circle ID -> Circle record
    mapping(bytes32 => Circle) private _circles;

    /// @dev Maps delegation ID -> DelegationRecord
    mapping(bytes32 => DelegationRecord) private _delegations;

    /// @dev Maps delegator -> scope -> delegatee (active delegation lookup)
    mapping(bytes32 => mapping(bytes32 => bytes32)) private _activeDelegation;

    /// @dev Maps member ID -> scope -> list of weight snapshots
    mapping(bytes32 => mapping(bytes32 => WeightSnapshot[])) private _weightHistory;

    /// @dev Maps member ID -> scope -> current weight
    mapping(bytes32 => mapping(bytes32 => uint256)) private _currentWeight;

    // --- Events ---

    event PolityEstablished(bytes32 indexed polityId, string name);
    event PolityDissolved(bytes32 indexed polityId);

    event CircleCreated(bytes32 indexed circleId, bytes32 indexed polityId, string name);
    event CircleMemberAdded(bytes32 indexed circleId, bytes32 indexed memberId);
    event CircleMemberRemoved(bytes32 indexed circleId, bytes32 indexed memberId);

    event DelegationCreated(bytes32 indexed delegationId, bytes32 indexed delegator, bytes32 indexed delegatee, bytes32 scope);
    event DelegationRevoked(bytes32 indexed delegationId);

    event WeightUpdated(bytes32 indexed memberId, bytes32 indexed scope, uint256 newWeight, uint256 blockNumber);

    // --- Polity Actions ---

    /// @notice Establish a new polity (top-level governance body)
    /// @param polityId Unique identifier
    /// @param name Human-readable name
    /// @param charter Founding charter or constitution text
    function establish(bytes32 polityId, string calldata name, string calldata charter) external {
        require(polityId != bytes32(0), "Polity ID cannot be zero");
        require(!_polities[polityId].exists, "Polity already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _polities[polityId] = Polity({
            name: name,
            charter: charter,
            status: PolityStatus.Active,
            establishedAt: block.timestamp,
            exists: true
        });

        emit PolityEstablished(polityId, name);
    }

    /// @notice Dissolve an existing polity
    /// @param polityId The polity to dissolve
    function dissolve(bytes32 polityId) external {
        require(_polities[polityId].exists, "Polity not found");
        require(_polities[polityId].status == PolityStatus.Active, "Polity not active");

        _polities[polityId].status = PolityStatus.Dissolved;

        emit PolityDissolved(polityId);
    }

    // --- Circle Actions ---

    /// @notice Create a holacratic circle within a polity
    /// @param circleId Unique identifier for the circle
    /// @param polityId The parent polity
    /// @param name Circle name
    /// @param purpose Circle purpose statement
    /// @param parentCircleId Parent circle ID (bytes32(0) for top-level)
    function createCircle(
        bytes32 circleId,
        bytes32 polityId,
        string calldata name,
        string calldata purpose,
        bytes32 parentCircleId
    ) external {
        require(circleId != bytes32(0), "Circle ID cannot be zero");
        require(!_circles[circleId].exists, "Circle already exists");
        require(_polities[polityId].exists, "Polity not found");
        require(_polities[polityId].status == PolityStatus.Active, "Polity not active");
        require(bytes(name).length > 0, "Name cannot be empty");

        if (parentCircleId != bytes32(0)) {
            require(_circles[parentCircleId].exists, "Parent circle not found");
        }

        _circles[circleId] = Circle({
            polityId: polityId,
            name: name,
            purpose: purpose,
            parentCircleId: parentCircleId,
            exists: true
        });

        emit CircleCreated(circleId, polityId, name);
    }

    // --- Delegation Actions ---

    /// @notice Create a delegation of power from delegator to delegatee within a scope
    /// @param delegationId Unique identifier for the delegation
    /// @param delegator The member delegating power
    /// @param delegatee The member receiving delegated power
    /// @param scope The scope of delegation (e.g., polity or circle ID)
    function delegate(
        bytes32 delegationId,
        bytes32 delegator,
        bytes32 delegatee,
        bytes32 scope
    ) external {
        require(delegationId != bytes32(0), "Delegation ID cannot be zero");
        require(delegator != bytes32(0), "Delegator cannot be zero");
        require(delegatee != bytes32(0), "Delegatee cannot be zero");
        require(delegator != delegatee, "Cannot delegate to self");
        require(!_delegations[delegationId].exists, "Delegation already exists");

        // Cycle guard: check that delegatee does not already delegate (transitively) back to delegator
        require(!_wouldCreateCycle(delegatee, delegator, scope), "Delegation would create a cycle");

        _delegations[delegationId] = DelegationRecord({
            delegator: delegator,
            delegatee: delegatee,
            scope: scope,
            createdAt: block.timestamp,
            active: true,
            exists: true
        });

        _activeDelegation[delegator][scope] = delegatee;

        emit DelegationCreated(delegationId, delegator, delegatee, scope);
    }

    /// @notice Revoke an existing delegation
    /// @param delegationId The delegation to revoke
    function revokeDelegation(bytes32 delegationId) external {
        require(_delegations[delegationId].exists, "Delegation not found");
        require(_delegations[delegationId].active, "Delegation not active");

        DelegationRecord storage d = _delegations[delegationId];
        d.active = false;
        _activeDelegation[d.delegator][d.scope] = bytes32(0);

        emit DelegationRevoked(delegationId);
    }

    // --- Weight Actions ---

    /// @notice Update a member's voting weight within a scope, creating a snapshot
    /// @param memberId The member whose weight to update
    /// @param scope The scope (polity/circle) for this weight
    /// @param newWeight The new weight value
    function updateWeight(bytes32 memberId, bytes32 scope, uint256 newWeight) external {
        require(memberId != bytes32(0), "Member ID cannot be zero");

        _currentWeight[memberId][scope] = newWeight;
        _weightHistory[memberId][scope].push(WeightSnapshot({
            blockNumber: block.number,
            weight: newWeight
        }));

        emit WeightUpdated(memberId, scope, newWeight, block.number);
    }

    // --- Views ---

    /// @notice Get a polity record
    /// @param polityId The polity ID
    /// @return The Polity struct
    function getPolity(bytes32 polityId) external view returns (Polity memory) {
        require(_polities[polityId].exists, "Polity not found");
        return _polities[polityId];
    }

    /// @notice Get a circle record
    /// @param circleId The circle ID
    /// @return The Circle struct
    function getCircle(bytes32 circleId) external view returns (Circle memory) {
        require(_circles[circleId].exists, "Circle not found");
        return _circles[circleId];
    }

    /// @notice Get a delegation record
    /// @param delegationId The delegation ID
    /// @return The DelegationRecord struct
    function getDelegation(bytes32 delegationId) external view returns (DelegationRecord memory) {
        require(_delegations[delegationId].exists, "Delegation not found");
        return _delegations[delegationId];
    }

    /// @notice Get the current weight of a member within a scope
    /// @param memberId The member ID
    /// @param scope The scope
    /// @return weight The current weight
    function getWeight(bytes32 memberId, bytes32 scope) external view returns (uint256 weight) {
        return _currentWeight[memberId][scope];
    }

    /// @notice Get the weight snapshot count for history queries
    /// @param memberId The member ID
    /// @param scope The scope
    /// @return count Number of snapshots
    function getWeightSnapshotCount(bytes32 memberId, bytes32 scope) external view returns (uint256 count) {
        return _weightHistory[memberId][scope].length;
    }

    /// @notice Get a weight snapshot by index
    /// @param memberId The member ID
    /// @param scope The scope
    /// @param index The snapshot index
    /// @return The WeightSnapshot struct
    function getWeightSnapshot(bytes32 memberId, bytes32 scope, uint256 index) external view returns (WeightSnapshot memory) {
        require(index < _weightHistory[memberId][scope].length, "Index out of bounds");
        return _weightHistory[memberId][scope][index];
    }

    /// @notice Resolve the final delegatee for a delegator within a scope (follows chain)
    /// @param delegator The starting delegator
    /// @param scope The delegation scope
    /// @return finalDelegatee The end of the delegation chain
    function resolveDelegate(bytes32 delegator, bytes32 scope) external view returns (bytes32 finalDelegatee) {
        bytes32 current = delegator;
        for (uint256 i = 0; i < 20; i++) {   // max chain depth safety
            bytes32 next = _activeDelegation[current][scope];
            if (next == bytes32(0)) {
                return current;
            }
            current = next;
        }
        return current;
    }

    // --- Internal ---

    /// @dev Check if creating a delegation from delegatee back to delegator would form a cycle
    function _wouldCreateCycle(bytes32 from, bytes32 to, bytes32 scope) private view returns (bool) {
        bytes32 current = from;
        for (uint256 i = 0; i < 20; i++) {   // max depth safety
            bytes32 next = _activeDelegation[current][scope];
            if (next == bytes32(0)) {
                return false;
            }
            if (next == to) {
                return true;
            }
            current = next;
        }
        return false;
    }
}
