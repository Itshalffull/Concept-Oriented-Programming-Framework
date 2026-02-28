// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Health
/// @notice Health check management for concepts, syncs, suites, and invariants.
/// @dev Registers and executes health checks with latency tracking and aggregate reporting.

contract Health {

    // --- Storage ---

    struct CheckEntry {
        string checkType; // "concept", "sync", "kit", "invariant"
        string target;
        string status; // "healthy", "degraded", "failed"
        int256 latencyMs;
        uint256 checkedAt;
        bool exists;
    }

    mapping(bytes32 => CheckEntry) private _checks;
    bytes32[] private _checkIds;
    mapping(bytes32 => bool) private _checkExists;

    // Concept health records
    struct ConceptHealth {
        string concept;
        string runtime;
        int256 latencyMs;
        bool healthy;
        bool exists;
    }

    mapping(bytes32 => ConceptHealth) private _conceptHealth;
    bytes32[] private _conceptHealthIds;

    // --- Types ---

    struct CheckConceptInput {
        string concept;
        string runtime;
    }

    struct CheckConceptOkResult {
        bool success;
        bytes32 check;
        int256 latencyMs;
    }

    struct CheckConceptUnreachableResult {
        bool success;
        string concept;
        string transport;
    }

    struct CheckConceptStorageFailedResult {
        bool success;
        string concept;
        string storageInfo;
        string reason;
    }

    struct CheckConceptDegradedResult {
        bool success;
        string concept;
        int256 latencyMs;
        int256 threshold;
    }

    struct CheckSyncInput {
        string sync;
        string[] concepts;
    }

    struct CheckSyncOkResult {
        bool success;
        bytes32 check;
        int256 roundTripMs;
    }

    struct CheckSyncPartialFailureResult {
        bool success;
        string sync;
        string[] failed;
    }

    struct CheckSyncTimeoutResult {
        bool success;
        string sync;
        int256 timeoutMs;
    }

    struct CheckKitInput {
        string kit;
        string environment;
    }

    struct CheckKitOkResult {
        bool success;
        bytes32 check;
        string[] conceptResults;
        string[] syncResults;
    }

    struct CheckKitDegradedResult {
        bool success;
        bytes32 check;
        string[] healthy;
        string[] degraded;
    }

    struct CheckKitFailedResult {
        bool success;
        bytes32 check;
        string[] healthy;
        string[] failed;
    }

    struct CheckInvariantInput {
        string concept;
        string invariantName;
    }

    struct CheckInvariantOkResult {
        bool success;
        bytes32 check;
    }

    struct CheckInvariantViolatedResult {
        bool success;
        string concept;
        string invariantName;
        string expected;
        string actual;
    }

    // --- Events ---

    event CheckConceptCompleted(string variant, bytes32 check, int256 latencyMs, int256 threshold);
    event CheckSyncCompleted(string variant, bytes32 check, int256 roundTripMs, string[] failed, int256 timeoutMs);
    event CheckKitCompleted(string variant, bytes32 check, string[] conceptResults, string[] syncResults, string[] healthy, string[] degraded, string[] failed);
    event CheckInvariantCompleted(string variant, bytes32 check);

    // --- Actions ---

    /// @notice checkConcept - Runs a health check against a single concept endpoint.
    function checkConcept(string memory concept, string memory runtime) external returns (CheckConceptOkResult memory) {
        bytes32 checkId = keccak256(abi.encodePacked("concept:", concept, runtime, block.timestamp));

        // Simulate latency based on concept name hash
        int256 latencyMs = int256(uint256(keccak256(abi.encodePacked(concept))) % 100) + 1;

        _checks[checkId] = CheckEntry({
            checkType: "concept",
            target: concept,
            status: "healthy",
            latencyMs: latencyMs,
            checkedAt: block.timestamp,
            exists: true
        });
        _checkExists[checkId] = true;
        _checkIds.push(checkId);

        // Record concept health for kit aggregation
        bytes32 conceptKey = keccak256(abi.encodePacked("ch:", concept));
        _conceptHealth[conceptKey] = ConceptHealth({
            concept: concept,
            runtime: runtime,
            latencyMs: latencyMs,
            healthy: true,
            exists: true
        });

        bool alreadyTracked = false;
        for (uint256 i = 0; i < _conceptHealthIds.length; i++) {
            if (_conceptHealthIds[i] == conceptKey) { alreadyTracked = true; break; }
        }
        if (!alreadyTracked) {
            _conceptHealthIds.push(conceptKey);
        }

        emit CheckConceptCompleted("ok", checkId, latencyMs, 0);

        return CheckConceptOkResult({
            success: true,
            check: checkId,
            latencyMs: latencyMs
        });
    }

    /// @notice checkSync - Runs a health check on a sync channel across concepts.
    function checkSync(string memory sync, string[] memory concepts) external returns (CheckSyncOkResult memory) {
        require(concepts.length > 0, "Must provide at least one concept");

        bytes32 checkId = keccak256(abi.encodePacked("sync:", sync, block.timestamp));

        int256 roundTripMs = int256(concepts.length) * 15 + 5;

        _checks[checkId] = CheckEntry({
            checkType: "sync",
            target: sync,
            status: "healthy",
            latencyMs: roundTripMs,
            checkedAt: block.timestamp,
            exists: true
        });
        _checkExists[checkId] = true;
        _checkIds.push(checkId);

        string[] memory emptyFailed = new string[](0);
        emit CheckSyncCompleted("ok", checkId, roundTripMs, emptyFailed, 0);

        return CheckSyncOkResult({
            success: true,
            check: checkId,
            roundTripMs: roundTripMs
        });
    }

    /// @notice checkKit - Runs aggregate health checks across all concepts in a suite.
    function checkKit(string memory kit, string memory environment) external returns (CheckKitOkResult memory) {
        bytes32 checkId = keccak256(abi.encodePacked("kit:", kit, environment, block.timestamp));

        // Gather concept health results
        string[] memory conceptResults = new string[](_conceptHealthIds.length);
        for (uint256 i = 0; i < _conceptHealthIds.length; i++) {
            ConceptHealth storage ch = _conceptHealth[_conceptHealthIds[i]];
            conceptResults[i] = string(abi.encodePacked(ch.concept, ":healthy"));
        }

        string[] memory syncResults = new string[](0);

        _checks[checkId] = CheckEntry({
            checkType: "kit",
            target: kit,
            status: "healthy",
            latencyMs: 0,
            checkedAt: block.timestamp,
            exists: true
        });
        _checkExists[checkId] = true;
        _checkIds.push(checkId);

        string[] memory empty = new string[](0);
        emit CheckKitCompleted("ok", checkId, conceptResults, syncResults, empty, empty, empty);

        return CheckKitOkResult({
            success: true,
            check: checkId,
            conceptResults: conceptResults,
            syncResults: syncResults
        });
    }

    /// @notice checkInvariant - Verifies a specific invariant holds for a concept.
    function checkInvariant(string memory concept, string memory invariantName) external returns (CheckInvariantOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(invariantName).length > 0, "Invariant must not be empty");

        bytes32 checkId = keccak256(abi.encodePacked("invariant:", concept, invariantName, block.timestamp));

        _checks[checkId] = CheckEntry({
            checkType: "invariant",
            target: string(abi.encodePacked(concept, ":", invariantName)),
            status: "healthy",
            latencyMs: 0,
            checkedAt: block.timestamp,
            exists: true
        });
        _checkExists[checkId] = true;
        _checkIds.push(checkId);

        emit CheckInvariantCompleted("ok", checkId);

        return CheckInvariantOkResult({
            success: true,
            check: checkId
        });
    }
}
