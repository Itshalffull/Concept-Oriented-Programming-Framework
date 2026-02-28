// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Patch
/// @notice First-class, invertible, composable change objects.
contract Patch {
    struct PatchRecord {
        bytes32 base;
        bytes32 target;
        bytes effect;
        uint256 created;
        bool exists;
    }

    mapping(bytes32 => PatchRecord) private _patches;
    uint256 private _nonce;

    event PatchCreated(bytes32 indexed patchId, bytes32 indexed base, bytes32 indexed target);
    event PatchApplied(bytes32 indexed patchId, bytes32 content);
    event PatchInverted(bytes32 indexed originalId, bytes32 indexed inverseId);
    event PatchComposed(bytes32 indexed firstId, bytes32 indexed secondId, bytes32 indexed composedId);
    event PatchCommuted(bytes32 indexed p1, bytes32 indexed p2, bytes32 p1Prime, bytes32 p2Prime);

    /// @notice Creates a new patch representing a change from base to target.
    /// @param base The base state hash.
    /// @param target The target state hash.
    /// @param effect The encoded effect of the patch.
    /// @return patchId The unique identifier of the created patch.
    function create(bytes32 base, bytes32 target, bytes calldata effect) external returns (bytes32 patchId) {
        patchId = keccak256(abi.encodePacked(base, target, _nonce++));

        _patches[patchId] = PatchRecord({
            base: base,
            target: target,
            effect: effect,
            created: block.timestamp,
            exists: true
        });

        emit PatchCreated(patchId, base, target);
    }

    /// @notice Applies a patch to content, emitting the result.
    /// @param patchId The patch to apply.
    /// @param content The content hash to apply the patch to.
    function applyPatch(bytes32 patchId, bytes32 content) external {
        require(_patches[patchId].exists, "Patch not found");

        emit PatchApplied(patchId, content);
    }

    /// @notice Creates the inverse of a patch by swapping base and target.
    /// @param patchId The patch to invert.
    /// @return inversePatchId The identifier of the new inverse patch.
    function invert(bytes32 patchId) external returns (bytes32 inversePatchId) {
        PatchRecord storage original = _patches[patchId];
        require(original.exists, "Patch not found");

        inversePatchId = keccak256(abi.encodePacked(original.target, original.base, _nonce++));

        _patches[inversePatchId] = PatchRecord({
            base: original.target,
            target: original.base,
            effect: original.effect,
            created: block.timestamp,
            exists: true
        });

        emit PatchInverted(patchId, inversePatchId);
    }

    /// @notice Composes two sequential patches into one. Requires first.target == second.base.
    /// @param first The first patch ID.
    /// @param second The second patch ID.
    /// @return composedId The identifier of the composed patch.
    function compose(bytes32 first, bytes32 second) external returns (bytes32 composedId) {
        PatchRecord storage p1 = _patches[first];
        PatchRecord storage p2 = _patches[second];
        require(p1.exists, "First patch not found");
        require(p2.exists, "Second patch not found");
        require(p1.target == p2.base, "Non-sequential patches: first.target must equal second.base");

        composedId = keccak256(abi.encodePacked(p1.base, p2.target, _nonce++));

        _patches[composedId] = PatchRecord({
            base: p1.base,
            target: p2.target,
            effect: abi.encodePacked(p1.effect, p2.effect),
            created: block.timestamp,
            exists: true
        });

        emit PatchComposed(first, second, composedId);
    }

    /// @notice Attempts to commute two patches, producing reordered equivalents.
    /// @param p1 The first patch ID.
    /// @param p2 The second patch ID.
    /// @return p1Prime The commuted version of p1.
    /// @return p2Prime The commuted version of p2.
    function commute(bytes32 p1, bytes32 p2) external returns (bytes32 p1Prime, bytes32 p2Prime) {
        PatchRecord storage patch1 = _patches[p1];
        PatchRecord storage patch2 = _patches[p2];
        require(patch1.exists, "First patch not found");
        require(patch2.exists, "Second patch not found");
        require(patch1.base != patch2.base, "Cannot commute patches with identical bases");

        p1Prime = keccak256(abi.encodePacked(patch2.target, patch1.target, _nonce++));
        _patches[p1Prime] = PatchRecord({
            base: patch2.target,
            target: patch1.target,
            effect: patch1.effect,
            created: block.timestamp,
            exists: true
        });

        p2Prime = keccak256(abi.encodePacked(patch1.base, patch2.base, _nonce++));
        _patches[p2Prime] = PatchRecord({
            base: patch1.base,
            target: patch2.base,
            effect: patch2.effect,
            created: block.timestamp,
            exists: true
        });

        emit PatchCommuted(p1, p2, p1Prime, p2Prime);
    }

    /// @notice Retrieves a patch record by ID.
    /// @param patchId The patch to retrieve.
    /// @return The patch record.
    function getPatch(bytes32 patchId) external view returns (PatchRecord memory) {
        require(_patches[patchId].exists, "Patch not found");
        return _patches[patchId];
    }
}
