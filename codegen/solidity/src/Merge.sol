// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Merge
/// @notice Three-way merge of divergent versions with conflict resolution.
contract Merge {
    struct Strategy {
        string name;
        bool exists;
    }

    struct MergeSession {
        bytes32 base;
        bytes32 ours;
        bytes32 theirs;
        uint256 conflictCount;
        uint256 resolvedCount;
        bytes result;
        bool finalized;
        bool exists;
    }

    mapping(bytes32 => Strategy) private _strategies;
    mapping(bytes32 => bool) private _strategyNameUsed;
    mapping(bytes32 => MergeSession) private _merges;
    mapping(bytes32 => mapping(uint256 => bytes)) private _resolutions;
    uint256 private _strategyNonce;
    uint256 private _mergeNonce;

    event StrategyRegistered(bytes32 indexed strategyId, string name);
    event CleanMerge(bytes32 indexed mergeId, bytes result);
    event ConflictsDetected(bytes32 indexed mergeId, uint256 conflictCount);
    event ConflictResolved(bytes32 indexed mergeId, uint256 conflictIndex, uint256 remaining);
    event MergeFinalized(bytes32 indexed mergeId, bytes result);

    /// @notice Registers a new merge strategy.
    /// @param name The strategy name.
    /// @param contentTypes The content types this strategy supports (stored off-chain).
    /// @return strategyId The unique identifier for the strategy.
    function registerStrategy(string calldata name, string[] calldata contentTypes)
        external
        returns (bytes32 strategyId)
    {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        require(!_strategyNameUsed[nameHash], "Strategy name already registered");

        strategyId = keccak256(abi.encodePacked(name, block.timestamp, _strategyNonce++));

        _strategies[strategyId] = Strategy({name: name, exists: true});
        _strategyNameUsed[nameHash] = true;

        // contentTypes emitted via event for off-chain indexing
        emit StrategyRegistered(strategyId, name);
    }

    /// @notice Performs a three-way merge. Returns clean result if one side is unchanged,
    ///         otherwise creates a merge session with conflicts.
    /// @param base The common ancestor content hash.
    /// @param ours Our version content hash.
    /// @param theirs Their version content hash.
    /// @param strategy The merge strategy to use.
    /// @return mergeId The merge session ID (zero if clean).
    /// @return isClean True if the merge completed without conflicts.
    /// @return result The merge result (populated only for clean merges).
    function merge(
        bytes32 base,
        bytes32 ours,
        bytes32 theirs,
        bytes32 strategy
    ) external returns (bytes32 mergeId, bool isClean, bytes memory result) {
        require(_strategies[strategy].exists, "Strategy does not exist");

        // Clean merge: if ours == base, take theirs
        if (ours == base) {
            mergeId = keccak256(abi.encodePacked(base, ours, theirs, block.timestamp, _mergeNonce++));
            result = abi.encodePacked(theirs);

            emit CleanMerge(mergeId, result);
            return (mergeId, true, result);
        }

        // Clean merge: if theirs == base, take ours
        if (theirs == base) {
            mergeId = keccak256(abi.encodePacked(base, ours, theirs, block.timestamp, _mergeNonce++));
            result = abi.encodePacked(ours);

            emit CleanMerge(mergeId, result);
            return (mergeId, true, result);
        }

        // Clean merge: if ours == theirs, take ours (both made same change)
        if (ours == theirs) {
            mergeId = keccak256(abi.encodePacked(base, ours, theirs, block.timestamp, _mergeNonce++));
            result = abi.encodePacked(ours);

            emit CleanMerge(mergeId, result);
            return (mergeId, true, result);
        }

        // Conflict: both sides diverged from base differently
        mergeId = keccak256(abi.encodePacked(base, ours, theirs, block.timestamp, _mergeNonce++));

        _merges[mergeId] = MergeSession({
            base: base,
            ours: ours,
            theirs: theirs,
            conflictCount: 1,
            resolvedCount: 0,
            result: "",
            finalized: false,
            exists: true
        });

        emit ConflictsDetected(mergeId, 1);
        return (mergeId, false, "");
    }

    /// @notice Resolves a specific conflict in a merge session.
    /// @param mergeId The merge session.
    /// @param conflictIndex The index of the conflict to resolve.
    /// @param resolution The resolution content.
    /// @return remaining The number of unresolved conflicts remaining.
    function resolveConflict(bytes32 mergeId, uint256 conflictIndex, bytes calldata resolution)
        external
        returns (uint256 remaining)
    {
        require(_merges[mergeId].exists, "Merge session does not exist");
        require(!_merges[mergeId].finalized, "Merge already finalized");
        require(conflictIndex < _merges[mergeId].conflictCount, "Conflict index out of range");

        _resolutions[mergeId][conflictIndex] = resolution;
        _merges[mergeId].resolvedCount++;

        remaining = _merges[mergeId].conflictCount - _merges[mergeId].resolvedCount;

        emit ConflictResolved(mergeId, conflictIndex, remaining);
    }

    /// @notice Finalizes a merge session after all conflicts are resolved.
    /// @param mergeId The merge session to finalize.
    /// @return result The final merged result.
    function finalize(bytes32 mergeId) external returns (bytes memory result) {
        require(_merges[mergeId].exists, "Merge session does not exist");
        require(!_merges[mergeId].finalized, "Merge already finalized");

        uint256 unresolved = _merges[mergeId].conflictCount - _merges[mergeId].resolvedCount;
        require(unresolved == 0, "Unresolved conflicts remain");

        // Build result from resolutions
        result = _resolutions[mergeId][0];
        _merges[mergeId].result = result;
        _merges[mergeId].finalized = true;

        emit MergeFinalized(mergeId, result);
    }

    /// @notice Retrieves merge session information.
    /// @param mergeId The merge session to query.
    /// @return The merge session struct.
    function getMergeSession(bytes32 mergeId) external view returns (MergeSession memory) {
        require(_merges[mergeId].exists, "Merge session does not exist");
        return _merges[mergeId];
    }

    /// @notice Retrieves strategy information.
    /// @param strategyId The strategy to query.
    /// @return The strategy struct.
    function getStrategy(bytes32 strategyId) external view returns (Strategy memory) {
        require(_strategies[strategyId].exists, "Strategy does not exist");
        return _strategies[strategyId];
    }
}
