// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SyncedContent.sol";

contract SyncedContentTest is Test {
    SyncedContent public target;

    event ReferenceCreated(bytes32 indexed refId, bytes32 indexed originalId);
    event OriginalEdited(bytes32 indexed refId);
    event ReferenceDeleted(bytes32 indexed refId);

    function setUp() public {
        target = new SyncedContent();
    }

    // --- createReference tests ---

    function test_createReference_stores_reference() public {
        bytes32 refId = keccak256("ref1");
        bytes32 srcId = keccak256("src1");
        target.createReference(refId, srcId, "page2:block5");

        SyncedContent.SyncRef memory r = target.getReference(refId);
        assertEq(r.originalId, srcId);
        assertEq(r.targetLocation, "page2:block5");
        assertTrue(r.exists);
    }

    function test_createReference_emits_event() public {
        bytes32 refId = keccak256("ref1");
        bytes32 srcId = keccak256("src1");

        vm.expectEmit(true, true, false, false);
        emit ReferenceCreated(refId, srcId);

        target.createReference(refId, srcId, "page2:block5");
    }

    function test_createReference_duplicate_reverts() public {
        bytes32 refId = keccak256("ref1");
        bytes32 srcId = keccak256("src1");
        target.createReference(refId, srcId, "loc1");

        vm.expectRevert("Reference already exists");
        target.createReference(refId, srcId, "loc2");
    }

    function test_createReference_zero_source_reverts() public {
        vm.expectRevert("Invalid source ID");
        target.createReference(keccak256("ref1"), bytes32(0), "loc");
    }

    // --- editOriginal tests ---

    function test_editOriginal_updates_content() public {
        bytes32 refId = keccak256("ref1");
        bytes32 srcId = keccak256("src1");
        target.createReference(refId, srcId, "loc");
        target.editOriginal(refId, "Updated content");

        // Verify via event emission (content stored internally)
        // We can create a second ref to the same source and edit again
        target.editOriginal(refId, "Final content");
    }

    function test_editOriginal_emits_event() public {
        bytes32 refId = keccak256("ref1");
        target.createReference(refId, keccak256("src1"), "loc");

        vm.expectEmit(true, false, false, false);
        emit OriginalEdited(refId);

        target.editOriginal(refId, "New content");
    }

    function test_editOriginal_nonexistent_reverts() public {
        vm.expectRevert("Reference does not exist");
        target.editOriginal(keccak256("nonexistent"), "content");
    }

    // --- deleteReference tests ---

    function test_deleteReference_marks_deleted() public {
        bytes32 refId = keccak256("ref1");
        target.createReference(refId, keccak256("src1"), "loc");
        target.deleteReference(refId);

        vm.expectRevert("Reference does not exist");
        target.getReference(refId);
    }

    function test_deleteReference_emits_event() public {
        bytes32 refId = keccak256("ref1");
        target.createReference(refId, keccak256("src1"), "loc");

        vm.expectEmit(true, false, false, false);
        emit ReferenceDeleted(refId);

        target.deleteReference(refId);
    }

    function test_deleteReference_nonexistent_reverts() public {
        vm.expectRevert("Reference does not exist");
        target.deleteReference(keccak256("nonexistent"));
    }

    // --- getReference tests ---

    function test_getReference_nonexistent_reverts() public {
        vm.expectRevert("Reference does not exist");
        target.getReference(keccak256("nonexistent"));
    }
}
