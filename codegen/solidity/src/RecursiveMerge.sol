// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RecursiveMerge
/// @notice Merge provider plugin using recursive merge strategy (simplified on-chain).
///         Resolves clean merges via three-way hash comparison; reverts on true conflicts.
contract RecursiveMerge {
    event MergeClean(bytes32 indexed resultHash);
    event MergeConflicts(uint256 conflictCount);

    /// @notice Returns static metadata for this merge provider.
    /// @return name The provider name.
    /// @return category The provider category.
    /// @return contentTypes The supported MIME content types.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory contentTypes)
    {
        name = "recursive";
        category = "merge";
        contentTypes = new string[](2);
        contentTypes[0] = "text/plain";
        contentTypes[1] = "text/*";
    }

    /// @notice Executes a recursive merge on three content versions.
    /// @param base The common ancestor content.
    /// @param ours Our side of the merge.
    /// @param theirs Their side of the merge.
    /// @return result The merged content.
    /// @return clean True if the merge completed without conflicts.
    function execute(bytes calldata base, bytes calldata ours, bytes calldata theirs)
        external
        returns (bytes memory result, bool clean)
    {
        bytes32 hashBase = keccak256(base);
        bytes32 hashOurs = keccak256(ours);
        bytes32 hashTheirs = keccak256(theirs);

        if (hashOurs == hashBase) {
            result = theirs;
            clean = true;
            emit MergeClean(hashTheirs);
            return (result, clean);
        }

        if (hashTheirs == hashBase) {
            result = ours;
            clean = true;
            emit MergeClean(hashOurs);
            return (result, clean);
        }

        if (hashOurs == hashTheirs) {
            result = ours;
            clean = true;
            emit MergeClean(hashOurs);
            return (result, clean);
        }

        emit MergeConflicts(1);
        revert("Merge conflicts detected");
    }
}
