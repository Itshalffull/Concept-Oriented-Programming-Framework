// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Cache
/// @notice Concept-oriented cache with TTL-based expiry, tagging, and invalidation
/// @dev Implements the Cache concept from COPF specification.
///      Supports setting cached values with max age, checking expiry on reads, and invalidation.

contract Cache {
    // --- Types ---

    struct CacheEntry {
        string value;
        string tags;
        uint256 maxAge;
        uint256 cachedAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps cache key to its entry
    mapping(bytes32 => CacheEntry) private _cache;

    // --- Events ---

    event CacheSet(bytes32 indexed key);
    event CacheInvalidated(bytes32 indexed key);

    // --- Actions ---

    /// @notice Set a cache entry with value, tags, and TTL
    /// @param key The cache key
    /// @param value The value to cache
    /// @param tags Comma-separated tags for the entry
    /// @param maxAge Maximum age in seconds (0 = no expiry)
    function set(bytes32 key, string calldata value, string calldata tags, uint256 maxAge) external {
        require(key != bytes32(0), "Cache key cannot be zero");

        _cache[key] = CacheEntry({
            value: value,
            tags: tags,
            maxAge: maxAge,
            cachedAt: block.timestamp,
            exists: true
        });

        emit CacheSet(key);
    }

    /// @notice Get a cached value, checking TTL expiry
    /// @param key The cache key
    /// @return hit Whether the cache entry exists and has not expired
    /// @return value The cached value (empty string if miss)
    function get(bytes32 key) external view returns (bool hit, string memory value) {
        CacheEntry storage entry = _cache[key];

        if (!entry.exists) {
            return (false, "");
        }

        // Check if the entry has expired
        if (entry.maxAge > 0 && block.timestamp > entry.cachedAt + entry.maxAge) {
            return (false, "");
        }

        return (true, entry.value);
    }

    /// @notice Invalidate a cache entry
    /// @param key The cache key to invalidate
    function invalidate(bytes32 key) external {
        require(_cache[key].exists, "Cache entry not found");

        delete _cache[key];

        emit CacheInvalidated(key);
    }

    // --- Views ---

    /// @notice Check if a cache entry exists (regardless of expiry)
    /// @param key The cache key
    /// @return Whether the cache entry exists
    function cacheExists(bytes32 key) external view returns (bool) {
        return _cache[key].exists;
    }
}
