// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Signature
/// @notice Cryptographic proof of authorship, integrity, and temporal existence
/// @dev Implements the Signature concept from Clef specification.
///      Supports signing content hashes by trusted identities, verifying signatures,
///      and managing a trusted signer registry.

contract Signature {
    // --- Types ---

    struct SignatureRecord {
        bytes32 contentHash;
        bytes32 signer;
        bytes certificate;
        uint256 timestamp;
        bool valid;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps signature ID to its SignatureRecord entry
    mapping(bytes32 => SignatureRecord) private _signatures;

    /// @dev Maps identity to trusted signer status
    mapping(bytes32 => bool) private _trustedSigners;

    /// @dev Ordered list of trusted signer identities
    bytes32[] private _trustedSignerList;

    /// @dev Nonce for generating unique signature IDs
    uint256 private _nonce;

    // --- Events ---

    event Signed(bytes32 indexed signatureId, bytes32 indexed contentHash, bytes32 indexed signer);
    event Verified(bytes32 indexed signatureId, bytes32 identity, uint256 timestamp);
    event TrustedSignerAdded(bytes32 indexed identity);

    // --- Actions ---

    /// @notice Sign a content hash with a trusted identity
    /// @param contentHash The hash of the content being signed
    /// @param identity The signer identity (must be a trusted signer)
    /// @return signatureId The generated signature ID
    function sign(bytes32 contentHash, bytes32 identity) external returns (bytes32 signatureId) {
        require(contentHash != bytes32(0), "Content hash cannot be zero");
        require(identity != bytes32(0), "Identity cannot be zero");
        require(_trustedSigners[identity], "Unknown identity: signer is not trusted");

        signatureId = keccak256(abi.encodePacked(contentHash, identity, block.timestamp, _nonce));
        _nonce++;

        _signatures[signatureId] = SignatureRecord({
            contentHash: contentHash,
            signer: identity,
            certificate: "",
            timestamp: block.timestamp,
            valid: true,
            exists: true
        });

        emit Signed(signatureId, contentHash, identity);

        return signatureId;
    }

    /// @notice Verify a signature against a content hash
    /// @param contentHash The content hash to verify against
    /// @param signatureId The signature ID to verify
    /// @return identity The signer identity
    /// @return timestamp The time the signature was created
    function verify(bytes32 contentHash, bytes32 signatureId) external view returns (bytes32 identity, uint256 timestamp) {
        require(_signatures[signatureId].exists, "Signature not found");
        require(_signatures[signatureId].valid, "Signature is invalid");
        require(_signatures[signatureId].contentHash == contentHash, "Content hash mismatch");
        require(_trustedSigners[_signatures[signatureId].signer], "Signer is no longer trusted");

        identity = _signatures[signatureId].signer;
        timestamp = _signatures[signatureId].timestamp;

        return (identity, timestamp);
    }

    /// @notice Add an identity to the trusted signer registry
    /// @param identity The identity to trust
    function addTrustedSigner(bytes32 identity) external {
        require(identity != bytes32(0), "Identity cannot be zero");
        require(!_trustedSigners[identity], "Signer already trusted");

        _trustedSigners[identity] = true;
        _trustedSignerList.push(identity);

        emit TrustedSignerAdded(identity);
    }

    // --- Views ---

    /// @notice Retrieve a signature record
    /// @param signatureId The signature to look up
    /// @return The SignatureRecord struct
    function getSignature(bytes32 signatureId) external view returns (SignatureRecord memory) {
        require(_signatures[signatureId].exists, "Signature not found");
        return _signatures[signatureId];
    }

    /// @notice Check if an identity is a trusted signer
    /// @param identity The identity to check
    /// @return Whether the identity is trusted
    function isTrustedSigner(bytes32 identity) external view returns (bool) {
        return _trustedSigners[identity];
    }

    /// @notice Get all trusted signers
    /// @return Array of trusted signer identities
    function getTrustedSigners() external view returns (bytes32[] memory) {
        return _trustedSignerList;
    }
}
