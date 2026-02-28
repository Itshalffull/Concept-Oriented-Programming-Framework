// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Wallet
/// @notice Concept-oriented wallet signature verification and nonce management
/// @dev Implements the Wallet concept from Clef specification.
///      Wraps ecrecover for signature verification and tracks per-address nonces.

contract Wallet {
    // --- Storage ---

    /// @dev Maps wallet address to its replay-protection nonce
    mapping(address => uint256) private _nonces;

    /// @dev Maps wallet address to whether it has been seen
    mapping(address => bool) private _known;

    /// @dev Maps wallet address to an optional human-readable label
    mapping(address => string) private _labels;

    // --- Events ---

    event Verified(address indexed claimed, address indexed recovered, bool success);
    event NonceIncremented(address indexed addr, uint256 newNonce);

    // --- Actions ---

    /// @notice Verify a signature against a claimed signer address
    /// @param claimed The address that claims to have signed
    /// @param messageHash The hash of the signed message (must be pre-hashed with appropriate prefix)
    /// @param signature The 65-byte signature (r, s, v packed)
    /// @return success Whether the recovered address matches the claimed address
    /// @return recovered The address recovered from the signature
    function verify(
        address claimed,
        bytes32 messageHash,
        bytes calldata signature
    ) external returns (bool success, address recovered) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;

        recovered = ecrecover(messageHash, v, r, s);
        success = (recovered == claimed && recovered != address(0));

        if (!_known[claimed]) {
            _known[claimed] = true;
            _nonces[claimed] = 0;
        }

        emit Verified(claimed, recovered, success);
    }

    /// @notice Increment the nonce for an address (for replay protection)
    /// @param addr The address whose nonce to increment
    /// @return newNonce The new nonce value after incrementing
    function incrementNonce(address addr) external returns (uint256 newNonce) {
        require(addr != address(0), "Address cannot be zero");

        if (!_known[addr]) {
            _known[addr] = true;
        }

        _nonces[addr]++;
        newNonce = _nonces[addr];

        emit NonceIncremented(addr, newNonce);
    }

    /// @notice Set a human-readable label for an address
    /// @param addr The wallet address
    /// @param label The label to assign
    function setLabel(address addr, string calldata label) external {
        require(addr != address(0), "Address cannot be zero");

        if (!_known[addr]) {
            _known[addr] = true;
        }

        _labels[addr] = label;
    }

    // --- Views ---

    /// @notice Get the current nonce for an address
    /// @param addr The wallet address
    /// @return nonce The current nonce value
    function getNonce(address addr) external view returns (uint256 nonce) {
        return _nonces[addr];
    }

    /// @notice Check if an address is known to the contract
    /// @param addr The wallet address
    /// @return Whether the address has been seen
    function isKnown(address addr) external view returns (bool) {
        return _known[addr];
    }

    /// @notice Get the label for an address
    /// @param addr The wallet address
    /// @return label The human-readable label
    function getLabel(address addr) external view returns (string memory label) {
        return _labels[addr];
    }
}
