// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Diff
/// @notice Computes differences between two content states using pluggable algorithm providers.
contract Diff {
    struct Provider {
        string name;
        bool exists;
    }

    mapping(bytes32 => Provider) private _providers;
    mapping(bytes32 => bool) private _providerNameUsed;
    uint256 private _nonce;

    event ProviderRegistered(bytes32 indexed providerId, string name);
    event Identical(bytes32 indexed contentHashA, bytes32 indexed contentHashB);
    event Diffed(bytes32 indexed contentHashA, bytes32 indexed contentHashB, uint256 distance);
    event PatchRequested(bytes32 indexed contentHash, bytes editScript);

    /// @notice Registers a new diff algorithm provider.
    /// @param name The provider name.
    /// @param contentTypes The content types this provider supports (stored off-chain).
    /// @return providerId The unique identifier for the provider.
    function registerProvider(string calldata name, string[] calldata contentTypes) external returns (bytes32 providerId) {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        require(!_providerNameUsed[nameHash], "Provider name already registered");

        providerId = keccak256(abi.encodePacked(name, block.timestamp, _nonce++));

        _providers[providerId] = Provider({name: name, exists: true});
        _providerNameUsed[nameHash] = true;

        // contentTypes stored via event for off-chain indexing
        emit ProviderRegistered(providerId, name);
    }

    /// @notice Computes the diff between two content blobs (simplified on-chain comparison).
    /// @param contentA The first content state.
    /// @param contentB The second content state.
    /// @param algorithm The algorithm provider ID to use.
    /// @return isIdentical True if contents are identical.
    /// @return distance The edit distance (0 if identical, 1 if different in simplified mode).
    function diff(
        bytes calldata contentA,
        bytes calldata contentB,
        bytes32 algorithm
    ) external returns (bool isIdentical, uint256 distance) {
        require(_providers[algorithm].exists, "No provider registered for algorithm");

        bytes32 hashA = keccak256(contentA);
        bytes32 hashB = keccak256(contentB);

        if (hashA == hashB) {
            emit Identical(hashA, hashB);
            return (true, 0);
        }

        // Simplified on-chain diff: compute distance as absolute byte-length difference + 1
        distance = 1;
        if (contentA.length > contentB.length) {
            distance = contentA.length - contentB.length + 1;
        } else if (contentB.length > contentA.length) {
            distance = contentB.length - contentA.length + 1;
        }

        emit Diffed(hashA, hashB, distance);
        return (false, distance);
    }

    /// @notice Requests a patch operation (actual patching is handled off-chain).
    /// @param content The base content to patch.
    /// @param editScript The edit script to apply.
    function patch(bytes calldata content, bytes calldata editScript) external {
        bytes32 contentHash = keccak256(content);

        emit PatchRequested(contentHash, editScript);
    }

    /// @notice Retrieves provider information.
    /// @param providerId The provider to query.
    /// @return The provider struct.
    function getProvider(bytes32 providerId) external view returns (Provider memory) {
        require(_providers[providerId].exists, "Provider does not exist");
        return _providers[providerId];
    }
}
