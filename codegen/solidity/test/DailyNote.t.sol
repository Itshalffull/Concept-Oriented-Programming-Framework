// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DailyNote.sol";

contract DailyNoteTest is Test {
    DailyNote public target;

    event NoteCreated(bytes32 indexed dateHash, bytes32 indexed pageId);

    function setUp() public {
        target = new DailyNote();
    }

    // --- createNote tests ---

    function test_createNote_stores_mapping() public {
        bytes32 dateHash = keccak256("2026-02-21");
        bytes32 pageId = keccak256("page1");
        target.createNote(dateHash, pageId);

        (bool found, bytes32 pid) = target.getNote(dateHash);
        assertTrue(found);
        assertEq(pid, pageId);
    }

    function test_createNote_emits_event() public {
        bytes32 dateHash = keccak256("2026-02-21");
        bytes32 pageId = keccak256("page1");

        vm.expectEmit(true, true, false, false);
        emit NoteCreated(dateHash, pageId);

        target.createNote(dateHash, pageId);
    }

    function test_createNote_duplicate_date_reverts() public {
        bytes32 dateHash = keccak256("2026-02-21");
        bytes32 pageId = keccak256("page1");
        target.createNote(dateHash, pageId);

        vm.expectRevert("Note already exists for this date");
        target.createNote(dateHash, keccak256("page2"));
    }

    function test_createNote_zero_page_reverts() public {
        bytes32 dateHash = keccak256("2026-02-21");

        vm.expectRevert("Invalid page ID");
        target.createNote(dateHash, bytes32(0));
    }

    // --- getNote tests ---

    function test_getNote_returns_false_for_unknown() public {
        (bool found, bytes32 pid) = target.getNote(keccak256("unknown"));
        assertFalse(found);
        assertEq(pid, bytes32(0));
    }

    // --- noteCount tests ---

    function test_noteCount_starts_at_zero() public {
        assertEq(target.noteCount(), 0);
    }

    function test_noteCount_increments() public {
        target.createNote(keccak256("2026-01-01"), keccak256("p1"));
        target.createNote(keccak256("2026-01-02"), keccak256("p2"));
        target.createNote(keccak256("2026-01-03"), keccak256("p3"));

        assertEq(target.noteCount(), 3);
    }
}
