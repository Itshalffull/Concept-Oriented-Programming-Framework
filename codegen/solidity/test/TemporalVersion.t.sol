// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TemporalVersion.sol";

contract TemporalVersionTest is Test {
    TemporalVersion public target;

    event VersionRecorded(bytes32 indexed versionId, bytes32 indexed contentHash, uint256 validFrom, uint256 validTo);
    event VersionSuperseded(bytes32 indexed oldVersionId, bytes32 indexed newVersionId);

    function setUp() public {
        target = new TemporalVersion();
    }

    // --- record tests ---

    function test_record_creates_version() public {
        bytes32 contentHash = keccak256("doc-v1");
        uint256 validFrom = 1000;
        uint256 validTo = 2000;

        bytes32 versionId = target.record(contentHash, validFrom, validTo, hex"aabb");

        TemporalVersion.TemporalEntry memory entry = target.getVersion(versionId);
        assertEq(entry.contentHash, contentHash);
        assertEq(entry.validFrom, validFrom);
        assertEq(entry.validTo, validTo);
        assertEq(entry.systemFrom, block.timestamp);
        assertEq(entry.systemTo, type(uint256).max);
        assertEq(entry.metadata, hex"aabb");
        assertTrue(entry.exists);
    }

    function test_record_emits_event() public {
        bytes32 contentHash = keccak256("doc-v1");

        vm.expectEmit(false, true, false, true);
        emit VersionRecorded(bytes32(0), contentHash, 1000, 2000);

        target.record(contentHash, 1000, 2000, hex"");
    }

    function test_record_increments_version_count() public {
        assertEq(target.versionCount(), 0);

        target.record(keccak256("v1"), 100, 200, hex"");
        assertEq(target.versionCount(), 1);

        target.record(keccak256("v2"), 200, 300, hex"");
        assertEq(target.versionCount(), 2);
    }

    // --- current tests ---

    function test_current_returns_latest() public {
        bytes32 hash1 = keccak256("v1");
        bytes32 hash2 = keccak256("v2");

        target.record(hash1, 100, 200, hex"");
        bytes32 vid2 = target.record(hash2, 200, 300, hex"");

        (bytes32 currentId, bytes32 currentHash) = target.current();
        assertEq(currentId, vid2);
        assertEq(currentHash, hash2);
    }

    function test_current_empty_reverts() public {
        vm.expectRevert("No versions recorded");
        target.current();
    }

    // --- supersede tests ---

    function test_supersede_closes_old_version() public {
        bytes32 hash1 = keccak256("v1");
        bytes32 vid1 = target.record(hash1, 100, 200, hex"");

        // Advance time so supersede gets a different timestamp
        vm.warp(block.timestamp + 100);

        bytes32 hash2 = keccak256("v2");
        bytes32 vid2 = target.supersede(vid1, hash2);

        // Old version should have systemTo closed
        TemporalVersion.TemporalEntry memory oldEntry = target.getVersion(vid1);
        assertEq(oldEntry.systemTo, block.timestamp);

        // New version should be open-ended
        TemporalVersion.TemporalEntry memory newEntry = target.getVersion(vid2);
        assertEq(newEntry.systemTo, type(uint256).max);
        assertEq(newEntry.contentHash, hash2);
    }

    function test_supersede_inherits_valid_time() public {
        bytes32 vid1 = target.record(keccak256("v1"), 100, 200, hex"");

        vm.warp(block.timestamp + 50);
        bytes32 vid2 = target.supersede(vid1, keccak256("v2"));

        TemporalVersion.TemporalEntry memory newEntry = target.getVersion(vid2);
        assertEq(newEntry.validFrom, 100);
        assertEq(newEntry.validTo, 200);
    }

    function test_supersede_updates_current() public {
        bytes32 vid1 = target.record(keccak256("v1"), 100, 200, hex"");

        vm.warp(block.timestamp + 50);
        bytes32 hash2 = keccak256("v2");
        bytes32 vid2 = target.supersede(vid1, hash2);

        (bytes32 currentId, bytes32 currentHash) = target.current();
        assertEq(currentId, vid2);
        assertEq(currentHash, hash2);
    }

    function test_supersede_not_found_reverts() public {
        vm.expectRevert("Version not found");
        target.supersede(keccak256("missing"), keccak256("content"));
    }

    function test_supersede_emits_event() public {
        bytes32 vid1 = target.record(keccak256("v1"), 100, 200, hex"");

        vm.warp(block.timestamp + 50);

        vm.expectEmit(true, false, false, false);
        emit VersionSuperseded(vid1, bytes32(0));

        target.supersede(vid1, keccak256("v2"));
    }

    // --- asOf tests ---

    function test_asOf_finds_matching_version() public {
        vm.warp(1000);
        bytes32 hash1 = keccak256("v1");
        bytes32 vid1 = target.record(hash1, 500, 1500, hex"");

        (bytes32 foundId, bytes32 foundHash) = target.asOf(1000, 1000);
        assertEq(foundId, vid1);
        assertEq(foundHash, hash1);
    }

    function test_asOf_no_match_reverts() public {
        vm.warp(1000);
        target.record(keccak256("v1"), 500, 1500, hex"");

        vm.expectRevert("No version found for given time coordinates");
        target.asOf(1000, 2000); // validTime outside range
    }

    // --- between tests ---

    function test_between_system_dimension() public {
        vm.warp(100);
        bytes32 vid1 = target.record(keccak256("v1"), 0, 1000, hex"");

        vm.warp(200);
        bytes32 vid2 = target.record(keccak256("v2"), 0, 1000, hex"");

        vm.warp(300);
        target.record(keccak256("v3"), 0, 1000, hex"");

        // Query system time range that covers vid1 and vid2 but not vid3
        bytes32[] memory results = target.between(50, 250, "system");
        assertEq(results.length, 2);
        assertEq(results[0], vid1);
        assertEq(results[1], vid2);
    }

    function test_between_valid_dimension() public {
        vm.warp(100);
        bytes32 vid1 = target.record(keccak256("v1"), 0, 500, hex"");

        vm.warp(200);
        target.record(keccak256("v2"), 600, 1000, hex"");

        // Query valid time range 0-500 should only match vid1
        bytes32[] memory results = target.between(0, 400, "valid");
        assertEq(results.length, 1);
        assertEq(results[0], vid1);
    }

    function test_between_empty_results() public {
        vm.warp(100);
        target.record(keccak256("v1"), 0, 500, hex"");

        bytes32[] memory results = target.between(600, 700, "valid");
        assertEq(results.length, 0);
    }

    // --- getVersion tests ---

    function test_getVersion_not_found_reverts() public {
        vm.expectRevert("Version not found");
        target.getVersion(keccak256("nope"));
    }
}
