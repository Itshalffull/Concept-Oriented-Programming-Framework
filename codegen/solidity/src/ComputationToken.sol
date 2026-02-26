// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ComputationToken
/// @notice Concept-oriented computation token provider registry
/// @dev Implements the ComputationToken concept from Clef specification.
///      Token replacement is off-chain; on-chain stores the provider registry.

contract ComputationToken {
    // --- Types ---

    struct TokenProvider {
        string resolverConfig;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps token type hash to its provider configuration
    mapping(bytes32 => TokenProvider) private _providers;

    // --- Events ---

    event ProviderRegistered(bytes32 indexed tokenType);

    // --- Actions ---

    /// @notice Register a token provider for a given token type
    /// @param tokenType The hash identifying the token type
    /// @param resolverConfig Configuration for the off-chain resolver
    function registerProvider(bytes32 tokenType, string calldata resolverConfig) external {
        require(tokenType != bytes32(0), "Token type cannot be zero");
        require(bytes(resolverConfig).length > 0, "Resolver config cannot be empty");

        _providers[tokenType] = TokenProvider({
            resolverConfig: resolverConfig,
            exists: true
        });

        emit ProviderRegistered(tokenType);
    }

    // --- Views ---

    /// @notice Get a token provider's configuration
    /// @param tokenType The token type hash
    /// @return found Whether a provider was found
    /// @return resolverConfig The provider's resolver configuration
    function getProvider(bytes32 tokenType) external view returns (bool found, string memory resolverConfig) {
        TokenProvider storage p = _providers[tokenType];
        if (!p.exists) {
            return (false, "");
        }
        return (true, p.resolverConfig);
    }

    /// @notice Check if a provider exists for a token type
    /// @param tokenType The token type hash
    /// @return Whether a provider is registered
    function providerExists(bytes32 tokenType) external view returns (bool) {
        return _providers[tokenType].exists;
    }
}
