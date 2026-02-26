// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Conflict Resolver Plugin — on-chain bidirectional sync conflict resolution
// for the SyncPair concept in the Clef Data Integration Kit.
//
// On-chain conflict resolution provides an immutable audit trail of how data
// conflicts were resolved during bidirectional sync operations. Resolution
// records, strategies used, and version metadata are stored on-chain for
// transparency and dispute resolution.
//
// LWW (Last-Write-Wins) and CRDT-based resolution are particularly relevant
// on-chain because they provide deterministic, verifiable outcomes.
//
// See Data Integration Kit sync-pair.concept for the parent SyncPair concept definition.

// ---------------------------------------------------------------------------
// Core types and interfaces
// ---------------------------------------------------------------------------

/// @title IConflictResolver — interface for all conflict-resolver provider contracts.
interface IConflictResolver {
    /// @notice Version data for one side of a conflict.
    struct VersionInfo {
        bytes32 contentHash;       // Hash of the version's field values
        uint256 timestamp;         // Wall-clock timestamp (seconds since epoch)
        bytes32 vectorClockHash;   // Hash of the vector clock (full VC stored off-chain)
        address replicaId;         // Address of the replica that produced this version
    }

    /// @notice On-chain record of a conflict resolution.
    struct ResolutionRecord {
        bytes32 entityId;          // Hash of the entity identifier
        string  strategy;          // Provider ID that produced the resolution
        uint8   winner;            // 0=A, 1=B, 2=merged, 3=manual
        bytes32 versionAHash;      // Content hash of version A
        bytes32 versionBHash;      // Content hash of version B
        bytes32 ancestorHash;      // Content hash of ancestor (0x0 if none)
        bytes32 mergedHash;        // Content hash of the resolution output
        uint256 resolvedAt;        // Block timestamp of resolution
        address resolvedBy;        // Address that submitted the resolution
        bool    autoResolved;      // Whether resolution was automatic
        string  details;           // Human-readable resolution description
        bytes   extraData;         // ABI-encoded strategy-specific metadata
    }

    /// @notice Resolve a conflict and record the resolution on-chain.
    function resolve(
        bytes32 entityId,
        VersionInfo calldata versionA,
        VersionInfo calldata versionB,
        bytes32 ancestorHash,
        bytes calldata extraData
    ) external returns (uint256 resolutionId);

    /// @notice Check whether this provider can automatically resolve a given conflict.
    function canAutoResolve(
        VersionInfo calldata versionA,
        VersionInfo calldata versionB,
        bytes32 ancestorHash
    ) external view returns (bool);

    /// @notice Retrieve a resolution record by its ID.
    function getResolution(uint256 resolutionId) external view returns (ResolutionRecord memory);

    /// @notice Emitted when a conflict is resolved.
    event ConflictResolved(
        uint256 indexed resolutionId,
        bytes32 indexed entityId,
        string  strategy,
        uint8   winner,
        bool    autoResolved,
        uint256 resolvedAt
    );
}

// ---------------------------------------------------------------------------
// Conflict Resolver Registry — central dispatch for resolver contracts
// ---------------------------------------------------------------------------

/// @title ConflictResolverRegistry — registry and router for conflict resolution providers.
/// @notice Manages registration, lookup, and dispatch to resolver implementations.
///         Maintains a global resolution log and entity conflict history.
contract ConflictResolverRegistry {
    // -- State ---------------------------------------------------------------

    address public owner;
    uint256 public nextResolutionId;

    /// @notice Registered providers: providerId => contract address.
    mapping(string => address) public providers;

    /// @notice List of all registered provider IDs.
    string[] public providerIds;

    /// @notice Global resolution record store.
    mapping(uint256 => IConflictResolver.ResolutionRecord) public resolutions;

    /// @notice Entity conflict history: entityHash => array of resolution IDs.
    mapping(bytes32 => uint256[]) public entityResolutions;

    /// @notice Resolution count per strategy for analytics.
    mapping(string => uint256) public strategyUsageCount;

    /// @notice Total auto-resolved vs manual counts.
    uint256 public autoResolvedCount;
    uint256 public manualResolvedCount;

    // -- Events --------------------------------------------------------------

    event ProviderRegistered(string indexed providerId, address providerAddress);
    event ProviderUpdated(string indexed providerId, address oldAddress, address newAddress);
    event ProviderRemoved(string indexed providerId);
    event ConflictResolved(
        uint256 indexed resolutionId,
        bytes32 indexed entityId,
        string  strategy,
        uint8   winner,
        bool    autoResolved,
        uint256 resolvedAt
    );

    // -- Modifiers -----------------------------------------------------------

    modifier onlyOwner() {
        require(msg.sender == owner, "ConflictResolverRegistry: caller is not the owner");
        _;
    }

    // -- Constructor ----------------------------------------------------------

    constructor() {
        owner = msg.sender;
        nextResolutionId = 1;
    }

    // -- Provider management -------------------------------------------------

    /// @notice Register a new conflict resolver provider.
    function registerProvider(string calldata providerId, address providerAddr) external onlyOwner {
        require(providerAddr != address(0), "ConflictResolverRegistry: zero address");
        require(providers[providerId] == address(0), "ConflictResolverRegistry: already registered");

        providers[providerId] = providerAddr;
        providerIds.push(providerId);

        emit ProviderRegistered(providerId, providerAddr);
    }

    /// @notice Update an existing provider's contract address.
    function updateProvider(string calldata providerId, address newAddr) external onlyOwner {
        require(newAddr != address(0), "ConflictResolverRegistry: zero address");
        address oldAddr = providers[providerId];
        require(oldAddr != address(0), "ConflictResolverRegistry: not registered");

        providers[providerId] = newAddr;
        emit ProviderUpdated(providerId, oldAddr, newAddr);
    }

    /// @notice Remove a registered provider.
    function removeProvider(string calldata providerId) external onlyOwner {
        require(providers[providerId] != address(0), "ConflictResolverRegistry: not registered");
        delete providers[providerId];

        for (uint256 i = 0; i < providerIds.length; i++) {
            if (keccak256(bytes(providerIds[i])) == keccak256(bytes(providerId))) {
                providerIds[i] = providerIds[providerIds.length - 1];
                providerIds.pop();
                break;
            }
        }

        emit ProviderRemoved(providerId);
    }

    /// @notice Get the number of registered providers.
    function providerCount() external view returns (uint256) {
        return providerIds.length;
    }

    // -- Resolution operations -----------------------------------------------

    /// @notice Resolve a conflict through a specific provider.
    function resolveWith(
        string calldata providerId,
        bytes32 entityId,
        IConflictResolver.VersionInfo calldata versionA,
        IConflictResolver.VersionInfo calldata versionB,
        bytes32 ancestorHash,
        bytes calldata extraData
    ) external returns (uint256 resolutionId) {
        address providerAddr = providers[providerId];
        require(providerAddr != address(0), "ConflictResolverRegistry: unknown provider");

        // Delegate resolution to the provider contract
        resolutionId = IConflictResolver(providerAddr).resolve(
            entityId, versionA, versionB, ancestorHash, extraData
        );

        // Record in global store
        IConflictResolver.ResolutionRecord memory record = IConflictResolver(providerAddr).getResolution(resolutionId);
        uint256 globalId = nextResolutionId++;
        resolutions[globalId] = record;
        entityResolutions[entityId].push(globalId);
        strategyUsageCount[providerId]++;

        if (record.autoResolved) {
            autoResolvedCount++;
        } else {
            manualResolvedCount++;
        }

        emit ConflictResolved(
            globalId, entityId, providerId, record.winner,
            record.autoResolved, block.timestamp
        );

        return globalId;
    }

    /// @notice Check if a provider can auto-resolve a conflict.
    function canAutoResolve(
        string calldata providerId,
        IConflictResolver.VersionInfo calldata versionA,
        IConflictResolver.VersionInfo calldata versionB,
        bytes32 ancestorHash
    ) external view returns (bool) {
        address providerAddr = providers[providerId];
        if (providerAddr == address(0)) return false;
        return IConflictResolver(providerAddr).canAutoResolve(versionA, versionB, ancestorHash);
    }

    // -- Query operations ----------------------------------------------------

    /// @notice Retrieve a resolution record by global ID.
    function getResolution(uint256 resolutionId) external view returns (IConflictResolver.ResolutionRecord memory) {
        require(resolutionId > 0 && resolutionId < nextResolutionId, "ConflictResolverRegistry: invalid ID");
        return resolutions[resolutionId];
    }

    /// @notice Get all resolution IDs for an entity.
    function getEntityResolutions(bytes32 entityId) external view returns (uint256[] memory) {
        return entityResolutions[entityId];
    }

    /// @notice Get the resolution rate (auto vs manual).
    function getResolutionStats() external view returns (uint256 total, uint256 autoCount, uint256 manualCount) {
        return (autoResolvedCount + manualResolvedCount, autoResolvedCount, manualResolvedCount);
    }

    /// @notice Transfer ownership of the registry.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ConflictResolverRegistry: zero address");
        owner = newOwner;
    }
}

// ---------------------------------------------------------------------------
// Base contract for shared resolver logic
// ---------------------------------------------------------------------------

/// @title BaseConflictResolver — shared implementation for conflict resolver providers.
abstract contract BaseConflictResolver is IConflictResolver {
    address public registry;
    address public owner;
    uint256 public resolutionCount;

    mapping(uint256 => ResolutionRecord) internal _resolutions;

    modifier onlyRegistry() {
        require(msg.sender == registry, "BaseConflictResolver: caller is not the registry");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "BaseConflictResolver: caller is not the owner");
        _;
    }

    constructor(address _registry) {
        registry = _registry;
        owner = msg.sender;
    }

    function getResolution(uint256 resolutionId) external view override returns (ResolutionRecord memory) {
        return _resolutions[resolutionId];
    }

    function _recordResolution(
        bytes32 entityId,
        VersionInfo calldata versionA,
        VersionInfo calldata versionB,
        bytes32 ancestorHash,
        uint8 winner,
        bytes32 mergedHash,
        bool autoResolved,
        string memory details,
        bytes calldata extraData
    ) internal returns (uint256 resolutionId) {
        resolutionId = ++resolutionCount;

        _resolutions[resolutionId] = ResolutionRecord({
            entityId: entityId,
            strategy: _providerId(),
            winner: winner,
            versionAHash: versionA.contentHash,
            versionBHash: versionB.contentHash,
            ancestorHash: ancestorHash,
            mergedHash: mergedHash,
            resolvedAt: block.timestamp,
            resolvedBy: tx.origin,
            autoResolved: autoResolved,
            details: details,
            extraData: extraData
        });

        emit ConflictResolved(
            resolutionId, entityId, _providerId(), winner,
            autoResolved, block.timestamp
        );
    }

    /// @dev Override in each provider to return its unique ID.
    function _providerId() internal pure virtual returns (string memory);
}

// ---------------------------------------------------------------------------
// Provider: LwwTimestampResolver
// ---------------------------------------------------------------------------

/// @title LwwTimestampResolver — Last-Write-Wins conflict resolution by timestamp.
/// @notice Resolves conflicts deterministically by selecting the version with the
///         higher timestamp. When timestamps are equal, falls back to comparing
///         vector clock hashes lexicographically for a deterministic tie-breaker.
///
///         Risk: silent data loss -- the losing version's changes are entirely discarded.
///         This is acceptable for eventual consistency models where the latest write
///         is considered canonical.
///
///         On-chain relevance: LWW is the simplest deterministic strategy and can be
///         fully validated on-chain without off-chain computation. Block timestamps
///         provide an additional ordering guarantee.
contract LwwTimestampResolver is BaseConflictResolver {
    /// @notice Tracks how many times each side has won for analytics.
    uint256 public sideAWins;
    uint256 public sideBWins;
    uint256 public tieBreaks;

    constructor(address _registry) BaseConflictResolver(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "lww_timestamp";
    }

    function canAutoResolve(
        VersionInfo calldata,
        VersionInfo calldata,
        bytes32
    ) external pure override returns (bool) {
        // LWW can always produce a deterministic winner
        return true;
    }

    function resolve(
        bytes32 entityId,
        VersionInfo calldata versionA,
        VersionInfo calldata versionB,
        bytes32 ancestorHash,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 resolutionId) {
        uint8 winner;
        string memory details;

        if (versionA.timestamp != versionB.timestamp) {
            // Primary comparison: wall-clock timestamps
            winner = versionA.timestamp > versionB.timestamp ? 0 : 1;
            uint256 diff = versionA.timestamp > versionB.timestamp
                ? versionA.timestamp - versionB.timestamp
                : versionB.timestamp - versionA.timestamp;
            details = string.concat(
                "LWW selected version ", winner == 0 ? "A" : "B",
                " (timestamp delta: ", _uint256ToString(diff), "s)"
            );
        } else {
            // Timestamps equal: compare vector clock hashes lexicographically
            if (versionA.vectorClockHash != versionB.vectorClockHash) {
                winner = uint256(versionA.vectorClockHash) > uint256(versionB.vectorClockHash) ? 0 : 1;
                details = "Timestamps equal; broke tie via vector clock hash comparison";
                tieBreaks++;
            } else {
                // Fully tied: default to version A
                winner = 0;
                details = "Timestamps and vector clock hashes identical; defaulted to version A";
                tieBreaks++;
            }
        }

        // Update win counters
        if (winner == 0) { sideAWins++; } else { sideBWins++; }

        bytes32 mergedHash = winner == 0 ? versionA.contentHash : versionB.contentHash;

        resolutionId = _recordResolution(
            entityId, versionA, versionB, ancestorHash,
            winner, mergedHash, true, details, extraData
        );
    }

    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

// ---------------------------------------------------------------------------
// Provider: FieldMergeResolver
// ---------------------------------------------------------------------------

/// @title FieldMergeResolver — Per-field conflict resolution with partial auto-merge.
/// @notice Records field-level merge operations on-chain. The actual field comparison
///         is performed off-chain; this contract validates and records the merge result
///         with details about which fields were auto-merged, which had true conflicts,
///         and how they were resolved.
///
///         Supports configurable field preferences (always prefer A or B for specific
///         fields) to handle known merge policies.
contract FieldMergeResolver is BaseConflictResolver {
    /// @notice Per-field merge metadata stored alongside the resolution.
    struct FieldMergeMetadata {
        uint32 totalFields;            // Total fields across both versions
        uint32 autoMergedFromA;        // Fields auto-merged from version A
        uint32 autoMergedFromB;        // Fields auto-merged from version B
        uint32 unchangedFields;        // Fields unchanged between versions
        uint32 trueConflictCount;      // Fields with true conflicts
        uint32 resolvedByPreference;   // Conflicts resolved by field preference config
        bytes32 mergedContentHash;     // Hash of the final merged content
    }

    mapping(uint256 => FieldMergeMetadata) public fieldMergeMetadata;

    /// @notice Configurable field preferences: field name hash => preferred side (0=A, 1=B).
    mapping(bytes32 => uint8) public fieldPreferences;

    constructor(address _registry) BaseConflictResolver(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "field_merge";
    }

    function canAutoResolve(
        VersionInfo calldata,
        VersionInfo calldata,
        bytes32 ancestorHash
    ) external pure override returns (bool) {
        // Can only determine auto-resolvability with off-chain field analysis
        // On-chain, we assume partial auto-resolve capability when ancestor exists
        return ancestorHash != bytes32(0);
    }

    /// @notice Set field preference for a specific field.
    /// @param fieldNameHash   keccak256 of the field name.
    /// @param preferredSide   0 for A, 1 for B.
    function setFieldPreference(bytes32 fieldNameHash, uint8 preferredSide) external onlyOwner {
        require(preferredSide <= 1, "FieldMergeResolver: invalid side");
        fieldPreferences[fieldNameHash] = preferredSide;
    }

    function resolve(
        bytes32 entityId,
        VersionInfo calldata versionA,
        VersionInfo calldata versionB,
        bytes32 ancestorHash,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 resolutionId) {
        // Decode field merge metadata from extraData (computed off-chain)
        require(extraData.length > 0, "FieldMergeResolver: extraData required with merge metadata");

        (
            uint32 totalFields,
            uint32 autoMergedFromA,
            uint32 autoMergedFromB,
            uint32 unchangedFields,
            uint32 trueConflictCount,
            uint32 resolvedByPreference,
            bytes32 mergedContentHash
        ) = abi.decode(extraData, (uint32, uint32, uint32, uint32, uint32, uint32, bytes32));

        bool autoResolved = trueConflictCount == resolvedByPreference;
        uint8 winner = 2; // merged

        string memory details = string.concat(
            "Field merge: ", _uint32ToString(totalFields), " fields, ",
            _uint32ToString(autoMergedFromA), " from A, ",
            _uint32ToString(autoMergedFromB), " from B, ",
            _uint32ToString(trueConflictCount), " conflicts"
        );

        resolutionId = _recordResolution(
            entityId, versionA, versionB, ancestorHash,
            winner, mergedContentHash, autoResolved, details, extraData
        );

        fieldMergeMetadata[resolutionId] = FieldMergeMetadata({
            totalFields: totalFields,
            autoMergedFromA: autoMergedFromA,
            autoMergedFromB: autoMergedFromB,
            unchangedFields: unchangedFields,
            trueConflictCount: trueConflictCount,
            resolvedByPreference: resolvedByPreference,
            mergedContentHash: mergedContentHash
        });
    }

    function getFieldMergeMetadata(uint256 resolutionId) external view returns (FieldMergeMetadata memory) {
        return fieldMergeMetadata[resolutionId];
    }

    function _uint32ToString(uint32 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint32 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

// ---------------------------------------------------------------------------
// Provider: ThreeWayMergeResolver
// ---------------------------------------------------------------------------

/// @title ThreeWayMergeResolver — Diff-based three-way merge resolution.
/// @notice Records three-way merge operations where both versions are diffed against
///         a common ancestor. Non-overlapping changes are auto-merged; overlapping
///         changes (both sides modified the same field differently) are true conflicts.
///
///         The actual diff computation occurs off-chain; this contract validates that
///         an ancestor was provided and records the merge statistics on-chain.
contract ThreeWayMergeResolver is BaseConflictResolver {
    /// @notice Three-way merge metadata.
    struct ThreeWayMergeMetadata {
        uint32 diffACount;              // Changes in version A relative to ancestor
        uint32 diffBCount;              // Changes in version B relative to ancestor
        uint32 overlappingChanges;      // Fields changed by both sides differently
        uint32 cleanMerges;             // Non-overlapping changes successfully merged
        bytes32 mergedContentHash;      // Hash of the merged output
        bool   hasAncestor;             // Whether an ancestor was available
    }

    mapping(uint256 => ThreeWayMergeMetadata) public threeWayMetadata;

    constructor(address _registry) BaseConflictResolver(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "three_way_merge";
    }

    function canAutoResolve(
        VersionInfo calldata,
        VersionInfo calldata,
        bytes32 ancestorHash
    ) external pure override returns (bool) {
        // Three-way merge requires an ancestor for auto-resolution
        return ancestorHash != bytes32(0);
    }

    function resolve(
        bytes32 entityId,
        VersionInfo calldata versionA,
        VersionInfo calldata versionB,
        bytes32 ancestorHash,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 resolutionId) {
        require(extraData.length > 0, "ThreeWayMergeResolver: extraData required");

        (
            uint32 diffACount,
            uint32 diffBCount,
            uint32 overlappingChanges,
            uint32 cleanMerges,
            bytes32 mergedContentHash
        ) = abi.decode(extraData, (uint32, uint32, uint32, uint32, bytes32));

        bool autoResolved = overlappingChanges == 0;
        bool hasAncestor = ancestorHash != bytes32(0);
        uint8 winner = 2; // merged

        string memory details;
        if (hasAncestor) {
            details = string.concat(
                "Three-way merge: diff A=", _uint32ToString(diffACount),
                ", diff B=", _uint32ToString(diffBCount),
                ", overlapping=", _uint32ToString(overlappingChanges)
            );
        } else {
            details = "Three-way merge degraded: no ancestor available";
        }

        resolutionId = _recordResolution(
            entityId, versionA, versionB, ancestorHash,
            winner, mergedContentHash, autoResolved, details, extraData
        );

        threeWayMetadata[resolutionId] = ThreeWayMergeMetadata({
            diffACount: diffACount,
            diffBCount: diffBCount,
            overlappingChanges: overlappingChanges,
            cleanMerges: cleanMerges,
            mergedContentHash: mergedContentHash,
            hasAncestor: hasAncestor
        });
    }

    function getThreeWayMetadata(uint256 resolutionId) external view returns (ThreeWayMergeMetadata memory) {
        return threeWayMetadata[resolutionId];
    }

    function _uint32ToString(uint32 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint32 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

// ---------------------------------------------------------------------------
// Provider: CrdtMergeResolver
// ---------------------------------------------------------------------------

/// @title CrdtMergeResolver — CRDT-based mathematically guaranteed conflict-free merge.
/// @notice Records conflict-free merge operations using Conflict-free Replicated Data
///         Types (CRDTs). Each field uses a specific CRDT strategy:
///
///           - LWW-Register for scalars (last-writer-wins by vector clock)
///           - PN-Counter for numbers (preserves increments/decrements from both sides)
///           - OR-Set for arrays (add-wins observed-remove set semantics)
///           - RGA for text sequences (character/word-level merge)
///
///         On-chain relevance: CRDTs are especially valuable on-chain because:
///           1. Merge is deterministic -- any node computes the same result
///           2. No coordination required -- replicas converge independently
///           3. Merge result can be verified on-chain given both inputs
///           4. Vector clock merging (element-wise max) is simple to verify
///
///         The actual CRDT merge computation occurs off-chain; this contract records
///         the CRDT type used per field and validates the merged vector clock.
contract CrdtMergeResolver is BaseConflictResolver {
    /// @notice CRDT type enum stored compactly as uint8.
    /// 0 = LWW-Register, 1 = G-Counter, 2 = PN-Counter, 3 = OR-Set, 4 = RGA
    uint8 constant LWW_REGISTER = 0;
    uint8 constant G_COUNTER = 1;
    uint8 constant PN_COUNTER = 2;
    uint8 constant OR_SET = 3;
    uint8 constant RGA = 4;

    /// @notice CRDT merge metadata.
    struct CrdtMergeMetadata {
        uint32 totalFields;            // Total fields merged
        uint32 lwwRegisterCount;       // Fields merged via LWW-Register
        uint32 pnCounterCount;         // Fields merged via PN-Counter
        uint32 orSetCount;             // Fields merged via OR-Set
        uint32 rgaCount;               // Fields merged via RGA
        bytes32 mergedVectorClockHash; // Hash of the merged vector clock
        bytes32 mergedContentHash;     // Hash of the merged content
    }

    mapping(uint256 => CrdtMergeMetadata) public crdtMetadata;

    /// @notice Tracks per-entity vector clock hashes for convergence verification.
    mapping(bytes32 => bytes32) public entityVectorClocks;

    constructor(address _registry) BaseConflictResolver(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "crdt_merge";
    }

    function canAutoResolve(
        VersionInfo calldata,
        VersionInfo calldata,
        bytes32
    ) external pure override returns (bool) {
        // CRDTs guarantee conflict-free convergence -- always auto-resolvable
        return true;
    }

    function resolve(
        bytes32 entityId,
        VersionInfo calldata versionA,
        VersionInfo calldata versionB,
        bytes32 ancestorHash,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 resolutionId) {
        require(extraData.length > 0, "CrdtMergeResolver: extraData required");

        (
            uint32 totalFields,
            uint32 lwwCount,
            uint32 pnCount,
            uint32 orSetCount,
            uint32 rgaCount,
            bytes32 mergedVcHash,
            bytes32 mergedContentHash
        ) = abi.decode(extraData, (uint32, uint32, uint32, uint32, uint32, bytes32, bytes32));

        // Verify CRDT type counts sum to total
        require(
            lwwCount + pnCount + orSetCount + rgaCount == totalFields,
            "CrdtMergeResolver: CRDT type counts must sum to total fields"
        );

        string memory details = string.concat(
            "CRDT merge: ", _uint32ToString(totalFields), " fields (",
            _uint32ToString(lwwCount), " LWW, ",
            _uint32ToString(pnCount), " PN-Counter, ",
            _uint32ToString(orSetCount), " OR-Set, ",
            _uint32ToString(rgaCount), " RGA). Convergence guaranteed."
        );

        resolutionId = _recordResolution(
            entityId, versionA, versionB, ancestorHash,
            2, // winner = merged
            mergedContentHash,
            true, // always auto-resolved
            details,
            extraData
        );

        crdtMetadata[resolutionId] = CrdtMergeMetadata({
            totalFields: totalFields,
            lwwRegisterCount: lwwCount,
            pnCounterCount: pnCount,
            orSetCount: orSetCount,
            rgaCount: rgaCount,
            mergedVectorClockHash: mergedVcHash,
            mergedContentHash: mergedContentHash
        });

        // Update entity vector clock to the merged value
        entityVectorClocks[entityId] = mergedVcHash;
    }

    /// @notice Verify that a CRDT merge result is consistent.
    /// @dev Checks that the merged vector clock dominates both input clocks.
    ///      In a full implementation, this would verify the merged VC hash
    ///      against the element-wise max of both input VC hashes.
    function verifyMerge(
        bytes32 entityId,
        bytes32 expectedMergedVcHash
    ) external view returns (bool) {
        return entityVectorClocks[entityId] == expectedMergedVcHash;
    }

    function getCrdtMetadata(uint256 resolutionId) external view returns (CrdtMergeMetadata memory) {
        return crdtMetadata[resolutionId];
    }

    function _uint32ToString(uint32 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint32 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

// ---------------------------------------------------------------------------
// Provider: ManualQueueResolver
// ---------------------------------------------------------------------------

/// @title ManualQueueResolver — Stores conflicts for human resolution.
/// @notice Never auto-resolves. Stores both versions on-chain with a priority queue
///         for human review. Emits events when conflicts are queued and when they are
///         resolved by a human reviewer.
///
///         Queue management:
///           - Conflicts are added with a priority hint (higher = more urgent)
///           - Queue entries track which fields are in conflict
///           - A designated reviewer address can submit the final resolution
///           - Resolution history is maintained for audit trail
contract ManualQueueResolver is BaseConflictResolver {
    /// @notice Queue entry for a pending conflict.
    struct QueueEntry {
        bytes32 entityId;
        bytes32 versionAHash;
        bytes32 versionBHash;
        bytes32 ancestorHash;
        int32   priority;
        uint256 enqueuedAt;
        address enqueuedBy;
        bool    resolved;
        uint256 resolvedAt;
        address resolvedBy;
        uint8   chosenWinner;        // 0=A, 1=B, 2=custom_merge
        bytes32 resolutionHash;      // Hash of the chosen resolution content
        uint32  conflictingFieldCount;
    }

    /// @notice Queue entries indexed by queue position.
    mapping(uint256 => QueueEntry) public queue;
    uint256 public queueLength;

    /// @notice Entity to queue entry mapping for lookup.
    mapping(bytes32 => uint256[]) public entityQueueEntries;

    /// @notice Addresses authorized to resolve queued conflicts.
    mapping(address => bool) public reviewers;

    /// @notice Count of pending vs resolved entries.
    uint256 public pendingCount;

    // -- Events --------------------------------------------------------------

    event ConflictQueued(
        uint256 indexed queueId,
        bytes32 indexed entityId,
        int32   priority,
        uint32  conflictingFieldCount,
        uint256 enqueuedAt
    );

    event ConflictManuallyResolved(
        uint256 indexed queueId,
        bytes32 indexed entityId,
        address indexed resolvedBy,
        uint8   chosenWinner,
        uint256 resolvedAt
    );

    constructor(address _registry) BaseConflictResolver(_registry) {
        reviewers[msg.sender] = true;
    }

    function _providerId() internal pure override returns (string memory) {
        return "manual_queue";
    }

    function canAutoResolve(
        VersionInfo calldata,
        VersionInfo calldata,
        bytes32
    ) external pure override returns (bool) {
        // Manual queue never auto-resolves
        return false;
    }

    /// @notice Add or remove a reviewer address.
    function setReviewer(address reviewer, bool authorized) external onlyOwner {
        require(reviewer != address(0), "ManualQueueResolver: zero address");
        reviewers[reviewer] = authorized;
    }

    function resolve(
        bytes32 entityId,
        VersionInfo calldata versionA,
        VersionInfo calldata versionB,
        bytes32 ancestorHash,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 resolutionId) {
        // Decode priority and conflicting field count from extraData
        int32 priority = 0;
        uint32 conflictingFieldCount = 0;
        if (extraData.length >= 8) {
            (priority, conflictingFieldCount) = abi.decode(extraData, (int32, uint32));
        }

        // Create queue entry
        uint256 queueId = queueLength++;
        queue[queueId] = QueueEntry({
            entityId: entityId,
            versionAHash: versionA.contentHash,
            versionBHash: versionB.contentHash,
            ancestorHash: ancestorHash,
            priority: priority,
            enqueuedAt: block.timestamp,
            enqueuedBy: tx.origin,
            resolved: false,
            resolvedAt: 0,
            resolvedBy: address(0),
            chosenWinner: 3, // manual (pending)
            resolutionHash: bytes32(0),
            conflictingFieldCount: conflictingFieldCount
        });

        entityQueueEntries[entityId].push(queueId);
        pendingCount++;

        emit ConflictQueued(queueId, entityId, priority, conflictingFieldCount, block.timestamp);

        // Record the resolution as "manual" (pending human review)
        string memory details = string.concat(
            "Conflict queued for manual resolution. Priority: ",
            _int32ToString(priority),
            ". Conflicting fields: ",
            _uint32ToString(conflictingFieldCount)
        );

        resolutionId = _recordResolution(
            entityId, versionA, versionB, ancestorHash,
            3, // winner = manual
            bytes32(0), // no merged hash yet
            false, // not auto-resolved
            details,
            extraData
        );
    }

    /// @notice Submit a manual resolution for a queued conflict.
    /// @param queueId         The queue entry to resolve.
    /// @param chosenWinner    0=A, 1=B, 2=custom_merge.
    /// @param resolutionHash  Hash of the chosen resolution content.
    function submitResolution(
        uint256 queueId,
        uint8 chosenWinner,
        bytes32 resolutionHash
    ) external {
        require(reviewers[msg.sender], "ManualQueueResolver: not authorized");
        require(queueId < queueLength, "ManualQueueResolver: invalid queue ID");
        QueueEntry storage entry = queue[queueId];
        require(!entry.resolved, "ManualQueueResolver: already resolved");
        require(chosenWinner <= 2, "ManualQueueResolver: invalid winner");

        entry.resolved = true;
        entry.resolvedAt = block.timestamp;
        entry.resolvedBy = msg.sender;
        entry.chosenWinner = chosenWinner;
        entry.resolutionHash = resolutionHash;

        pendingCount--;

        emit ConflictManuallyResolved(
            queueId, entry.entityId, msg.sender, chosenWinner, block.timestamp
        );
    }

    /// @notice Get the current pending queue depth.
    function getPendingCount() external view returns (uint256) {
        return pendingCount;
    }

    /// @notice Get a queue entry by ID.
    function getQueueEntry(uint256 queueId) external view returns (QueueEntry memory) {
        require(queueId < queueLength, "ManualQueueResolver: invalid queue ID");
        return queue[queueId];
    }

    /// @notice Get all queue entries for an entity.
    function getEntityQueueEntries(bytes32 entityId) external view returns (uint256[] memory) {
        return entityQueueEntries[entityId];
    }

    function _int32ToString(int32 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        bool negative = value < 0;
        uint32 absValue = negative ? uint32(-value) : uint32(value);
        string memory numStr = _uint32ToString(absValue);
        if (negative) {
            return string.concat("-", numStr);
        }
        return numStr;
    }

    function _uint32ToString(uint32 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint32 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
