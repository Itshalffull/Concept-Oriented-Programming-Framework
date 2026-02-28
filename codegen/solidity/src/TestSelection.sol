// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TestSelection
/// @notice Test selection and filtering with source-to-test mapping, prioritization, and statistics.
/// @dev Manages test-to-source coverage mappings for intelligent test selection based on changes.

contract TestSelection {

    // --- Storage ---

    struct MappingEntry {
        string testId;
        string language;
        string testType;
        string[] coveredSources;
        int256 duration;
        bool passed;
        uint256 recordedAt;
        bool exists;
    }

    mapping(bytes32 => MappingEntry) private _mappings;
    bytes32[] private _mappingIds;
    mapping(bytes32 => bool) private _mappingExists;

    // Reverse index: source -> test mapping IDs
    mapping(bytes32 => bytes32[]) private _sourceToTests;

    // Statistics
    uint256 private _totalRecords;
    uint256 private _totalPassed;
    int256 private _totalDuration;

    // --- Types ---

    struct AnalyzeInput {
        string[] changedSources;
        string testType;
    }

    struct AnalyzeOkResult {
        bool success;
        bytes[] affectedTests;
    }

    struct AnalyzeNoMappingsResult {
        bool success;
        string message;
    }

    struct SelectInput {
        bytes[] affectedTests;
        bytes budget;
    }

    struct SelectOkResult {
        bool success;
        bytes[] selected;
        int256 estimatedDuration;
        uint256 confidence;
    }

    struct SelectBudgetInsufficientResult {
        bool success;
        bytes[] selected;
        int256 missedTests;
        uint256 confidence;
    }

    struct RecordInput {
        string testId;
        string language;
        string testType;
        string[] coveredSources;
        int256 duration;
        bool passed;
    }

    struct RecordOkResult {
        bool success;
        bytes32 mappingIdId;
    }

    struct StatisticsOkResult {
        bool success;
        bytes stats;
    }

    // --- Events ---

    event AnalyzeCompleted(string variant, bytes[] affectedTests);
    event SelectCompleted(string variant, bytes[] selected, int256 estimatedDuration, uint256 confidence, int256 missedTests);
    event RecordCompleted(string variant, bytes32 mappingId);
    event StatisticsCompleted(string variant, bytes stats);

    // --- Actions ---

    /// @notice analyze - Analyzes which tests are affected by changed source files.
    function analyze(string[] memory changedSources, string memory testType) external returns (AnalyzeOkResult memory) {
        require(changedSources.length > 0, "Must provide at least one changed source");

        if (_mappingIds.length == 0) {
            bytes[] memory emptyTests = new bytes[](0);
            emit AnalyzeCompleted("noMappings", emptyTests);
            return AnalyzeOkResult({
                success: true,
                affectedTests: emptyTests
            });
        }

        bool filterByType = bytes(testType).length > 0;
        uint256 maxTests = _mappingIds.length;
        bytes32[] memory affectedIds = new bytes32[](maxTests);
        uint256 affectedCount = 0;

        for (uint256 i = 0; i < changedSources.length; i++) {
            bytes32 sourceKey = keccak256(abi.encodePacked("source:", changedSources[i]));
            bytes32[] storage testIds = _sourceToTests[sourceKey];

            for (uint256 j = 0; j < testIds.length; j++) {
                bytes32 testId = testIds[j];
                if (!_mappingExists[testId]) continue;

                if (filterByType) {
                    MappingEntry storage m = _mappings[testId];
                    if (keccak256(bytes(m.testType)) != keccak256(bytes(testType))) continue;
                }

                bool alreadyIncluded = false;
                for (uint256 k = 0; k < affectedCount; k++) {
                    if (affectedIds[k] == testId) {
                        alreadyIncluded = true;
                        break;
                    }
                }

                if (!alreadyIncluded) {
                    affectedIds[affectedCount] = testId;
                    affectedCount++;
                }
            }
        }

        bytes[] memory affectedTests = new bytes[](affectedCount);
        for (uint256 i = 0; i < affectedCount; i++) {
            MappingEntry storage m = _mappings[affectedIds[i]];
            affectedTests[i] = abi.encode(m.testId, m.language, m.testType, m.duration);
        }

        emit AnalyzeCompleted("ok", affectedTests);

        return AnalyzeOkResult({
            success: true,
            affectedTests: affectedTests
        });
    }

    /// @notice select - Selects and prioritizes tests within a time budget.
    function select(bytes[] memory affectedTests, bytes memory budget) external returns (SelectOkResult memory) {
        int256 budgetMs = affectedTests.length > 0 ? int256(affectedTests.length) * int256(1000) : int256(10000);
        if (budget.length >= 32) {
            budgetMs = abi.decode(budget, (int256));
        }

        int256 estimatedDuration = 0;
        uint256 selectedCount = 0;

        for (uint256 i = 0; i < affectedTests.length; i++) {
            if (affectedTests[i].length >= 128) {
                (, , , int256 testDuration) = abi.decode(affectedTests[i], (string, string, string, int256));
                if (estimatedDuration + testDuration <= budgetMs) {
                    estimatedDuration += testDuration;
                    selectedCount++;
                }
            } else {
                selectedCount++;
                estimatedDuration += 100;
            }
        }

        if (selectedCount >= affectedTests.length) {
            selectedCount = affectedTests.length;
        }

        bytes[] memory selected = new bytes[](selectedCount);
        for (uint256 i = 0; i < selectedCount; i++) {
            selected[i] = affectedTests[i];
        }

        uint256 confidence = affectedTests.length > 0 ? (selectedCount * 100) / affectedTests.length : 100;

        emit SelectCompleted("ok", selected, estimatedDuration, confidence, 0);

        return SelectOkResult({
            success: true,
            selected: selected,
            estimatedDuration: estimatedDuration,
            confidence: confidence
        });
    }

    /// @notice record - Records a test execution with its source coverage for future analysis.
    function record(string memory testId, string memory language, string memory testType, string[] memory coveredSources, int256 duration, bool passed) external returns (RecordOkResult memory) {
        require(bytes(testId).length > 0, "Test ID must not be empty");

        bytes32 mappingId = keccak256(abi.encodePacked("mapping:", testId, language));

        _mappings[mappingId] = MappingEntry({
            testId: testId,
            language: language,
            testType: testType,
            coveredSources: coveredSources,
            duration: duration,
            passed: passed,
            recordedAt: block.timestamp,
            exists: true
        });

        if (!_mappingExists[mappingId]) {
            _mappingExists[mappingId] = true;
            _mappingIds.push(mappingId);
        }

        // Update source -> test reverse index
        for (uint256 i = 0; i < coveredSources.length; i++) {
            bytes32 sourceKey = keccak256(abi.encodePacked("source:", coveredSources[i]));

            bytes32[] storage existingTests = _sourceToTests[sourceKey];
            bool alreadyIndexed = false;
            for (uint256 j = 0; j < existingTests.length; j++) {
                if (existingTests[j] == mappingId) {
                    alreadyIndexed = true;
                    break;
                }
            }
            if (!alreadyIndexed) {
                _sourceToTests[sourceKey].push(mappingId);
            }
        }

        _totalRecords++;
        if (passed) _totalPassed++;
        _totalDuration += duration;

        emit RecordCompleted("ok", mappingId);

        return RecordOkResult({
            success: true,
            mappingIdId: mappingId
        });
    }

    /// @notice statistics - Returns aggregate statistics about test selection mappings.
    function statistics() external returns (StatisticsOkResult memory) {
        uint256 activeMappings = 0;
        int256 avgDuration = 0;

        for (uint256 i = 0; i < _mappingIds.length; i++) {
            if (_mappingExists[_mappingIds[i]]) {
                activeMappings++;
            }
        }

        if (_totalRecords > 0) {
            avgDuration = _totalDuration / int256(_totalRecords);
        }

        uint256 passRate = _totalRecords > 0 ? (_totalPassed * 100) / _totalRecords : 0;

        bytes memory stats = abi.encode(
            activeMappings,
            _totalRecords,
            _totalPassed,
            passRate,
            avgDuration,
            _totalDuration
        );

        emit StatisticsCompleted("ok", stats);

        return StatisticsOkResult({
            success: true,
            stats: stats
        });
    }
}
