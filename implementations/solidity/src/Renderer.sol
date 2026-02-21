// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Renderer
/// @notice Manages a render cache for pre-computed output, supporting cache storage, retrieval, and invalidation.
contract Renderer {
    struct CacheEntry {
        string output;
        string tags;
        uint256 cachedAt;
        bool exists;
    }

    mapping(bytes32 => CacheEntry) private _renderCache;

    event Rendered(bytes32 indexed elementId);
    event CacheInvalidated(bytes32 indexed elementId);

    /// @notice Caches rendered output for an element.
    /// @param elementId The element to cache output for.
    /// @param output The rendered output.
    /// @param tags Cache tags for invalidation grouping.
    function cacheRender(bytes32 elementId, string calldata output, string calldata tags) external {
        _renderCache[elementId] = CacheEntry({
            output: output,
            tags: tags,
            cachedAt: block.timestamp,
            exists: true
        });

        emit Rendered(elementId);
    }

    /// @notice Retrieves cached render output for an element.
    /// @param elementId The element to look up.
    /// @return found Whether a cached entry exists.
    /// @return output The cached rendered output (empty string if not found).
    function getCachedRender(bytes32 elementId) external view returns (bool found, string memory output) {
        CacheEntry storage entry = _renderCache[elementId];
        if (entry.exists) {
            return (true, entry.output);
        }
        return (false, "");
    }

    /// @notice Invalidates the cached render for an element.
    /// @param elementId The element whose cache to invalidate.
    function invalidateCache(bytes32 elementId) external {
        require(_renderCache[elementId].exists, "No cache entry exists");

        delete _renderCache[elementId];

        emit CacheInvalidated(elementId);
    }
}
