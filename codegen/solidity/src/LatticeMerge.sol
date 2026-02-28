// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LatticeMerge
/// @notice Merge provider plugin using lattice join semantics for CRDT content.
///         Produces a clean merge by concatenating ours and theirs (simplified union/join).
contract LatticeMerge {
    event MergeClean(bytes32 indexed resultHash);

    /// @notice Returns static metadata for this merge provider.
    /// @return name The provider name.
    /// @return category The provider category.
    /// @return contentTypes The supported MIME content types.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory contentTypes)
    {
        name = "lattice";
        category = "merge";
        contentTypes = new string[](1);
        contentTypes[0] = "application/crdt+json";
    }

    /// @notice Executes a lattice merge (always clean). Result is the union of ours and theirs.
    /// @param base The common ancestor content (unused in lattice join).
    /// @param ours Our side of the merge.
    /// @param theirs Their side of the merge.
    /// @return result The merged content (concatenation of ours and theirs).
    /// @return clean Always true for lattice merges.
    function execute(bytes calldata base, bytes calldata ours, bytes calldata theirs)
        external
        returns (bytes memory result, bool clean)
    {
        // Suppress unused variable warning
        base;

        result = abi.encodePacked(ours, theirs);
        clean = true;

        emit MergeClean(keccak256(result));
    }
}
