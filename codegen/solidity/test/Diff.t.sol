// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Diff.sol";

contract DiffTest is Test {
    Diff public target;

    event ProviderRegistered(bytes32 indexed providerId, string name);
    event Identical(bytes32 indexed contentHashA, bytes32 indexed contentHashB);
    event Diffed(bytes32 indexed contentHashA, bytes32 indexed contentHashB, uint256 distance);
    event PatchRequested(bytes32 indexed contentHash, bytes editScript);

    function setUp() public {
        target = new Diff();
    }

    // --- registerProvider tests ---

    function test_registerProvider_stores_provider() public {
        string[] memory types = new string[](1);
        types[0] = "text/plain";

        bytes32 providerId = target.registerProvider("myers", types);

        Diff.Provider memory p = target.getProvider(providerId);
        assertEq(p.name, "myers");
        assertTrue(p.exists);
    }

    function test_registerProvider_emits_event() public {
        string[] memory types = new string[](0);

        vm.expectEmit(false, false, false, true);
        emit ProviderRegistered(bytes32(0), "patience");

        target.registerProvider("patience", types);
    }

    function test_registerProvider_duplicate_name_reverts() public {
        string[] memory types = new string[](0);
        target.registerProvider("myers", types);

        vm.expectRevert("Provider name already registered");
        target.registerProvider("myers", types);
    }

    function test_registerProvider_different_names_ok() public {
        string[] memory types = new string[](0);
        bytes32 id1 = target.registerProvider("myers", types);
        bytes32 id2 = target.registerProvider("patience", types);

        assertTrue(id1 != id2);
    }

    // --- diff tests ---

    function test_diff_identical_returns_identical() public {
        string[] memory types = new string[](0);
        bytes32 algo = target.registerProvider("test-algo", types);

        bytes memory content = "hello world";

        (bool isIdentical, uint256 distance) = target.diff(content, content, algo);
        assertTrue(isIdentical);
        assertEq(distance, 0);
    }

    function test_diff_identical_emits_event() public {
        string[] memory types = new string[](0);
        bytes32 algo = target.registerProvider("test-algo", types);

        bytes memory content = "hello world";
        bytes32 hash = keccak256(content);

        vm.expectEmit(true, true, false, false);
        emit Identical(hash, hash);

        target.diff(content, content, algo);
    }

    function test_diff_different_returns_diffed() public {
        string[] memory types = new string[](0);
        bytes32 algo = target.registerProvider("test-algo", types);

        (bool isIdentical, uint256 distance) = target.diff("hello", "world", algo);
        assertFalse(isIdentical);
        assertTrue(distance > 0);
    }

    function test_diff_different_emits_event() public {
        string[] memory types = new string[](0);
        bytes32 algo = target.registerProvider("test-algo", types);

        bytes memory a = "hello";
        bytes memory b = "world";

        vm.expectEmit(true, true, false, true);
        emit Diffed(keccak256(a), keccak256(b), 1);

        target.diff(a, b, algo);
    }

    function test_diff_different_lengths_distance() public {
        string[] memory types = new string[](0);
        bytes32 algo = target.registerProvider("test-algo", types);

        // "hello" is 5 bytes, "hello world" is 11 bytes, distance = 11 - 5 + 1 = 7
        (bool isIdentical, uint256 distance) = target.diff("hello", "hello world", algo);
        assertFalse(isIdentical);
        assertEq(distance, 7);
    }

    function test_diff_no_provider_reverts() public {
        vm.expectRevert("No provider registered for algorithm");
        target.diff("a", "b", keccak256("nonexistent"));
    }

    // --- patch tests ---

    function test_patch_emits_event() public {
        bytes memory content = "hello";
        bytes memory editScript = hex"0102030405";

        vm.expectEmit(true, false, false, true);
        emit PatchRequested(keccak256(content), editScript);

        target.patch(content, editScript);
    }

    // --- getProvider tests ---

    function test_getProvider_nonexistent_reverts() public {
        vm.expectRevert("Provider does not exist");
        target.getProvider(keccak256("fake"));
    }
}
