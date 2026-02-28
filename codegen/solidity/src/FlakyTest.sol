// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FlakyTest
/// @notice Flaky test detection with result recording, quarantine management, and policy configuration.
/// @dev Tracks test result history to detect flakiness patterns and manage quarantined tests.

contract FlakyTest {

    // --- Storage ---

    struct TestEntry {
        string testId;
        string language;
        string builder;
        string testType;
        bool[] recentResults;
        int256[] durations;
        int256 flipCount;
        uint256 lastRunAt;
        bool quarantined;
        string quarantineReason;
        string quarantineOwner;
        uint256 quarantinedAt;
        bool exists;
    }

    mapping(bytes32 => TestEntry) private _tests;
    bytes32[] private _testIds;
    mapping(bytes32 => bool) private _testExists;

    // Policy configuration
    int256 private _flipThreshold = 3;
    uint256 private _flipWindow = 10;
    bool private _autoQuarantine = false;
    int256 private _retryCount = 1;

    // --- Types ---

    struct RecordInput {
        string testId;
        string language;
        string builder;
        string testType;
        bool passed;
        int256 duration;
    }

    struct RecordOkResult {
        bool success;
        bytes32 test;
    }

    struct RecordFlakyDetectedResult {
        bool success;
        bytes32 test;
        int256 flipCount;
        bool[] recentResults;
    }

    struct QuarantineInput {
        string testId;
        string reason;
        string owner;
    }

    struct QuarantineOkResult {
        bool success;
        bytes32 test;
    }

    struct QuarantineAlreadyQuarantinedResult {
        bool success;
        bytes32 test;
    }

    struct QuarantineNotFoundResult {
        bool success;
        string testId;
    }

    struct ReleaseOkResult {
        bool success;
        bytes32 test;
    }

    struct ReleaseNotQuarantinedResult {
        bool success;
        bytes32 test;
    }

    struct IsQuarantinedYesResult {
        bool success;
        bytes32 test;
        string reason;
        string owner;
        uint256 quarantinedAt;
    }

    struct IsQuarantinedNoResult {
        bool success;
        bytes32 test;
    }

    struct IsQuarantinedUnknownResult {
        bool success;
        string testId;
    }

    struct ReportOkResult {
        bool success;
        bytes summary;
    }

    struct SetPolicyInput {
        int256 flipThreshold;
        string flipWindow;
        bool autoQuarantine;
        int256 retryCount;
    }

    // --- Events ---

    event RecordCompleted(string variant, bytes32 test, int256 flipCount, bool[] recentResults);
    event QuarantineCompleted(string variant, bytes32 test);
    event ReleaseCompleted(string variant, bytes32 test);
    event IsQuarantinedCompleted(string variant, bytes32 test, string owner, uint256 quarantinedAt);
    event ReportCompleted(string variant, bytes summary);
    event SetPolicyCompleted(string variant);

    // --- Actions ---

    /// @notice record - Records a test result and detects flakiness based on result history.
    function record(string memory testId, string memory language, string memory builder, string memory testType, bool passed, int256 duration) external returns (RecordOkResult memory) {
        require(bytes(testId).length > 0, "Test ID must not be empty");

        bytes32 testHash = keccak256(abi.encodePacked("test:", testId));

        if (!_testExists[testHash]) {
            TestEntry storage newTest = _tests[testHash];
            newTest.testId = testId;
            newTest.language = language;
            newTest.builder = builder;
            newTest.testType = testType;
            newTest.flipCount = 0;
            newTest.lastRunAt = block.timestamp;
            newTest.quarantined = false;
            newTest.exists = true;
            newTest.recentResults.push(passed);
            newTest.durations.push(duration);

            _testExists[testHash] = true;
            _testIds.push(testHash);

            emit RecordCompleted("ok", testHash, 0, newTest.recentResults);

            return RecordOkResult({
                success: true,
                test: testHash
            });
        }

        TestEntry storage t = _tests[testHash];

        // Detect flip (result changed from previous)
        if (t.recentResults.length > 0) {
            bool lastResult = t.recentResults[t.recentResults.length - 1];
            if (lastResult != passed) {
                t.flipCount++;
            }
        }

        t.recentResults.push(passed);
        t.durations.push(duration);
        t.lastRunAt = block.timestamp;

        // Check if flaky threshold exceeded
        if (t.flipCount >= _flipThreshold) {
            if (_autoQuarantine && !t.quarantined) {
                t.quarantined = true;
                t.quarantineReason = "Auto-quarantined: flip threshold exceeded";
                t.quarantineOwner = "system";
                t.quarantinedAt = block.timestamp;
            }
            emit RecordCompleted("flakyDetected", testHash, t.flipCount, t.recentResults);
        } else {
            emit RecordCompleted("ok", testHash, t.flipCount, t.recentResults);
        }

        return RecordOkResult({
            success: true,
            test: testHash
        });
    }

    /// @notice quarantine - Quarantines a flaky test with a reason and owner.
    function quarantine(string memory testId, string memory reason, string memory owner) external returns (QuarantineOkResult memory) {
        bytes32 testHash = keccak256(abi.encodePacked("test:", testId));
        require(_testExists[testHash], "Test not found");

        TestEntry storage t = _tests[testHash];

        if (t.quarantined) {
            emit QuarantineCompleted("alreadyQuarantined", testHash);
            return QuarantineOkResult({
                success: true,
                test: testHash
            });
        }

        t.quarantined = true;
        t.quarantineReason = reason;
        t.quarantineOwner = owner;
        t.quarantinedAt = block.timestamp;

        emit QuarantineCompleted("ok", testHash);

        return QuarantineOkResult({
            success: true,
            test: testHash
        });
    }

    /// @notice release - Releases a test from quarantine.
    function release(string memory testId) external returns (ReleaseOkResult memory) {
        bytes32 testHash = keccak256(abi.encodePacked("test:", testId));
        require(_testExists[testHash], "Test not found");

        TestEntry storage t = _tests[testHash];
        require(t.quarantined, "Test is not quarantined");

        t.quarantined = false;
        t.quarantineReason = "";
        t.quarantineOwner = "";
        t.quarantinedAt = 0;
        t.flipCount = 0;

        emit ReleaseCompleted("ok", testHash);

        return ReleaseOkResult({
            success: true,
            test: testHash
        });
    }

    /// @notice isQuarantined - Checks if a test is currently quarantined.
    function isQuarantined(string memory testId) external returns (bool) {
        bytes32 testHash = keccak256(abi.encodePacked("test:", testId));

        if (!_testExists[testHash]) {
            emit IsQuarantinedCompleted("unknown", testHash, "", 0);
            return false;
        }

        TestEntry storage t = _tests[testHash];

        if (t.quarantined) {
            emit IsQuarantinedCompleted("yes", testHash, t.quarantineOwner, t.quarantinedAt);
            return true;
        } else {
            emit IsQuarantinedCompleted("no", testHash, "", 0);
            return false;
        }
    }

    /// @notice report - Returns a summary report of flaky test status.
    function report(string memory testType) external returns (ReportOkResult memory) {
        uint256 totalTests = 0;
        uint256 flakyTests = 0;
        uint256 quarantinedTests = 0;
        bool filterByType = bytes(testType).length > 0;

        for (uint256 i = 0; i < _testIds.length; i++) {
            bytes32 id = _testIds[i];
            if (!_testExists[id]) continue;
            TestEntry storage t = _tests[id];
            if (filterByType && keccak256(bytes(t.testType)) != keccak256(bytes(testType))) continue;
            totalTests++;
            if (t.flipCount >= _flipThreshold) flakyTests++;
            if (t.quarantined) quarantinedTests++;
        }

        bytes memory summary = abi.encode(totalTests, flakyTests, quarantinedTests, _flipThreshold, _autoQuarantine);

        emit ReportCompleted("ok", summary);

        return ReportOkResult({
            success: true,
            summary: summary
        });
    }

    /// @notice setPolicy - Configures the flaky test detection policy.
    function setPolicy(int256 flipThreshold, string memory flipWindow, bool autoQuarantine, int256 retryCount) external returns (bool) {
        require(flipThreshold > 0, "Flip threshold must be positive");
        require(retryCount >= 0, "Retry count must be non-negative");

        _flipThreshold = flipThreshold;
        _autoQuarantine = autoQuarantine;
        _retryCount = retryCount;

        if (bytes(flipWindow).length > 0) {
            _flipWindow = bytes(flipWindow).length * 5;
        }

        emit SetPolicyCompleted("ok");
        return true;
    }
}
