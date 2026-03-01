// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FlowToken
/// @notice Manages flow tokens that traverse process graphs.
/// @dev Tokens have status: Active -> Consumed|Dead

contract FlowToken {

    // --- Types ---

    enum Status { Active, Consumed, Dead }

    struct TokenData {
        bytes32 tokenId;
        bytes32 runRef;
        bytes32 currentStepRef;
        Status status;
        uint256 createdAt;
        uint256 resolvedAt;
        bool exists;
    }

    struct TokenView {
        bytes32 tokenId;
        bytes32 runRef;
        bytes32 currentStepRef;
        Status status;
        uint256 createdAt;
        uint256 resolvedAt;
    }

    // --- Storage ---

    mapping(bytes32 => TokenData) private tokens;
    mapping(bytes32 => bytes32[]) private runTokens;

    // --- Events ---

    event EmitCompleted(bytes32 indexed tokenId, bytes32 indexed runRef, bytes32 indexed currentStepRef);
    event ConsumeCompleted(bytes32 indexed tokenId);
    event KillCompleted(bytes32 indexed tokenId);

    // --- Actions ---

    /// @notice Emit a new flow token at a given step
    function emit_(bytes32 tokenId, bytes32 runRef, bytes32 currentStepRef) external {
        require(!tokens[tokenId].exists, "FlowToken: token already exists");

        tokens[tokenId] = TokenData({
            tokenId: tokenId,
            runRef: runRef,
            currentStepRef: currentStepRef,
            status: Status.Active,
            createdAt: block.timestamp,
            resolvedAt: 0,
            exists: true
        });

        runTokens[runRef].push(tokenId);

        emit EmitCompleted(tokenId, runRef, currentStepRef);
    }

    /// @notice Consume an active token (normal flow completion)
    function consume(bytes32 tokenId) external {
        TokenData storage token = tokens[tokenId];
        require(token.exists, "FlowToken: not found");
        require(token.status == Status.Active, "FlowToken: must be Active to consume");

        token.status = Status.Consumed;
        token.resolvedAt = block.timestamp;

        emit ConsumeCompleted(tokenId);
    }

    /// @notice Kill an active token (cancel/error path)
    function kill(bytes32 tokenId) external {
        TokenData storage token = tokens[tokenId];
        require(token.exists, "FlowToken: not found");
        require(token.status == Status.Active, "FlowToken: must be Active to kill");

        token.status = Status.Dead;
        token.resolvedAt = block.timestamp;

        emit KillCompleted(tokenId);
    }

    /// @notice Count active tokens for a given run
    function countActive(bytes32 runRef) external view returns (uint256 count) {
        bytes32[] memory tokenIds = runTokens[runRef];
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokens[tokenIds[i]].status == Status.Active) {
                count++;
            }
        }
    }

    /// @notice List active token IDs for a given run
    function listActive(bytes32 runRef) external view returns (bytes32[] memory) {
        bytes32[] memory allTokenIds = runTokens[runRef];
        uint256 activeCount = 0;

        // First pass: count actives
        for (uint256 i = 0; i < allTokenIds.length; i++) {
            if (tokens[allTokenIds[i]].status == Status.Active) {
                activeCount++;
            }
        }

        // Second pass: collect
        bytes32[] memory activeTokens = new bytes32[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < allTokenIds.length; i++) {
            if (tokens[allTokenIds[i]].status == Status.Active) {
                activeTokens[idx] = allTokenIds[i];
                idx++;
            }
        }

        return activeTokens;
    }

    /// @notice Get token details
    function getToken(bytes32 tokenId) external view returns (TokenView memory) {
        TokenData storage token = tokens[tokenId];
        require(token.exists, "FlowToken: not found");

        return TokenView({
            tokenId: token.tokenId,
            runRef: token.runRef,
            currentStepRef: token.currentStepRef,
            status: token.status,
            createdAt: token.createdAt,
            resolvedAt: token.resolvedAt
        });
    }
}
