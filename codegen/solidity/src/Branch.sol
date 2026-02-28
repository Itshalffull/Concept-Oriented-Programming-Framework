// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Branch
/// @notice Named parallel lines of development with lifecycle management.
contract Branch {
    struct BranchInfo {
        string name;
        bytes32 head;
        bool isProtected;
        bytes32 upstream;
        uint256 created;
        bool archived;
        bool exists;
    }

    mapping(bytes32 => BranchInfo) private _branches;
    mapping(bytes32 => bool) private _nameUsed;
    uint256 private _nonce;

    event BranchCreated(bytes32 indexed branchId, string name, bytes32 fromNode);
    event BranchAdvanced(bytes32 indexed branchId, bytes32 newHead);
    event BranchDeleted(bytes32 indexed branchId);
    event BranchProtected(bytes32 indexed branchId);
    event UpstreamSet(bytes32 indexed branchId, bytes32 indexed upstreamId);
    event BranchArchived(bytes32 indexed branchId);

    /// @notice Creates a new branch from a given starting node.
    /// @param name The human-readable branch name.
    /// @param fromNode The initial head node for the branch.
    /// @return branchId The unique identifier for the created branch.
    function create(string calldata name, bytes32 fromNode) external returns (bytes32 branchId) {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        require(!_nameUsed[nameHash], "Branch name already exists");

        branchId = keccak256(abi.encodePacked(name, fromNode, block.timestamp, _nonce++));

        _branches[branchId] = BranchInfo({
            name: name,
            head: fromNode,
            isProtected: false,
            upstream: bytes32(0),
            created: block.timestamp,
            archived: false,
            exists: true
        });

        _nameUsed[nameHash] = true;

        emit BranchCreated(branchId, name, fromNode);
    }

    /// @notice Advances the head of a branch to a new node.
    /// @param branchId The branch to advance.
    /// @param newNode The new head node.
    function advance(bytes32 branchId, bytes32 newNode) external {
        require(_branches[branchId].exists, "Branch does not exist");
        require(!_branches[branchId].isProtected, "Branch is protected");
        require(!_branches[branchId].archived, "Branch is archived");

        _branches[branchId].head = newNode;

        emit BranchAdvanced(branchId, newNode);
    }

    /// @notice Deletes a branch.
    /// @param branchId The branch to delete.
    function deleteBranch(bytes32 branchId) external {
        require(_branches[branchId].exists, "Branch does not exist");
        require(!_branches[branchId].isProtected, "Branch is protected");

        bytes32 nameHash = keccak256(abi.encodePacked(_branches[branchId].name));
        _nameUsed[nameHash] = false;
        _branches[branchId].exists = false;

        emit BranchDeleted(branchId);
    }

    /// @notice Marks a branch as protected, preventing advance and delete.
    /// @param branchId The branch to protect.
    function protect(bytes32 branchId) external {
        require(_branches[branchId].exists, "Branch does not exist");

        _branches[branchId].isProtected = true;

        emit BranchProtected(branchId);
    }

    /// @notice Sets the upstream branch for tracking.
    /// @param branchId The branch to configure.
    /// @param upstreamId The upstream branch identifier.
    function setUpstream(bytes32 branchId, bytes32 upstreamId) external {
        require(_branches[branchId].exists, "Branch does not exist");

        _branches[branchId].upstream = upstreamId;

        emit UpstreamSet(branchId, upstreamId);
    }

    /// @notice Archives a branch, preventing further advances.
    /// @param branchId The branch to archive.
    function archive(bytes32 branchId) external {
        require(_branches[branchId].exists, "Branch does not exist");

        _branches[branchId].archived = true;

        emit BranchArchived(branchId);
    }

    /// @notice Retrieves branch information.
    /// @param branchId The branch to query.
    /// @return The branch info struct.
    function getBranch(bytes32 branchId) external view returns (BranchInfo memory) {
        require(_branches[branchId].exists, "Branch does not exist");
        return _branches[branchId];
    }
}
