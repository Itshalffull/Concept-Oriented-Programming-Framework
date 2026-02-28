// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Signature.sol";

contract SignatureTest is Test {
    Signature public target;

    event Signed(bytes32 indexed signatureId, bytes32 indexed contentHash, bytes32 indexed signer);
    event TrustedSignerAdded(bytes32 indexed identity);

    function setUp() public {
        target = new Signature();
    }

    // --- addTrustedSigner tests ---

    function test_addTrustedSigner_adds_identity() public {
        bytes32 identity = keccak256("alice");
        target.addTrustedSigner(identity);

        assertTrue(target.isTrustedSigner(identity));
    }

    function test_addTrustedSigner_emits_event() public {
        bytes32 identity = keccak256("alice");

        vm.expectEmit(true, false, false, false);
        emit TrustedSignerAdded(identity);

        target.addTrustedSigner(identity);
    }

    function test_addTrustedSigner_duplicate_reverts() public {
        bytes32 identity = keccak256("alice");
        target.addTrustedSigner(identity);

        vm.expectRevert("Signer already trusted");
        target.addTrustedSigner(identity);
    }

    function test_addTrustedSigner_zero_identity_reverts() public {
        vm.expectRevert("Identity cannot be zero");
        target.addTrustedSigner(bytes32(0));
    }

    function test_addTrustedSigner_appears_in_list() public {
        bytes32 alice = keccak256("alice");
        bytes32 bob = keccak256("bob");
        target.addTrustedSigner(alice);
        target.addTrustedSigner(bob);

        bytes32[] memory signers = target.getTrustedSigners();
        assertEq(signers.length, 2);
        assertEq(signers[0], alice);
        assertEq(signers[1], bob);
    }

    // --- sign tests ---

    function test_sign_creates_record() public {
        bytes32 identity = keccak256("alice");
        bytes32 contentHash = keccak256("document-v1");
        target.addTrustedSigner(identity);

        bytes32 sigId = target.sign(contentHash, identity);

        Signature.SignatureRecord memory record = target.getSignature(sigId);
        assertEq(record.contentHash, contentHash);
        assertEq(record.signer, identity);
        assertTrue(record.valid);
        assertTrue(record.exists);
        assertEq(record.timestamp, block.timestamp);
    }

    function test_sign_emits_event() public {
        bytes32 identity = keccak256("alice");
        bytes32 contentHash = keccak256("document-v1");
        target.addTrustedSigner(identity);

        vm.expectEmit(false, true, true, false);
        emit Signed(bytes32(0), contentHash, identity);

        target.sign(contentHash, identity);
    }

    function test_sign_untrusted_signer_reverts() public {
        bytes32 identity = keccak256("alice");
        bytes32 contentHash = keccak256("document-v1");

        vm.expectRevert("Unknown identity: signer is not trusted");
        target.sign(contentHash, identity);
    }

    function test_sign_zero_content_hash_reverts() public {
        bytes32 identity = keccak256("alice");
        target.addTrustedSigner(identity);

        vm.expectRevert("Content hash cannot be zero");
        target.sign(bytes32(0), identity);
    }

    function test_sign_zero_identity_reverts() public {
        vm.expectRevert("Identity cannot be zero");
        target.sign(keccak256("doc"), bytes32(0));
    }

    function test_sign_generates_unique_ids() public {
        bytes32 identity = keccak256("alice");
        bytes32 hash1 = keccak256("doc1");
        bytes32 hash2 = keccak256("doc2");
        target.addTrustedSigner(identity);

        bytes32 sigId1 = target.sign(hash1, identity);
        bytes32 sigId2 = target.sign(hash2, identity);

        assertTrue(sigId1 != sigId2);
    }

    // --- verify tests ---

    function test_verify_returns_valid() public {
        bytes32 identity = keccak256("alice");
        bytes32 contentHash = keccak256("document-v1");
        target.addTrustedSigner(identity);

        vm.warp(1000);
        bytes32 sigId = target.sign(contentHash, identity);

        (bytes32 signer, uint256 timestamp) = target.verify(contentHash, sigId);
        assertEq(signer, identity);
        assertEq(timestamp, 1000);
    }

    function test_verify_nonexistent_signature_reverts() public {
        bytes32 contentHash = keccak256("document-v1");
        bytes32 fakeSigId = keccak256("fake");

        vm.expectRevert("Signature not found");
        target.verify(contentHash, fakeSigId);
    }

    function test_verify_content_hash_mismatch_reverts() public {
        bytes32 identity = keccak256("alice");
        bytes32 contentHash = keccak256("document-v1");
        bytes32 wrongHash = keccak256("wrong-document");
        target.addTrustedSigner(identity);

        bytes32 sigId = target.sign(contentHash, identity);

        vm.expectRevert("Content hash mismatch");
        target.verify(wrongHash, sigId);
    }

    // --- getSignature tests ---

    function test_getSignature_nonexistent_reverts() public {
        vm.expectRevert("Signature not found");
        target.getSignature(keccak256("nonexistent"));
    }

    // --- isTrustedSigner tests ---

    function test_isTrustedSigner_returns_false_for_unknown() public view {
        assertFalse(target.isTrustedSigner(keccak256("unknown")));
    }
}
