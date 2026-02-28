// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Ref
/// @notice Mutable human-readable names for immutable content-addressed objects.
contract Ref {
    struct RefInfo {
        bytes32 target;
        bool exists;
    }

    struct LogEntry {
        bytes32 oldHash;
        bytes32 newHash;
        uint256 timestamp;
        bytes32 agent;
    }

    mapping(bytes32 => RefInfo) private _refs;
    mapping(bytes32 => LogEntry[]) private _reflog;

    event RefCreated(bytes32 indexed nameHash, bytes32 indexed target);
    event RefUpdated(bytes32 indexed nameHash, bytes32 indexed oldTarget, bytes32 indexed newTarget);
    event RefDeleted(bytes32 indexed nameHash);

    /// @notice Creates a new ref pointing to the given content hash.
    /// @param name The human-readable ref name.
    /// @param hash The content hash the ref points to.
    /// @return refId The keccak256 hash of the name, used as the ref identifier.
    function create(string calldata name, bytes32 hash) external returns (bytes32 refId) {
        refId = keccak256(abi.encodePacked(name));
        require(!_refs[refId].exists, "Ref already exists");

        _refs[refId] = RefInfo({target: hash, exists: true});

        _reflog[refId].push(
            LogEntry({oldHash: bytes32(0), newHash: hash, timestamp: block.timestamp, agent: bytes32(uint256(uint160(msg.sender)))})
        );

        emit RefCreated(refId, hash);
    }

    /// @notice Updates a ref with compare-and-swap semantics.
    /// @param name The ref name to update.
    /// @param newHash The new content hash.
    /// @param expectedOldHash The expected current hash (CAS guard).
    function update(string calldata name, bytes32 newHash, bytes32 expectedOldHash) external {
        bytes32 refId = keccak256(abi.encodePacked(name));
        RefInfo storage ref_ = _refs[refId];
        require(ref_.exists, "Ref not found");
        require(ref_.target == expectedOldHash, "Conflict: current hash does not match expected");

        bytes32 oldTarget = ref_.target;
        ref_.target = newHash;

        _reflog[refId].push(
            LogEntry({
                oldHash: oldTarget,
                newHash: newHash,
                timestamp: block.timestamp,
                agent: bytes32(uint256(uint160(msg.sender)))
            })
        );

        emit RefUpdated(refId, oldTarget, newHash);
    }

    /// @notice Deletes a ref by name.
    /// @param name The ref name to delete.
    function deleteRef(string calldata name) external {
        bytes32 refId = keccak256(abi.encodePacked(name));
        require(_refs[refId].exists, "Ref not found");

        bytes32 oldTarget = _refs[refId].target;
        delete _refs[refId];

        _reflog[refId].push(
            LogEntry({
                oldHash: oldTarget,
                newHash: bytes32(0),
                timestamp: block.timestamp,
                agent: bytes32(uint256(uint160(msg.sender)))
            })
        );

        emit RefDeleted(refId);
    }

    /// @notice Resolves a ref name to its current content hash.
    /// @param name The ref name to resolve.
    /// @return hash The content hash the ref points to.
    function resolve(string calldata name) external view returns (bytes32 hash) {
        bytes32 refId = keccak256(abi.encodePacked(name));
        require(_refs[refId].exists, "Ref not found");
        return _refs[refId].target;
    }

    /// @notice Returns the reflog (history of changes) for a ref.
    /// @param name The ref name to query.
    /// @return entries The array of log entries.
    function log(string calldata name) external view returns (LogEntry[] memory entries) {
        bytes32 refId = keccak256(abi.encodePacked(name));
        return _reflog[refId];
    }
}
