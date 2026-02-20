// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Echo.sol";

contract EchoTest is Test {
    Echo public target;

    event Echoed(bytes32 indexed id, string text);

    function setUp() public {
        target = new Echo();
    }

    // --- send tests ---

    function test_send_returns_same_text() public {
        bytes32 id = keccak256("msg1");
        string memory result = target.send(id, "Hello, World!");

        assertEq(result, "Hello, World!", "Echoed text should match input");
    }

    function test_send_stores_message() public {
        bytes32 id = keccak256("msg1");
        target.send(id, "stored message");

        string memory stored = target.getMessage(id);
        assertEq(stored, "stored message", "Stored message should match sent text");
    }

    function test_send_zero_id_reverts() public {
        vm.expectRevert("ID cannot be zero");
        target.send(bytes32(0), "hello");
    }

    function test_send_empty_text_reverts() public {
        bytes32 id = keccak256("msg1");
        vm.expectRevert("Text cannot be empty");
        target.send(id, "");
    }

    function test_send_multiple_messages() public {
        bytes32 id1 = keccak256("msg1");
        bytes32 id2 = keccak256("msg2");

        target.send(id1, "first");
        target.send(id2, "second");

        assertEq(target.getMessage(id1), "first", "First message should persist");
        assertEq(target.getMessage(id2), "second", "Second message should persist");
    }

    function test_send_overwrite() public {
        bytes32 id = keccak256("msg1");

        target.send(id, "original");
        target.send(id, "overwritten");

        assertEq(target.getMessage(id), "overwritten", "Message should be overwritten");
    }

    function test_send_emits_event() public {
        bytes32 id = keccak256("msg1");

        vm.expectEmit(true, false, false, true);
        emit Echoed(id, "hello event");

        target.send(id, "hello event");
    }

    function test_getMessage_nonexistent() public {
        bytes32 id = keccak256("nonexistent");
        string memory result = target.getMessage(id);
        assertEq(bytes(result).length, 0, "Nonexistent message should return empty string");
    }
}
