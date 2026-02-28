// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Builder
/// @notice Base builder concept for compiling, testing, and packaging source code.
contract Builder {

    // --- Storage ---

    /// @dev Build record keyed by build ID
    struct BuildRecord {
        string concept;
        string source;
        string language;
        string platform;
        string artifactHash;
        string artifactLocation;
        string status;
        int256 duration;
        uint256 timestamp;
        bool exists;
    }

    mapping(bytes32 => BuildRecord) private _builds;

    /// @dev History: concept+language hash -> array of build IDs
    mapping(bytes32 => bytes32[]) private _history;

    /// @dev Test record keyed by build ID + testType
    struct TestRecord {
        int256 passed;
        int256 failed;
        int256 skipped;
        int256 duration;
        string testType;
        bool exists;
    }

    mapping(bytes32 => TestRecord) private _tests;

    // --- Types ---

    struct BuildInput {
        string concept;
        string source;
        string language;
        string platform;
        bytes config;
    }

    struct BuildOkResult {
        bool success;
        bytes32 build;
        string artifactHash;
        string artifactLocation;
        int256 duration;
    }

    struct BuildCompilationErrorResult {
        bool success;
        string concept;
        string language;
        bytes[] errors;
    }

    struct BuildTestFailureResult {
        bool success;
        string concept;
        string language;
        int256 passed;
        int256 failed;
        bytes[] failures;
    }

    struct BuildToolchainErrorResult {
        bool success;
        string concept;
        string language;
        string reason;
    }

    struct BuildAllInput {
        string[] concepts;
        string source;
        bytes[] targets;
        bytes config;
    }

    struct BuildAllOkResult {
        bool success;
        bytes[] results;
    }

    struct BuildAllPartialResult {
        bool success;
        bytes[] completed;
        bytes[] failed;
    }

    struct TestInput {
        string concept;
        string language;
        string platform;
        string[] testFilter;
        string testType;
        string toolName;
    }

    struct TestOkResult {
        bool success;
        int256 passed;
        int256 failed;
        int256 skipped;
        int256 duration;
        string testType;
    }

    struct TestTestFailureResult {
        bool success;
        int256 passed;
        int256 failed;
        bytes[] failures;
        string testType;
    }

    struct TestNotBuiltResult {
        bool success;
        string concept;
        string language;
    }

    struct TestRunnerNotFoundResult {
        bool success;
        string language;
        string testType;
        string installHint;
    }

    struct StatusOkResult {
        bool success;
        bytes32 build;
        string status;
        int256 duration;
    }

    struct HistoryInput {
        string concept;
        string language;
    }

    struct HistoryOkResult {
        bool success;
        bytes[] builds;
    }

    // --- Events ---

    event BuildCompleted(string variant, bytes32 build, int256 duration, bytes[] errors, int256 passed, int256 failed, bytes[] failures);
    event BuildAllCompleted(string variant, bytes[] results, bytes[] completed, bytes[] failed);
    event TestCompleted(string variant, int256 passed, int256 failed, int256 skipped, int256 duration, bytes[] failures);
    event StatusCompleted(string variant, bytes32 build, int256 duration);
    event HistoryCompleted(string variant, bytes[] builds);

    // --- Actions ---

    /// @notice build - Compiles source into an artifact, stores the build record.
    function build(string memory concept, string memory source, string memory language, string memory platform, bytes memory config) external returns (BuildOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(source).length > 0, "Source must not be empty");
        require(bytes(language).length > 0, "Language must not be empty");

        bytes32 buildId = keccak256(abi.encodePacked(concept, source, language, platform, block.timestamp, block.number));

        string memory artifactHash = string(abi.encodePacked(buildId));
        string memory artifactLocation = string(abi.encodePacked(source, "/out/", concept));
        int256 duration = int256(block.timestamp % 1000);

        _builds[buildId] = BuildRecord({
            concept: concept,
            source: source,
            language: language,
            platform: platform,
            artifactHash: artifactHash,
            artifactLocation: artifactLocation,
            status: "completed",
            duration: duration,
            timestamp: block.timestamp,
            exists: true
        });

        bytes32 historyKey = keccak256(abi.encodePacked(concept, language));
        _history[historyKey].push(buildId);

        bytes[] memory emptyErrors;
        bytes[] memory emptyFailures;
        emit BuildCompleted("ok", buildId, duration, emptyErrors, int256(0), int256(0), emptyFailures);

        return BuildOkResult({
            success: true,
            build: buildId,
            artifactHash: artifactHash,
            artifactLocation: artifactLocation,
            duration: duration
        });
    }

    /// @notice buildAll - Builds multiple concepts, collecting results.
    function buildAll(string[] memory concepts, string memory source, bytes[] memory targets, bytes memory config) external returns (BuildAllOkResult memory) {
        require(concepts.length > 0, "Concepts must not be empty");

        bytes[] memory results = new bytes[](concepts.length);

        for (uint256 i = 0; i < concepts.length; i++) {
            bytes32 buildId = keccak256(abi.encodePacked(concepts[i], source, block.timestamp, block.number, i));
            int256 duration = int256(block.timestamp % 1000);

            _builds[buildId] = BuildRecord({
                concept: concepts[i],
                source: source,
                language: "",
                platform: "",
                artifactHash: "",
                artifactLocation: string(abi.encodePacked(source, "/out/", concepts[i])),
                status: "completed",
                duration: duration,
                timestamp: block.timestamp,
                exists: true
            });

            results[i] = abi.encode(buildId, true);
        }

        bytes[] memory emptyCompleted;
        bytes[] memory emptyFailed;
        emit BuildAllCompleted("ok", results, emptyCompleted, emptyFailed);

        return BuildAllOkResult({
            success: true,
            results: results
        });
    }

    /// @notice runTests - Runs tests for a previously built concept.
    function runTests(string memory concept, string memory language, string memory platform, string[] memory testFilter, string memory testType, string memory toolName) external returns (TestOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(language).length > 0, "Language must not be empty");

        bytes32 testKey = keccak256(abi.encodePacked(concept, language, testType));
        int256 passed = int256(1);
        int256 failed = int256(0);
        int256 skipped = int256(0);
        int256 duration = int256(block.timestamp % 500);

        _tests[testKey] = TestRecord({
            passed: passed,
            failed: failed,
            skipped: skipped,
            duration: duration,
            testType: testType,
            exists: true
        });

        bytes[] memory emptyFailures;
        emit TestCompleted("ok", passed, failed, skipped, duration, emptyFailures);

        return TestOkResult({
            success: true,
            passed: passed,
            failed: failed,
            skipped: skipped,
            duration: duration,
            testType: testType
        });
    }

    /// @notice status - Returns the status of a build by its ID.
    function status(bytes32 buildId) external returns (StatusOkResult memory) {
        require(_builds[buildId].exists, "Build not found");

        BuildRecord storage rec = _builds[buildId];

        emit StatusCompleted("ok", buildId, rec.duration);

        return StatusOkResult({
            success: true,
            build: buildId,
            status: rec.status,
            duration: rec.duration
        });
    }

    /// @notice history - Returns the build history for a concept+language pair.
    function history(string memory concept, string memory language) external returns (HistoryOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");

        bytes32 historyKey = keccak256(abi.encodePacked(concept, language));
        bytes32[] storage buildIds = _history[historyKey];

        bytes[] memory builds = new bytes[](buildIds.length);
        for (uint256 i = 0; i < buildIds.length; i++) {
            BuildRecord storage rec = _builds[buildIds[i]];
            builds[i] = abi.encode(buildIds[i], rec.status, rec.duration, rec.timestamp);
        }

        emit HistoryCompleted("ok", builds);

        return HistoryOkResult({
            success: true,
            builds: builds
        });
    }

}
