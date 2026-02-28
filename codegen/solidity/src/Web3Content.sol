// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Web3Content
/// @notice Concept-oriented IPFS content management with CID tracking and pinning
/// @dev Implements the Web3Content concept from Clef specification.
///      Content is stored on-chain with a keccak256-derived CID for identification.

contract Web3Content {
    // --- Types ---

    struct ContentItem {
        bytes data;
        string name;
        string contentType;
        uint256 size;
        bool pinned;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps CID hash to its content item
    mapping(bytes32 => ContentItem) private _items;

    /// @dev Array of all stored CID hashes
    bytes32[] private _allCids;

    // --- Events ---

    event Stored(bytes32 indexed cid, string name, uint256 size);
    event Pinned(bytes32 indexed cid);
    event Unpinned(bytes32 indexed cid);

    // --- Actions ---

    /// @notice Store content and return its CID
    /// @param data The raw content bytes
    /// @param name A human-readable name for the content
    /// @param contentType The MIME type of the content
    /// @return cid The keccak256-derived content identifier
    /// @return size The size of the stored data in bytes
    function store(bytes calldata data, string calldata name, string calldata contentType)
        external
        returns (bytes32 cid, uint256 size)
    {
        require(data.length > 0, "Data cannot be empty");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(contentType).length > 0, "Content type cannot be empty");

        cid = keccak256(data);
        size = data.length;

        require(!_items[cid].exists, "Content with this CID already exists");

        _items[cid] = ContentItem({
            data: data,
            name: name,
            contentType: contentType,
            size: size,
            pinned: false,
            exists: true
        });
        _allCids.push(cid);

        emit Stored(cid, name, size);
    }

    /// @notice Pin content to prevent garbage collection
    /// @param cid The content identifier to pin
    function pin(bytes32 cid) external {
        require(_items[cid].exists, "Content not found");
        require(!_items[cid].pinned, "Content already pinned");

        _items[cid].pinned = true;

        emit Pinned(cid);
    }

    /// @notice Unpin content to allow garbage collection
    /// @param cid The content identifier to unpin
    function unpin(bytes32 cid) external {
        require(_items[cid].exists, "Content not found");
        require(_items[cid].pinned, "Content not pinned");

        _items[cid].pinned = false;

        emit Unpinned(cid);
    }

    // --- Views ---

    /// @notice Resolve content by its CID
    /// @param cid The content identifier
    /// @return data The raw content bytes
    /// @return contentType The MIME type
    /// @return size The size in bytes
    function resolve(bytes32 cid) external view returns (bytes memory data, string memory contentType, uint256 size) {
        require(_items[cid].exists, "Content not found");

        ContentItem storage item = _items[cid];
        return (item.data, item.contentType, item.size);
    }

    /// @notice Get metadata for content without returning the data
    /// @param cid The content identifier
    /// @return exists Whether the content exists
    /// @return name The content name
    /// @return contentType The MIME type
    /// @return size The size in bytes
    /// @return pinned Whether the content is pinned
    function getMetadata(bytes32 cid)
        external
        view
        returns (bool exists, string memory name, string memory contentType, uint256 size, bool pinned)
    {
        ContentItem storage item = _items[cid];
        if (!item.exists) {
            return (false, "", "", 0, false);
        }
        return (true, item.name, item.contentType, item.size, item.pinned);
    }

    /// @notice Get the total number of stored content items
    /// @return count The number of items
    function contentCount() external view returns (uint256 count) {
        return _allCids.length;
    }
}
