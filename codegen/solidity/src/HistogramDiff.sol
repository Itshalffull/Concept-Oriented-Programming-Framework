// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title HistogramDiff
/// @notice Diff provider plugin using histogram-based comparison.
///         Compares content by hash; produces simplified edit distance based on length delta.
contract HistogramDiff {
    event Computed(bytes32 indexed hashA, bytes32 indexed hashB, uint256 distance);

    /// @notice Returns static metadata for this diff provider.
    /// @return name The provider name.
    /// @return category The provider category.
    /// @return contentTypes The supported MIME content types.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory contentTypes)
    {
        name = "histogram";
        category = "diff";
        contentTypes = new string[](2);
        contentTypes[0] = "text/plain";
        contentTypes[1] = "text/*";
    }

    /// @notice Computes a simplified diff between two content blobs.
    /// @param contentA The first content blob.
    /// @param contentB The second content blob.
    /// @return editScript An encoded edit script (packed hashes when different, empty when identical).
    /// @return distance The edit distance (0 when identical, absolute length difference otherwise).
    function compute(bytes calldata contentA, bytes calldata contentB)
        external
        returns (bytes memory editScript, uint256 distance)
    {
        bytes32 hashA = keccak256(contentA);
        bytes32 hashB = keccak256(contentB);

        if (hashA == hashB) {
            return ("", 0);
        }

        uint256 lenA = contentA.length;
        uint256 lenB = contentB.length;
        distance = lenA > lenB ? lenA - lenB : lenB - lenA;
        editScript = abi.encodePacked(hashA, hashB);

        emit Computed(hashA, hashB, distance);
    }
}
