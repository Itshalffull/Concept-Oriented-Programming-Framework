// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ChainMonitor.sol";

contract ChainMonitorTest is Test {
    ChainMonitor public target;

    event Subscribed(uint256 indexed chainId, string rpcUrl);
    event BlockReceived(uint256 indexed chainId, uint256 blockNumber, bytes32 blockHash);
    event FinalityReached(bytes32 indexed txHash, uint256 confirmations);
    event Reorged(uint256 indexed chainId, uint256 oldBlock, bytes32 oldHash, uint256 newBlock, bytes32 newHash);

    function setUp() public {
        target = new ChainMonitor();
    }

    // --- subscribe tests ---

    function test_subscribe_creates_subscription() public {
        target.subscribe(1, "https://rpc.chain1.io");

        (bool active, string memory rpcUrl, uint256 latestBlock, bytes32 latestHash) = target.getSubscription(1);
        assertTrue(active);
        assertEq(rpcUrl, "https://rpc.chain1.io");
        assertEq(latestBlock, 0);
        assertEq(latestHash, bytes32(0));
    }

    function test_subscribe_emits_event() public {
        vm.expectEmit(true, false, false, true);
        emit Subscribed(1, "https://rpc.chain1.io");

        target.subscribe(1, "https://rpc.chain1.io");
    }

    function test_subscribe_zero_chainId_reverts() public {
        vm.expectRevert("Chain ID cannot be zero");
        target.subscribe(0, "https://rpc.chain1.io");
    }

    function test_subscribe_empty_rpcUrl_reverts() public {
        vm.expectRevert("RPC URL cannot be empty");
        target.subscribe(1, "");
    }

    function test_subscribe_duplicate_reverts() public {
        target.subscribe(1, "https://rpc.chain1.io");

        vm.expectRevert("Chain already subscribed");
        target.subscribe(1, "https://rpc.chain1.io");
    }

    function test_subscribe_multiple_chains() public {
        target.subscribe(1, "https://rpc.chain1.io");
        target.subscribe(137, "https://rpc.polygon.io");

        (bool active1,,,) = target.getSubscription(1);
        (bool active137,,,) = target.getSubscription(137);
        assertTrue(active1);
        assertTrue(active137);
    }

    // --- onBlock tests ---

    function test_onBlock_updates_block_height() public {
        target.subscribe(1, "https://rpc.chain1.io");
        bytes32 hash1 = keccak256("block100");

        target.onBlock(1, 100, hash1);

        (, , uint256 latestBlock, bytes32 latestHash) = target.getSubscription(1);
        assertEq(latestBlock, 100);
        assertEq(latestHash, hash1);
    }

    function test_onBlock_emits_BlockReceived() public {
        target.subscribe(1, "https://rpc.chain1.io");
        bytes32 hash1 = keccak256("block100");

        vm.expectEmit(true, false, false, true);
        emit BlockReceived(1, 100, hash1);

        target.onBlock(1, 100, hash1);
    }

    function test_onBlock_unsubscribed_reverts() public {
        vm.expectRevert("Chain not subscribed");
        target.onBlock(1, 100, keccak256("block100"));
    }

    function test_onBlock_zero_hash_reverts() public {
        target.subscribe(1, "https://rpc.chain1.io");

        vm.expectRevert("Block hash cannot be zero");
        target.onBlock(1, 100, bytes32(0));
    }

    function test_onBlock_detects_reorg() public {
        target.subscribe(1, "https://rpc.chain1.io");

        bytes32 hash100 = keccak256("block100");
        bytes32 hash99reorg = keccak256("block99reorg");

        target.onBlock(1, 100, hash100);

        vm.expectEmit(true, false, false, true);
        emit Reorged(1, 100, hash100, 99, hash99reorg);

        bool reorged = target.onBlock(1, 99, hash99reorg);
        assertTrue(reorged);
    }

    function test_onBlock_no_reorg_on_advance() public {
        target.subscribe(1, "https://rpc.chain1.io");

        target.onBlock(1, 100, keccak256("block100"));
        bool reorged = target.onBlock(1, 101, keccak256("block101"));
        assertFalse(reorged);
    }

    // --- awaitFinality + onBlock finality tracking tests ---

    function test_awaitFinality_registers_pending() public {
        target.subscribe(1, "https://rpc.chain1.io");
        target.onBlock(1, 100, keccak256("block100"));

        bytes32 txHash = keccak256("tx1");
        target.awaitFinality(txHash, 1, 100, 3);

        (bool exists, uint256 current, uint256 required, bool resolved) = target.getPendingFinality(txHash);
        assertTrue(exists);
        assertEq(current, 0);
        assertEq(required, 3);
        assertFalse(resolved);
    }

    function test_awaitFinality_resolves_immediately_if_enough_confirmations() public {
        target.subscribe(1, "https://rpc.chain1.io");
        target.onBlock(1, 105, keccak256("block105"));

        bytes32 txHash = keccak256("tx1");

        vm.expectEmit(true, false, false, true);
        emit FinalityReached(txHash, 5);

        target.awaitFinality(txHash, 1, 100, 3);

        (, , , bool resolved) = target.getPendingFinality(txHash);
        assertTrue(resolved);
    }

    function test_finality_reached_via_blocks() public {
        target.subscribe(1, "https://rpc.chain1.io");
        target.onBlock(1, 100, keccak256("block100"));

        bytes32 txHash = keccak256("tx1");
        target.awaitFinality(txHash, 1, 100, 3);

        target.onBlock(1, 101, keccak256("block101"));
        (, uint256 c1, , bool r1) = target.getPendingFinality(txHash);
        assertEq(c1, 1);
        assertFalse(r1);

        target.onBlock(1, 102, keccak256("block102"));
        (, uint256 c2, , bool r2) = target.getPendingFinality(txHash);
        assertEq(c2, 2);
        assertFalse(r2);

        vm.expectEmit(true, false, false, true);
        emit FinalityReached(txHash, 3);

        target.onBlock(1, 103, keccak256("block103"));
        (, uint256 c3, , bool r3) = target.getPendingFinality(txHash);
        assertEq(c3, 3);
        assertTrue(r3);
    }

    function test_awaitFinality_zero_txHash_reverts() public {
        target.subscribe(1, "https://rpc.chain1.io");

        vm.expectRevert("Tx hash cannot be zero");
        target.awaitFinality(bytes32(0), 1, 100, 3);
    }

    function test_awaitFinality_unsubscribed_chain_reverts() public {
        vm.expectRevert("Chain not subscribed");
        target.awaitFinality(keccak256("tx1"), 99, 100, 3);
    }

    function test_awaitFinality_zero_confirmations_reverts() public {
        target.subscribe(1, "https://rpc.chain1.io");

        vm.expectRevert("Required confirmations must be > 0");
        target.awaitFinality(keccak256("tx1"), 1, 100, 0);
    }

    function test_awaitFinality_duplicate_reverts() public {
        target.subscribe(1, "https://rpc.chain1.io");
        target.onBlock(1, 100, keccak256("block100"));

        bytes32 txHash = keccak256("tx1");
        target.awaitFinality(txHash, 1, 100, 3);

        vm.expectRevert("Already awaiting finality for this tx");
        target.awaitFinality(txHash, 1, 100, 3);
    }

    // --- getPendingFinality tests ---

    function test_getPendingFinality_unknown_returns_false() public {
        (bool exists, , , ) = target.getPendingFinality(keccak256("unknown"));
        assertFalse(exists);
    }

    // --- getSubscription tests ---

    function test_getSubscription_unknown_returns_inactive() public {
        (bool active, , , ) = target.getSubscription(999);
        assertFalse(active);
    }
}
