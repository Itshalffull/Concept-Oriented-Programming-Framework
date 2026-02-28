// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Patch.sol";

contract PatchTest is Test {
    Patch public target;

    event PatchCreated(bytes32 indexed patchId, bytes32 indexed base, bytes32 indexed target);
    event PatchApplied(bytes32 indexed patchId, bytes32 content);
    event PatchInverted(bytes32 indexed originalId, bytes32 indexed inverseId);
    event PatchComposed(bytes32 indexed firstId, bytes32 indexed secondId, bytes32 indexed composedId);
    event PatchCommuted(bytes32 indexed p1, bytes32 indexed p2, bytes32 p1Prime, bytes32 p2Prime);

    function setUp() public {
        target = new Patch();
    }

    // --- create tests ---

    function test_create_stores_patch() public {
        bytes32 base = keccak256("stateA");
        bytes32 tgt = keccak256("stateB");
        bytes memory effect = hex"aabb";

        bytes32 patchId = target.create(base, tgt, effect);

        Patch.PatchRecord memory p = target.getPatch(patchId);
        assertEq(p.base, base);
        assertEq(p.target, tgt);
        assertEq(p.effect, effect);
        assertTrue(p.exists);
    }

    function test_create_emits_event() public {
        bytes32 base = keccak256("stateA");
        bytes32 tgt = keccak256("stateB");

        vm.expectEmit(false, true, true, false);
        emit PatchCreated(bytes32(0), base, tgt);

        target.create(base, tgt, hex"");
    }

    // --- apply tests ---

    function test_apply_emits_event() public {
        bytes32 base = keccak256("stateA");
        bytes32 tgt = keccak256("stateB");
        bytes32 patchId = target.create(base, tgt, hex"cc");
        bytes32 content = keccak256("content1");

        vm.expectEmit(true, false, false, true);
        emit PatchApplied(patchId, content);

        target.applyPatch(patchId, content);
    }

    function test_applyPatch_nonexistent_reverts() public {
        vm.expectRevert("Patch not found");
        target.applyPatch(keccak256("nope"), keccak256("content"));
    }

    // --- invert tests ---

    function test_invert_swaps_base_and_target() public {
        bytes32 base = keccak256("stateA");
        bytes32 tgt = keccak256("stateB");
        bytes32 patchId = target.create(base, tgt, hex"dd");

        bytes32 inverseId = target.invert(patchId);

        Patch.PatchRecord memory inv = target.getPatch(inverseId);
        assertEq(inv.base, tgt);
        assertEq(inv.target, base);
    }

    function test_invert_nonexistent_reverts() public {
        vm.expectRevert("Patch not found");
        target.invert(keccak256("missing"));
    }

    // --- compose tests ---

    function test_compose_sequential_patches() public {
        bytes32 a = keccak256("A");
        bytes32 b = keccak256("B");
        bytes32 c = keccak256("C");

        bytes32 p1 = target.create(a, b, hex"01");
        bytes32 p2 = target.create(b, c, hex"02");

        bytes32 composed = target.compose(p1, p2);

        Patch.PatchRecord memory comp = target.getPatch(composed);
        assertEq(comp.base, a);
        assertEq(comp.target, c);
    }

    function test_compose_nonsequential_reverts() public {
        bytes32 a = keccak256("A");
        bytes32 b = keccak256("B");
        bytes32 c = keccak256("C");
        bytes32 d = keccak256("D");

        bytes32 p1 = target.create(a, b, hex"01");
        bytes32 p2 = target.create(c, d, hex"02");

        vm.expectRevert("Non-sequential patches: first.target must equal second.base");
        target.compose(p1, p2);
    }

    function test_compose_first_not_found_reverts() public {
        bytes32 b = keccak256("B");
        bytes32 c = keccak256("C");
        bytes32 p2 = target.create(b, c, hex"02");

        vm.expectRevert("First patch not found");
        target.compose(keccak256("missing"), p2);
    }

    // --- commute tests ---

    function test_commute_creates_primes() public {
        bytes32 a = keccak256("A");
        bytes32 b = keccak256("B");
        bytes32 c = keccak256("C");
        bytes32 d = keccak256("D");

        bytes32 p1 = target.create(a, b, hex"01");
        bytes32 p2 = target.create(c, d, hex"02");

        (bytes32 p1Prime, bytes32 p2Prime) = target.commute(p1, p2);

        Patch.PatchRecord memory prime1 = target.getPatch(p1Prime);
        Patch.PatchRecord memory prime2 = target.getPatch(p2Prime);

        assertEq(prime1.base, d);
        assertEq(prime1.target, b);
        assertEq(prime2.base, a);
        assertEq(prime2.target, c);
    }

    function test_commute_identical_bases_reverts() public {
        bytes32 a = keccak256("A");
        bytes32 b = keccak256("B");
        bytes32 c = keccak256("C");

        bytes32 p1 = target.create(a, b, hex"01");
        bytes32 p2 = target.create(a, c, hex"02");

        vm.expectRevert("Cannot commute patches with identical bases");
        target.commute(p1, p2);
    }

    // --- getPatch tests ---

    function test_getPatch_nonexistent_reverts() public {
        vm.expectRevert("Patch not found");
        target.getPatch(keccak256("nope"));
    }
}
