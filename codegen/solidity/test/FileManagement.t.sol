// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/FileManagement.sol";

contract FileManagementTest is Test {
    FileManagement public target;

    event Uploaded(bytes32 indexed fileId);
    event UsageAdded(bytes32 indexed fileId, bytes32 indexed entityId);
    event UsageRemoved(bytes32 indexed fileId, bytes32 indexed entityId);

    function setUp() public {
        target = new FileManagement();
    }

    // --- upload tests ---

    function test_upload_stores_file() public {
        bytes32 fileId = keccak256("file1");
        target.upload(fileId, "ipfs://abc", '{"size":1024}');

        FileManagement.FileRecord memory f = target.getFile(fileId);
        assertEq(f.destination, "ipfs://abc", "Destination should match");
        assertEq(f.metadata, '{"size":1024}', "Metadata should match");
        assertFalse(f.permanent, "File should not be permanent initially");
        assertTrue(f.exists, "File should exist");
    }

    function test_upload_emits_event() public {
        bytes32 fileId = keccak256("file1");

        vm.expectEmit(true, false, false, false);
        emit Uploaded(fileId);

        target.upload(fileId, "ipfs://abc", "meta");
    }

    function test_upload_zero_id_reverts() public {
        vm.expectRevert("File ID cannot be zero");
        target.upload(bytes32(0), "dest", "meta");
    }

    function test_upload_duplicate_reverts() public {
        bytes32 fileId = keccak256("file1");
        target.upload(fileId, "dest", "meta");

        vm.expectRevert("File already exists");
        target.upload(fileId, "dest2", "meta2");
    }

    function test_upload_empty_destination_reverts() public {
        vm.expectRevert("Destination cannot be empty");
        target.upload(keccak256("f1"), "", "meta");
    }

    // --- addUsage tests ---

    function test_addUsage_marks_permanent() public {
        bytes32 fileId = keccak256("file1");
        bytes32 entityId = keccak256("article1");
        target.upload(fileId, "dest", "meta");
        target.addUsage(fileId, entityId);

        FileManagement.FileRecord memory f = target.getFile(fileId);
        assertTrue(f.permanent, "File should be permanent after usage added");
        assertEq(target.usageCount(fileId), 1, "Usage count should be 1");
    }

    function test_addUsage_nonexistent_file_reverts() public {
        vm.expectRevert("File not found");
        target.addUsage(keccak256("missing"), keccak256("e1"));
    }

    function test_addUsage_zero_entity_reverts() public {
        bytes32 fileId = keccak256("file1");
        target.upload(fileId, "dest", "meta");

        vm.expectRevert("Entity ID cannot be zero");
        target.addUsage(fileId, bytes32(0));
    }

    function test_addUsage_duplicate_reverts() public {
        bytes32 fileId = keccak256("file1");
        bytes32 entityId = keccak256("e1");
        target.upload(fileId, "dest", "meta");
        target.addUsage(fileId, entityId);

        vm.expectRevert("Usage already exists");
        target.addUsage(fileId, entityId);
    }

    // --- removeUsage tests ---

    function test_removeUsage_decrements_count() public {
        bytes32 fileId = keccak256("file1");
        bytes32 e1 = keccak256("e1");
        bytes32 e2 = keccak256("e2");
        target.upload(fileId, "dest", "meta");
        target.addUsage(fileId, e1);
        target.addUsage(fileId, e2);

        target.removeUsage(fileId, e1);
        assertEq(target.usageCount(fileId), 1, "Usage count should be 1");
    }

    function test_removeUsage_clears_permanent_when_empty() public {
        bytes32 fileId = keccak256("file1");
        bytes32 entityId = keccak256("e1");
        target.upload(fileId, "dest", "meta");
        target.addUsage(fileId, entityId);
        target.removeUsage(fileId, entityId);

        FileManagement.FileRecord memory f = target.getFile(fileId);
        assertFalse(f.permanent, "File should not be permanent when no usages remain");
    }

    function test_removeUsage_nonexistent_usage_reverts() public {
        bytes32 fileId = keccak256("file1");
        target.upload(fileId, "dest", "meta");

        vm.expectRevert("Usage not found");
        target.removeUsage(fileId, keccak256("missing"));
    }

    // --- getFile tests ---

    function test_getFile_nonexistent_reverts() public {
        vm.expectRevert("File not found");
        target.getFile(keccak256("missing"));
    }

    // --- fileExists tests ---

    function test_fileExists_false_for_missing() public view {
        assertFalse(target.fileExists(keccak256("missing")));
    }

    function test_fileExists_true_after_upload() public {
        bytes32 fileId = keccak256("file1");
        target.upload(fileId, "dest", "meta");
        assertTrue(target.fileExists(fileId));
    }
}
