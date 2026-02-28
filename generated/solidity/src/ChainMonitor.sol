// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ChainMonitor
/// @notice Generated from ChainMonitor concept specification
/// @dev Skeleton contract — implement action bodies

contract ChainMonitor {

    // --- Storage (from concept state) ---

    // entries
    mapping(bytes32 => bytes) private entries;

    // subscriptions
    mapping(bytes32 => bool) private subscriptions;
    bytes32[] private subscriptionsKeys;

    // --- Types ---

    struct AwaitFinalityInput {
        string txHash;
        string level;
    }

    struct AwaitFinalityOkResult {
        bool success;
        string chain;
        int256 block;
        int256 confirmations;
    }

    struct AwaitFinalityReorgedResult {
        bool success;
        string txHash;
        int256 depth;
    }

    struct AwaitFinalityTimeoutResult {
        bool success;
        string txHash;
    }

    struct SubscribeInput {
        int256 chainId;
        string rpcUrl;
    }

    struct SubscribeOkResult {
        bool success;
        int256 chainId;
    }

    struct SubscribeErrorResult {
        bool success;
        string message;
    }

    struct OnBlockInput {
        int256 chainId;
        int256 blockNumber;
        string blockHash;
    }

    struct OnBlockOkResult {
        bool success;
        int256 chainId;
        int256 blockNumber;
    }

    struct OnBlockReorgResult {
        bool success;
        int256 chainId;
        int256 depth;
        int256 fromBlock;
    }

    // --- Events ---

    event AwaitFinalityCompleted(string variant, int256 block, int256 confirmations, int256 depth);
    event SubscribeCompleted(string variant, int256 chainId);
    event OnBlockCompleted(string variant, int256 chainId, int256 blockNumber, int256 depth, int256 fromBlock);

    // --- Actions ---

    /// @notice awaitFinality
    function awaitFinality(string memory txHash, string memory level) external returns (AwaitFinalityOkResult memory) {
        // Invariant checks
        // invariant 1: after awaitFinality, status behaves correctly
        // invariant 2: after awaitFinality, status behaves correctly

        // TODO: Implement awaitFinality
        revert("Not implemented");
    }

    /// @notice subscribe
    function subscribe(int256 chainId, string memory rpcUrl) external returns (SubscribeOkResult memory) {
        // TODO: Implement subscribe
        revert("Not implemented");
    }

    /// @notice onBlock
    function onBlock(int256 chainId, int256 blockNumber, string memory blockHash) external returns (OnBlockOkResult memory) {
        // TODO: Implement onBlock
        revert("Not implemented");
    }

}
