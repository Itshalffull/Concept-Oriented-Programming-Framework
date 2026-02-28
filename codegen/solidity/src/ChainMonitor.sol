// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ChainMonitor
/// @notice Concept-oriented blockchain state monitor for finality, reorgs, and confirmation tracking
/// @dev Implements the ChainMonitor concept from Clef specification.
///      Tracks subscriptions per chainId, detects reorgs, and resolves pending finality requests.

contract ChainMonitor {
    // --- Types ---

    struct Subscription {
        uint256 chainId;
        string rpcUrl;
        uint256 latestBlock;
        bytes32 latestHash;
        bool active;
    }

    struct PendingFinality {
        bytes32 txHash;
        uint256 blockNumber;
        uint256 requiredConfirmations;
        uint256 currentConfirmations;
        bool resolved;
    }

    // --- Storage ---

    /// @dev Maps chainId to its subscription
    mapping(uint256 => Subscription) private _subscriptions;

    /// @dev Maps txHash to its pending finality request
    mapping(bytes32 => PendingFinality) private _pending;

    /// @dev Tracks which chainId a pending txHash belongs to
    mapping(bytes32 => uint256) private _pendingChainId;

    /// @dev Array of all pending tx hashes for iteration
    bytes32[] private _pendingTxHashes;

    // --- Events ---

    event Subscribed(uint256 indexed chainId, string rpcUrl);
    event BlockReceived(uint256 indexed chainId, uint256 blockNumber, bytes32 blockHash);
    event FinalityReached(bytes32 indexed txHash, uint256 confirmations);
    event Reorged(uint256 indexed chainId, uint256 oldBlock, bytes32 oldHash, uint256 newBlock, bytes32 newHash);

    // --- Actions ---

    /// @notice Subscribe to monitor a chain
    /// @param chainId The chain identifier
    /// @param rpcUrl The RPC endpoint URL for the chain
    function subscribe(uint256 chainId, string calldata rpcUrl) external {
        require(chainId != 0, "Chain ID cannot be zero");
        require(bytes(rpcUrl).length > 0, "RPC URL cannot be empty");
        require(!_subscriptions[chainId].active, "Chain already subscribed");

        _subscriptions[chainId] = Subscription({
            chainId: chainId,
            rpcUrl: rpcUrl,
            latestBlock: 0,
            latestHash: bytes32(0),
            active: true
        });

        emit Subscribed(chainId, rpcUrl);
    }

    /// @notice Process a new block for a subscribed chain
    /// @param chainId The chain identifier
    /// @param blockNumber The new block number
    /// @param blockHash The new block hash
    /// @return reorged Whether a reorg was detected
    function onBlock(uint256 chainId, uint256 blockNumber, bytes32 blockHash) external returns (bool reorged) {
        Subscription storage sub = _subscriptions[chainId];
        require(sub.active, "Chain not subscribed");
        require(blockHash != bytes32(0), "Block hash cannot be zero");

        // Detect reorg: new block number is less than or equal to latest, with different hash
        if (blockNumber <= sub.latestBlock && sub.latestBlock > 0) {
            emit Reorged(chainId, sub.latestBlock, sub.latestHash, blockNumber, blockHash);
            reorged = true;
        }

        uint256 oldBlock = sub.latestBlock;
        sub.latestBlock = blockNumber;
        sub.latestHash = blockHash;

        emit BlockReceived(chainId, blockNumber, blockHash);

        // Increment confirmations for all pending finality requests on this chain
        for (uint256 i = 0; i < _pendingTxHashes.length; i++) {
            bytes32 txHash = _pendingTxHashes[i];
            PendingFinality storage pf = _pending[txHash];

            if (pf.resolved) continue;
            if (_pendingChainId[txHash] != chainId) continue;

            // Only increment if block is advancing past the tx's block
            if (blockNumber > pf.blockNumber && blockNumber > oldBlock) {
                pf.currentConfirmations++;
            }

            if (pf.currentConfirmations >= pf.requiredConfirmations) {
                pf.resolved = true;
                emit FinalityReached(txHash, pf.currentConfirmations);
            }
        }
    }

    /// @notice Register a pending finality request for a transaction
    /// @param txHash The transaction hash to track
    /// @param chainId The chain where the transaction was submitted
    /// @param blockNumber The block number containing the transaction
    /// @param requiredConfirmations Number of confirmations needed for finality
    function awaitFinality(
        bytes32 txHash,
        uint256 chainId,
        uint256 blockNumber,
        uint256 requiredConfirmations
    ) external {
        require(txHash != bytes32(0), "Tx hash cannot be zero");
        require(_subscriptions[chainId].active, "Chain not subscribed");
        require(requiredConfirmations > 0, "Required confirmations must be > 0");
        require(!_pending[txHash].resolved, "Finality already resolved");
        require(_pending[txHash].txHash == bytes32(0), "Already awaiting finality for this tx");

        // Calculate current confirmations based on latest block
        uint256 currentConfs = 0;
        Subscription storage sub = _subscriptions[chainId];
        if (sub.latestBlock > blockNumber) {
            currentConfs = sub.latestBlock - blockNumber;
        }

        _pending[txHash] = PendingFinality({
            txHash: txHash,
            blockNumber: blockNumber,
            requiredConfirmations: requiredConfirmations,
            currentConfirmations: currentConfs,
            resolved: false
        });
        _pendingChainId[txHash] = chainId;
        _pendingTxHashes.push(txHash);

        // If already met, resolve immediately
        if (currentConfs >= requiredConfirmations) {
            _pending[txHash].resolved = true;
            emit FinalityReached(txHash, currentConfs);
        }
    }

    // --- Views ---

    /// @notice Get subscription details for a chain
    /// @param chainId The chain identifier
    /// @return active Whether the subscription is active
    /// @return rpcUrl The RPC endpoint URL
    /// @return latestBlock The latest known block number
    /// @return latestHash The latest known block hash
    function getSubscription(uint256 chainId)
        external
        view
        returns (bool active, string memory rpcUrl, uint256 latestBlock, bytes32 latestHash)
    {
        Subscription storage sub = _subscriptions[chainId];
        return (sub.active, sub.rpcUrl, sub.latestBlock, sub.latestHash);
    }

    /// @notice Get pending finality details for a transaction
    /// @param txHash The transaction hash
    /// @return exists Whether a finality request exists
    /// @return currentConfirmations Current number of confirmations
    /// @return requiredConfirmations Required number of confirmations
    /// @return resolved Whether finality has been reached
    function getPendingFinality(bytes32 txHash)
        external
        view
        returns (bool exists, uint256 currentConfirmations, uint256 requiredConfirmations, bool resolved)
    {
        PendingFinality storage pf = _pending[txHash];
        if (pf.txHash == bytes32(0)) {
            return (false, 0, 0, false);
        }
        return (true, pf.currentConfirmations, pf.requiredConfirmations, pf.resolved);
    }
}
