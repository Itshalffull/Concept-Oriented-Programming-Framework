// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/InlineAnnotation.sol";

contract InlineAnnotationTest is Test {
    InlineAnnotation public target;

    event Annotated(bytes32 indexed annotationId, bytes32 indexed contentRef, string changeType);
    event Accepted(bytes32 indexed annotationId);
    event Rejected(bytes32 indexed annotationId);
    event AcceptedAll(bytes32 indexed contentRef, uint256 count);
    event RejectedAll(bytes32 indexed contentRef, uint256 count);
    event TrackingToggled(bytes32 indexed contentRef, bool enabled);

    function setUp() public {
        target = new InlineAnnotation();
    }

    // --- annotate tests ---

    function test_annotate_creates_record() public {
        bytes32 contentRef = keccak256("doc1");
        bytes32 author = keccak256("alice");

        bytes32 annId = target.annotate(contentRef, "insertion", "line 5", author);

        InlineAnnotation.Annotation memory ann = target.getAnnotation(annId);
        assertEq(ann.contentRef, contentRef);
        assertEq(ann.author, author);
        assertEq(ann.status, 0); // pending
        assertTrue(ann.exists);
    }

    function test_annotate_validates_change_type() public {
        bytes32 contentRef = keccak256("doc1");
        bytes32 author = keccak256("alice");

        // Valid types should succeed
        target.annotate(contentRef, "insertion", "", author);
        target.annotate(contentRef, "deletion", "", author);
        target.annotate(contentRef, "formatting", "", author);
        target.annotate(contentRef, "move", "", author);

        // Invalid type should revert
        vm.expectRevert("Invalid change type");
        target.annotate(contentRef, "invalid", "", author);
    }

    function test_annotate_zero_contentRef_reverts() public {
        vm.expectRevert("Content ref cannot be zero");
        target.annotate(bytes32(0), "insertion", "", keccak256("alice"));
    }

    function test_annotate_zero_author_reverts() public {
        vm.expectRevert("Author cannot be zero");
        target.annotate(keccak256("doc1"), "insertion", "", bytes32(0));
    }

    function test_annotate_emits_event() public {
        bytes32 contentRef = keccak256("doc1");

        vm.expectEmit(false, true, false, false);
        emit Annotated(bytes32(0), contentRef, "insertion");

        target.annotate(contentRef, "insertion", "", keccak256("alice"));
    }

    // --- accept tests ---

    function test_accept_changes_status() public {
        bytes32 contentRef = keccak256("doc1");
        bytes32 annId = target.annotate(contentRef, "insertion", "", keccak256("alice"));

        target.accept(annId);

        InlineAnnotation.Annotation memory ann = target.getAnnotation(annId);
        assertEq(ann.status, 1); // accepted
    }

    function test_accept_emits_event() public {
        bytes32 annId = target.annotate(keccak256("doc1"), "deletion", "", keccak256("alice"));

        vm.expectEmit(true, false, false, false);
        emit Accepted(annId);

        target.accept(annId);
    }

    function test_accept_nonexistent_reverts() public {
        vm.expectRevert("Annotation does not exist");
        target.accept(keccak256("fake"));
    }

    function test_accept_already_accepted_reverts() public {
        bytes32 annId = target.annotate(keccak256("doc1"), "insertion", "", keccak256("alice"));
        target.accept(annId);

        vm.expectRevert("Annotation is not pending");
        target.accept(annId);
    }

    // --- reject tests ---

    function test_reject_changes_status() public {
        bytes32 contentRef = keccak256("doc1");
        bytes32 annId = target.annotate(contentRef, "deletion", "", keccak256("alice"));

        target.reject(annId);

        InlineAnnotation.Annotation memory ann = target.getAnnotation(annId);
        assertEq(ann.status, 2); // rejected
    }

    function test_reject_emits_event() public {
        bytes32 annId = target.annotate(keccak256("doc1"), "insertion", "", keccak256("alice"));

        vm.expectEmit(true, false, false, false);
        emit Rejected(annId);

        target.reject(annId);
    }

    function test_reject_nonexistent_reverts() public {
        vm.expectRevert("Annotation does not exist");
        target.reject(keccak256("fake"));
    }

    function test_reject_already_rejected_reverts() public {
        bytes32 annId = target.annotate(keccak256("doc1"), "insertion", "", keccak256("alice"));
        target.reject(annId);

        vm.expectRevert("Annotation is not pending");
        target.reject(annId);
    }

    // --- acceptAll tests ---

    function test_acceptAll_accepts_all_pending() public {
        bytes32 contentRef = keccak256("doc1");
        bytes32 ann1 = target.annotate(contentRef, "insertion", "", keccak256("alice"));
        bytes32 ann2 = target.annotate(contentRef, "deletion", "", keccak256("bob"));

        uint256 count = target.acceptAll(contentRef);

        assertEq(count, 2);
        assertEq(target.getAnnotation(ann1).status, 1);
        assertEq(target.getAnnotation(ann2).status, 1);
    }

    function test_acceptAll_skips_already_resolved() public {
        bytes32 contentRef = keccak256("doc1");
        bytes32 ann1 = target.annotate(contentRef, "insertion", "", keccak256("alice"));
        target.annotate(contentRef, "deletion", "", keccak256("bob"));

        // Reject one first
        target.reject(ann1);

        uint256 count = target.acceptAll(contentRef);
        assertEq(count, 1); // Only the second one
    }

    // --- rejectAll tests ---

    function test_rejectAll_rejects_all_pending() public {
        bytes32 contentRef = keccak256("doc1");
        bytes32 ann1 = target.annotate(contentRef, "insertion", "", keccak256("alice"));
        bytes32 ann2 = target.annotate(contentRef, "formatting", "", keccak256("bob"));

        uint256 count = target.rejectAll(contentRef);

        assertEq(count, 2);
        assertEq(target.getAnnotation(ann1).status, 2);
        assertEq(target.getAnnotation(ann2).status, 2);
    }

    // --- toggleTracking tests ---

    function test_toggleTracking_enables_tracking() public {
        bytes32 contentRef = keccak256("doc1");

        target.toggleTracking(contentRef, true);
        assertTrue(target.isTrackingEnabled(contentRef));
    }

    function test_toggleTracking_disables_tracking() public {
        bytes32 contentRef = keccak256("doc1");

        target.toggleTracking(contentRef, true);
        target.toggleTracking(contentRef, false);
        assertFalse(target.isTrackingEnabled(contentRef));
    }

    function test_toggleTracking_emits_event() public {
        bytes32 contentRef = keccak256("doc1");

        vm.expectEmit(true, false, false, true);
        emit TrackingToggled(contentRef, true);

        target.toggleTracking(contentRef, true);
    }

    function test_toggleTracking_zero_contentRef_reverts() public {
        vm.expectRevert("Content ref cannot be zero");
        target.toggleTracking(bytes32(0), true);
    }

    // --- listPending tests ---

    function test_listPending_returns_only_pending() public {
        bytes32 contentRef = keccak256("doc1");
        target.annotate(contentRef, "insertion", "", keccak256("alice"));
        bytes32 ann2 = target.annotate(contentRef, "deletion", "", keccak256("bob"));
        bytes32 ann3 = target.annotate(contentRef, "formatting", "", keccak256("carol"));

        // Accept the first annotation
        bytes32[] memory allAnns = target.getContentAnnotations(contentRef);
        target.accept(allAnns[0]);

        bytes32[] memory pending = target.listPending(contentRef);
        assertEq(pending.length, 2);
        assertEq(pending[0], ann2);
        assertEq(pending[1], ann3);
    }

    function test_listPending_empty_when_all_resolved() public {
        bytes32 contentRef = keccak256("doc1");
        target.annotate(contentRef, "insertion", "", keccak256("alice"));

        target.acceptAll(contentRef);

        bytes32[] memory pending = target.listPending(contentRef);
        assertEq(pending.length, 0);
    }

    // --- getAnnotation tests ---

    function test_getAnnotation_nonexistent_reverts() public {
        vm.expectRevert("Annotation does not exist");
        target.getAnnotation(keccak256("fake"));
    }
}
