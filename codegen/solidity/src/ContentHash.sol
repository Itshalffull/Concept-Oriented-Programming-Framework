// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ContentHash
/// @notice Content-addressable storage with deduplication and integrity verification.
contract ContentHash {
    mapping(bytes32 => bytes) private _objects;
    mapping(bytes32 => bool) private _exists;
    mapping(bytes32 => uint256) private _size;
    mapping(bytes32 => uint256) private _created;

    event Stored(bytes32 indexed hash, uint256 size);
    event AlreadyExists(bytes32 indexed hash);
    event Deleted(bytes32 indexed hash);
    event Verified(bytes32 indexed hash, bool valid);

    /// @notice Stores content and returns its content hash. Returns alreadyExists if duplicate.
    /// @param content The raw content to store.
    /// @return hash The keccak256 hash of the content.
    /// @return isNew True if content was newly stored, false if it already existed.
    function store(bytes calldata content) external returns (bytes32 hash, bool isNew) {
        hash = keccak256(content);

        if (_exists[hash]) {
            emit AlreadyExists(hash);
            return (hash, false);
        }

        _objects[hash] = content;
        _exists[hash] = true;
        _size[hash] = content.length;
        _created[hash] = block.timestamp;

        emit Stored(hash, content.length);
        return (hash, true);
    }

    /// @notice Retrieves content by its hash.
    /// @param hash The content hash to look up.
    /// @return content The stored content bytes.
    function retrieve(bytes32 hash) external view returns (bytes memory content) {
        require(_exists[hash], "Content not found");
        return _objects[hash];
    }

    /// @notice Verifies that content matches the given hash.
    /// @param hash The expected hash.
    /// @param content The content to verify.
    /// @return valid True if the content matches the hash and is stored.
    function verify(bytes32 hash, bytes calldata content) external returns (bool valid) {
        require(_exists[hash], "Content not found");

        valid = keccak256(content) == hash;

        emit Verified(hash, valid);
    }

    /// @notice Deletes content by its hash.
    /// @param hash The content hash to delete.
    function deleteContent(bytes32 hash) external {
        require(_exists[hash], "Content not found");

        delete _objects[hash];
        _exists[hash] = false;
        _size[hash] = 0;

        emit Deleted(hash);
    }

    /// @notice Checks whether content exists for a given hash.
    /// @param hash The hash to check.
    /// @return True if content exists.
    function exists(bytes32 hash) external view returns (bool) {
        return _exists[hash];
    }

    /// @notice Returns the size of stored content.
    /// @param hash The content hash.
    /// @return The size in bytes.
    function getSize(bytes32 hash) external view returns (uint256) {
        require(_exists[hash], "Content not found");
        return _size[hash];
    }

    /// @notice Returns the creation timestamp of stored content.
    /// @param hash The content hash.
    /// @return The block timestamp when content was stored.
    function getCreated(bytes32 hash) external view returns (uint256) {
        require(_exists[hash], "Content not found");
        return _created[hash];
    }
}
