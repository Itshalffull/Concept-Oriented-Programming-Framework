// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ContentDigest
/// @notice Content digest computation and fingerprinting
/// @dev Implements the ContentDigest concept from Clef specification.
///      Supports computing content digests with different algorithms,
///      looking up units by digest, and checking content equivalence.

contract ContentDigest {
    // --- Types ---

    struct DigestEntry {
        string unit;
        string algorithm;
        uint256 createdAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps digest ID to its entry
    mapping(bytes32 => DigestEntry) private _digests;

    /// @dev Ordered list of all digest IDs
    bytes32[] private _digestKeys;

    /// @dev Maps unit content hash to its digest ID for reverse lookup
    mapping(bytes32 => bytes32) private _unitToDigest;

    // --- Events ---

    event ComputeCompleted(string variant, bytes32 digest);
    event LookupCompleted(string variant);
    event EquivalentCompleted(string variant);

    // --- Actions ---

    /// @notice Compute a content digest for a given unit
    /// @param unit The content to fingerprint
    /// @param algorithm The hashing algorithm to use (e.g. "keccak256", "sha256")
    /// @return digestId The computed digest identifier
    function compute(string memory unit, string memory algorithm) external returns (bytes32 digestId) {
        require(bytes(unit).length > 0, "Unit cannot be empty");
        require(bytes(algorithm).length > 0, "Algorithm cannot be empty");

        // Compute digest based on content and algorithm
        digestId = keccak256(abi.encodePacked(unit, algorithm));

        _digests[digestId] = DigestEntry({
            unit: unit,
            algorithm: algorithm,
            createdAt: block.timestamp,
            exists: true
        });

        bytes32 unitHash = keccak256(abi.encodePacked(unit));
        _unitToDigest[unitHash] = digestId;
        _digestKeys.push(digestId);

        emit ComputeCompleted("ok", digestId);
        return digestId;
    }

    /// @notice Look up units associated with a given digest hash
    /// @param hash The digest hash to look up
    /// @return units Serialized list of unit identifiers matching the hash
    function lookup(string memory hash) external view returns (string memory units) {
        require(bytes(hash).length > 0, "Hash cannot be empty");

        // Search for matching digests
        bytes32 hashId = keccak256(abi.encodePacked(hash));
        bytes memory buf;
        uint256 found = 0;

        for (uint256 i = 0; i < _digestKeys.length; i++) {
            bytes32 key = _digestKeys[i];
            if (_digests[key].exists) {
                // Check if the digest hash matches the lookup hash
                bytes32 storedHash = keccak256(abi.encodePacked(_digests[key].unit, _digests[key].algorithm));
                if (storedHash == hashId || key == hashId) {
                    if (found > 0) {
                        buf = abi.encodePacked(buf, ",");
                    }
                    buf = abi.encodePacked(buf, _digests[key].unit);
                    found++;
                }
            }
        }

        units = string(abi.encodePacked("[", buf, "]"));
        return units;
    }

    /// @notice Check whether two content units are equivalent by comparing their digests
    /// @param a First content unit
    /// @param b Second content unit
    /// @return Whether the two units produce the same digest
    function equivalent(string memory a, string memory b) external pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    // --- Views ---

    /// @notice Retrieve a stored digest entry
    /// @param digestId The digest to look up
    /// @return unit The original content unit
    /// @return algorithm The algorithm used
    function getDigest(bytes32 digestId) external view returns (string memory unit, string memory algorithm) {
        require(_digests[digestId].exists, "Digest not found");
        DigestEntry storage entry = _digests[digestId];
        return (entry.unit, entry.algorithm);
    }
}
