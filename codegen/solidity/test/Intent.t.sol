// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Intent.sol";

contract IntentTest is Test {
    Intent public target;

    event Defined(bytes32 indexed targetId);
    event Updated(bytes32 indexed targetId);

    function setUp() public {
        target = new Intent();
    }

    // --- defineIntent tests ---

    function test_defineIntent_stores_record() public {
        bytes32 id = keccak256("project1");
        target.defineIntent(id, "Build tools", "Simplicity first", "A developer toolkit");

        Intent.IntentRecord memory record = target.get(id);
        assertEq(record.purpose, "Build tools");
        assertEq(record.principles, "Simplicity first");
        assertEq(record.description, "A developer toolkit");
        assertTrue(record.exists);
    }

    function test_defineIntent_emits_event() public {
        bytes32 id = keccak256("project1");

        vm.expectEmit(true, false, false, false);
        emit Defined(id);

        target.defineIntent(id, "purpose", "principles", "description");
    }

    function test_defineIntent_zero_id_reverts() public {
        vm.expectRevert("Target ID cannot be zero");
        target.defineIntent(bytes32(0), "purpose", "principles", "description");
    }

    function test_defineIntent_duplicate_reverts() public {
        bytes32 id = keccak256("project1");
        target.defineIntent(id, "purpose", "principles", "description");

        vm.expectRevert("Intent already defined");
        target.defineIntent(id, "purpose2", "principles2", "description2");
    }

    function test_defineIntent_increments_count() public {
        assertEq(target.count(), 0);

        target.defineIntent(keccak256("a"), "p", "pr", "d");
        assertEq(target.count(), 1);

        target.defineIntent(keccak256("b"), "p", "pr", "d");
        assertEq(target.count(), 2);
    }

    // --- update tests ---

    function test_update_changes_fields() public {
        bytes32 id = keccak256("project1");
        target.defineIntent(id, "old purpose", "old principles", "old description");

        target.update(id, "new purpose", "new principles", "new description");

        Intent.IntentRecord memory record = target.get(id);
        assertEq(record.purpose, "new purpose");
        assertEq(record.principles, "new principles");
        assertEq(record.description, "new description");
    }

    function test_update_emits_event() public {
        bytes32 id = keccak256("project1");
        target.defineIntent(id, "purpose", "principles", "description");

        vm.expectEmit(true, false, false, false);
        emit Updated(id);

        target.update(id, "new", "new", "new");
    }

    function test_update_nonexistent_reverts() public {
        vm.expectRevert("Intent not found");
        target.update(keccak256("missing"), "p", "pr", "d");
    }

    // --- get tests ---

    function test_get_nonexistent_reverts() public {
        vm.expectRevert("Intent not found");
        target.get(keccak256("missing"));
    }

    // --- exists tests ---

    function test_exists_returns_false_for_unknown() public {
        assertFalse(target.exists(keccak256("unknown")));
    }

    function test_exists_returns_true_after_define() public {
        bytes32 id = keccak256("project1");
        target.defineIntent(id, "p", "pr", "d");
        assertTrue(target.exists(id));
    }
}
