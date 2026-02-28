// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Wallet.sol";

contract WalletTest is Test {
    Wallet public target;

    event Verified(address indexed claimed, address indexed recovered, bool success);
    event NonceIncremented(address indexed addr, uint256 newNonce);

    function setUp() public {
        target = new Wallet();
    }

    // --- verify tests ---

    function test_verify_valid_signature() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        bytes32 messageHash = keccak256("hello");

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, messageHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        (bool success, address recovered) = target.verify(signer, messageHash, sig);
        assertTrue(success);
        assertEq(recovered, signer);
    }

    function test_verify_emits_event() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        bytes32 messageHash = keccak256("hello");

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, messageHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectEmit(true, true, false, true);
        emit Verified(signer, signer, true);

        target.verify(signer, messageHash, sig);
    }

    function test_verify_wrong_signer_returns_false() public {
        uint256 privateKey = 0xA11CE;
        address wrongAddress = address(0xBEEF);
        bytes32 messageHash = keccak256("hello");

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, messageHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        (bool success, address recovered) = target.verify(wrongAddress, messageHash, sig);
        assertFalse(success);
        assertEq(recovered, vm.addr(privateKey));
    }

    function test_verify_invalid_signature_length_reverts() public {
        vm.expectRevert("Invalid signature length");
        target.verify(address(0x1), keccak256("hello"), "short");
    }

    function test_verify_marks_address_as_known() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        bytes32 messageHash = keccak256("hello");

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, messageHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        assertFalse(target.isKnown(signer));

        target.verify(signer, messageHash, sig);

        assertTrue(target.isKnown(signer));
    }

    function test_verify_different_messages() public {
        uint256 privateKey = 0xB0B;
        address signer = vm.addr(privateKey);

        bytes32 msg1 = keccak256("message 1");
        bytes32 msg2 = keccak256("message 2");

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(privateKey, msg1);
        bytes memory sig1 = abi.encodePacked(r1, s1, v1);

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(privateKey, msg2);
        bytes memory sig2 = abi.encodePacked(r2, s2, v2);

        (bool success1, ) = target.verify(signer, msg1, sig1);
        assertTrue(success1);

        (bool success2, ) = target.verify(signer, msg2, sig2);
        assertTrue(success2);

        // Cross-verify should fail: sig1 against msg2
        (bool crossSuccess, ) = target.verify(signer, msg2, sig1);
        assertFalse(crossSuccess);
    }

    // --- getNonce tests ---

    function test_getNonce_starts_at_zero() public {
        assertEq(target.getNonce(address(0x1)), 0);
    }

    function test_getNonce_after_verify() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        bytes32 messageHash = keccak256("hello");

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, messageHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        target.verify(signer, messageHash, sig);
        assertEq(target.getNonce(signer), 0);
    }

    // --- incrementNonce tests ---

    function test_incrementNonce_increases_nonce() public {
        address addr = address(0x1234);

        uint256 nonce1 = target.incrementNonce(addr);
        assertEq(nonce1, 1);
        assertEq(target.getNonce(addr), 1);

        uint256 nonce2 = target.incrementNonce(addr);
        assertEq(nonce2, 2);
        assertEq(target.getNonce(addr), 2);
    }

    function test_incrementNonce_emits_event() public {
        address addr = address(0x1234);

        vm.expectEmit(true, false, false, true);
        emit NonceIncremented(addr, 1);

        target.incrementNonce(addr);
    }

    function test_incrementNonce_zero_address_reverts() public {
        vm.expectRevert("Address cannot be zero");
        target.incrementNonce(address(0));
    }

    function test_incrementNonce_marks_known() public {
        address addr = address(0x5678);

        assertFalse(target.isKnown(addr));

        target.incrementNonce(addr);

        assertTrue(target.isKnown(addr));
    }

    // --- setLabel / getLabel tests ---

    function test_setLabel_and_getLabel() public {
        address addr = address(0x1234);
        target.setLabel(addr, "My Wallet");

        assertEq(target.getLabel(addr), "My Wallet");
    }

    function test_setLabel_zero_address_reverts() public {
        vm.expectRevert("Address cannot be zero");
        target.setLabel(address(0), "label");
    }

    function test_getLabel_empty_for_unknown() public {
        assertEq(target.getLabel(address(0x9999)), "");
    }

    // --- isKnown tests ---

    function test_isKnown_false_initially() public {
        assertFalse(target.isKnown(address(0xABCD)));
    }

    function test_isKnown_true_after_setLabel() public {
        address addr = address(0xABCD);
        target.setLabel(addr, "test");

        assertTrue(target.isKnown(addr));
    }
}
