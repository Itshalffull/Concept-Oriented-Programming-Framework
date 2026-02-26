// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MediaAsset
/// @notice Concept-oriented media asset management with metadata and thumbnail support
/// @dev Implements the MediaAsset concept from COPF specification.
///      Supports creating media records, extracting metadata, and generating thumbnails.

contract MediaAsset {
    // --- Types ---

    struct Media {
        string mediaType;
        string source;
        string metadata;
        string thumbnailUri;
        uint256 createdAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps media ID to its full data
    mapping(bytes32 => Media) private _media;

    // --- Events ---

    event MediaCreated(bytes32 indexed mediaId, string mediaType);
    event MetadataExtracted(bytes32 indexed mediaId);
    event ThumbnailGenerated(bytes32 indexed mediaId);

    // --- Actions ---

    /// @notice Create a new media asset record
    /// @param mediaId The unique identifier for the media asset
    /// @param mediaType The type of media (e.g., "image", "video", "audio")
    /// @param source The source URI of the media
    /// @param metadata Initial metadata for the media
    function createMedia(
        bytes32 mediaId,
        string calldata mediaType,
        string calldata source,
        string calldata metadata
    ) external {
        require(mediaId != bytes32(0), "Media ID cannot be zero");
        require(!_media[mediaId].exists, "Media already exists");
        require(bytes(mediaType).length > 0, "Media type cannot be empty");
        require(bytes(source).length > 0, "Source cannot be empty");

        _media[mediaId] = Media({
            mediaType: mediaType,
            source: source,
            metadata: metadata,
            thumbnailUri: "",
            createdAt: block.timestamp,
            exists: true
        });

        emit MediaCreated(mediaId, mediaType);
    }

    /// @notice Set or update metadata for a media asset
    /// @param mediaId The media ID to update
    /// @param metadata The new metadata
    function setMetadata(bytes32 mediaId, string calldata metadata) external {
        require(_media[mediaId].exists, "Media not found");

        _media[mediaId].metadata = metadata;

        emit MetadataExtracted(mediaId);
    }

    /// @notice Set or update the thumbnail URI for a media asset
    /// @param mediaId The media ID to update
    /// @param thumbnailUri The thumbnail URI
    function setThumbnail(bytes32 mediaId, string calldata thumbnailUri) external {
        require(_media[mediaId].exists, "Media not found");
        require(bytes(thumbnailUri).length > 0, "Thumbnail URI cannot be empty");

        _media[mediaId].thumbnailUri = thumbnailUri;

        emit ThumbnailGenerated(mediaId);
    }

    // --- Views ---

    /// @notice Retrieve a media asset's full data
    /// @param mediaId The media ID
    /// @return The full media data struct
    function getMedia(bytes32 mediaId) external view returns (Media memory) {
        require(_media[mediaId].exists, "Media not found");
        return _media[mediaId];
    }

    /// @notice Check if a media asset exists
    /// @param mediaId The media ID
    /// @return Whether the media asset exists
    function mediaExists(bytes32 mediaId) external view returns (bool) {
        return _media[mediaId].exists;
    }
}
