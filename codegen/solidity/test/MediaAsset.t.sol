// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MediaAsset.sol";

contract MediaAssetTest is Test {
    MediaAsset public target;

    event MediaCreated(bytes32 indexed mediaId, string mediaType);
    event MetadataExtracted(bytes32 indexed mediaId);
    event ThumbnailGenerated(bytes32 indexed mediaId);

    function setUp() public {
        target = new MediaAsset();
    }

    // --- createMedia tests ---

    function test_createMedia_stores_record() public {
        bytes32 mediaId = keccak256("img1");
        target.createMedia(mediaId, "image", "ipfs://img1", '{"width":800}');

        MediaAsset.Media memory m = target.getMedia(mediaId);
        assertEq(m.mediaType, "image", "Media type should match");
        assertEq(m.source, "ipfs://img1", "Source should match");
        assertEq(m.metadata, '{"width":800}', "Metadata should match");
        assertEq(bytes(m.thumbnailUri).length, 0, "Thumbnail should be empty initially");
        assertTrue(m.exists);
    }

    function test_createMedia_emits_event() public {
        bytes32 mediaId = keccak256("img1");

        vm.expectEmit(true, false, false, true);
        emit MediaCreated(mediaId, "image");

        target.createMedia(mediaId, "image", "ipfs://img1", "");
    }

    function test_createMedia_zero_id_reverts() public {
        vm.expectRevert("Media ID cannot be zero");
        target.createMedia(bytes32(0), "image", "src", "");
    }

    function test_createMedia_duplicate_reverts() public {
        bytes32 mediaId = keccak256("img1");
        target.createMedia(mediaId, "image", "src", "");

        vm.expectRevert("Media already exists");
        target.createMedia(mediaId, "video", "src2", "");
    }

    function test_createMedia_empty_type_reverts() public {
        vm.expectRevert("Media type cannot be empty");
        target.createMedia(keccak256("m1"), "", "src", "");
    }

    function test_createMedia_empty_source_reverts() public {
        vm.expectRevert("Source cannot be empty");
        target.createMedia(keccak256("m1"), "image", "", "");
    }

    // --- setMetadata tests ---

    function test_setMetadata_updates_metadata() public {
        bytes32 mediaId = keccak256("img1");
        target.createMedia(mediaId, "image", "src", "old-meta");
        target.setMetadata(mediaId, "new-meta");

        MediaAsset.Media memory m = target.getMedia(mediaId);
        assertEq(m.metadata, "new-meta", "Metadata should be updated");
    }

    function test_setMetadata_nonexistent_reverts() public {
        vm.expectRevert("Media not found");
        target.setMetadata(keccak256("missing"), "meta");
    }

    // --- setThumbnail tests ---

    function test_setThumbnail_stores_uri() public {
        bytes32 mediaId = keccak256("img1");
        target.createMedia(mediaId, "image", "src", "");
        target.setThumbnail(mediaId, "ipfs://thumb1");

        MediaAsset.Media memory m = target.getMedia(mediaId);
        assertEq(m.thumbnailUri, "ipfs://thumb1", "Thumbnail URI should match");
    }

    function test_setThumbnail_nonexistent_reverts() public {
        vm.expectRevert("Media not found");
        target.setThumbnail(keccak256("missing"), "uri");
    }

    function test_setThumbnail_empty_uri_reverts() public {
        bytes32 mediaId = keccak256("img1");
        target.createMedia(mediaId, "image", "src", "");

        vm.expectRevert("Thumbnail URI cannot be empty");
        target.setThumbnail(mediaId, "");
    }

    // --- mediaExists tests ---

    function test_mediaExists_false_for_missing() public view {
        assertFalse(target.mediaExists(keccak256("missing")));
    }

    function test_mediaExists_true_after_create() public {
        bytes32 mediaId = keccak256("img1");
        target.createMedia(mediaId, "image", "src", "");
        assertTrue(target.mediaExists(mediaId));
    }
}
