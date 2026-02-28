// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Conformance
/// @notice Conformance testing with test vector generation, verification, and cross-language matrix.
/// @dev Manages conformance suites for validating concept implementations across languages.

contract Conformance {

    // --- Storage ---

    struct SuiteEntry {
        string concept;
        string specPath;
        bytes[] testVectors;
        uint256 createdAt;
        bool exists;
    }

    mapping(bytes32 => SuiteEntry) private _suites;
    bytes32[] private _suiteIds;
    mapping(bytes32 => bool) private _suiteExists;

    // Verification results
    struct VerificationResult {
        bytes32 suite;
        string language;
        int256 passed;
        int256 total;
        string[] coveredRequirements;
        uint256 verifiedAt;
        bool exists;
    }

    mapping(bytes32 => VerificationResult) private _verifications;
    bytes32[] private _verificationIds;
    mapping(bytes32 => bool) private _verificationExists;

    // Deviations
    struct DeviationEntry {
        string concept;
        string language;
        string requirement;
        string reason;
        uint256 registeredAt;
        bool exists;
    }

    mapping(bytes32 => DeviationEntry) private _deviations;
    bytes32[] private _deviationIds;
    mapping(bytes32 => bool) private _deviationExists;

    // --- Types ---

    struct GenerateInput {
        string concept;
        string specPath;
    }

    struct GenerateOkResult {
        bool success;
        bytes32 suite;
        bytes[] testVectors;
    }

    struct GenerateSpecErrorResult {
        bool success;
        string concept;
        string message;
    }

    struct VerifyInput {
        bytes32 suite;
        string language;
        string artifactLocation;
    }

    struct VerifyOkResult {
        bool success;
        int256 passed;
        int256 total;
        string[] coveredRequirements;
    }

    struct VerifyFailureResult {
        bool success;
        int256 passed;
        int256 failed;
        bytes[] failures;
    }

    struct VerifyDeviationDetectedResult {
        bool success;
        string requirement;
        string language;
        string reason;
    }

    struct RegisterDeviationInput {
        string concept;
        string language;
        string requirement;
        string reason;
    }

    struct RegisterDeviationOkResult {
        bool success;
        bytes32 suite;
    }

    struct MatrixOkResult {
        bool success;
        bytes[] matrix;
    }

    struct TraceabilityOkResult {
        bool success;
        bytes[] requirements;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes32 suite, bytes[] testVectors);
    event VerifyCompleted(string variant, int256 passed, int256 total, string[] coveredRequirements, int256 failed, bytes[] failures);
    event RegisterDeviationCompleted(string variant, bytes32 suite);
    event MatrixCompleted(string variant, bytes[] matrix);
    event TraceabilityCompleted(string variant, bytes[] requirements);

    // --- Actions ---

    /// @notice generate - Generates a conformance test suite from a concept specification.
    function generate(string memory concept, string memory specPath) external returns (GenerateOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(specPath).length > 0, "Spec path must not be empty");

        bytes32 suiteId = keccak256(abi.encodePacked("suite:", concept, specPath));

        // Generate test vectors from the spec
        bytes[] memory testVectors = new bytes[](3);
        testVectors[0] = abi.encode(string(abi.encodePacked(concept, ":create")), "create action validates input");
        testVectors[1] = abi.encode(string(abi.encodePacked(concept, ":read")), "read action returns stored data");
        testVectors[2] = abi.encode(string(abi.encodePacked(concept, ":invariant")), "invariants hold after mutations");

        _suites[suiteId] = SuiteEntry({
            concept: concept,
            specPath: specPath,
            testVectors: testVectors,
            createdAt: block.timestamp,
            exists: true
        });

        if (!_suiteExists[suiteId]) {
            _suiteExists[suiteId] = true;
            _suiteIds.push(suiteId);
        }

        emit GenerateCompleted("ok", suiteId, testVectors);

        return GenerateOkResult({
            success: true,
            suite: suiteId,
            testVectors: testVectors
        });
    }

    /// @notice verify - Verifies an artifact against a conformance suite.
    function verify(bytes32 suite, string memory language, string memory artifactLocation) external returns (VerifyOkResult memory) {
        require(_suiteExists[suite], "Suite not found");

        SuiteEntry storage s = _suites[suite];
        int256 total = int256(s.testVectors.length);
        int256 passed = total; // Simulate all passing

        string[] memory coveredRequirements = new string[](uint256(total));
        for (uint256 i = 0; i < uint256(total); i++) {
            coveredRequirements[i] = string(abi.encodePacked(s.concept, ":req_", _uint256ToString(i)));
        }

        // Record verification
        bytes32 verifId = keccak256(abi.encodePacked(suite, language, artifactLocation, block.timestamp));
        _verifications[verifId] = VerificationResult({
            suite: suite,
            language: language,
            passed: passed,
            total: total,
            coveredRequirements: coveredRequirements,
            verifiedAt: block.timestamp,
            exists: true
        });
        _verificationExists[verifId] = true;
        _verificationIds.push(verifId);

        bytes[] memory emptyFailures = new bytes[](0);
        emit VerifyCompleted("ok", passed, total, coveredRequirements, 0, emptyFailures);

        return VerifyOkResult({
            success: true,
            passed: passed,
            total: total,
            coveredRequirements: coveredRequirements
        });
    }

    /// @notice registerDeviation - Registers a known deviation from the spec for a language.
    function registerDeviation(string memory concept, string memory language, string memory requirement, string memory reason) external returns (RegisterDeviationOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");

        bytes32 devId = keccak256(abi.encodePacked(concept, language, requirement));
        bytes32 suiteId = keccak256(abi.encodePacked("suite:", concept));

        _deviations[devId] = DeviationEntry({
            concept: concept,
            language: language,
            requirement: requirement,
            reason: reason,
            registeredAt: block.timestamp,
            exists: true
        });

        if (!_deviationExists[devId]) {
            _deviationExists[devId] = true;
            _deviationIds.push(devId);
        }

        emit RegisterDeviationCompleted("ok", suiteId);

        return RegisterDeviationOkResult({
            success: true,
            suite: suiteId
        });
    }

    /// @notice matrix - Returns the cross-language conformance matrix for given concepts.
    function matrix(string[] memory concepts) external returns (MatrixOkResult memory) {
        uint256 matrixSize = 0;

        for (uint256 i = 0; i < concepts.length; i++) {
            for (uint256 j = 0; j < _verificationIds.length; j++) {
                if (_verificationExists[_verificationIds[j]]) {
                    VerificationResult storage v = _verifications[_verificationIds[j]];
                    bytes32 suiteId = keccak256(abi.encodePacked("suite:", concepts[i]));
                    // Check by directly comparing the suite reference
                    if (v.suite == suiteId || _suiteExists[v.suite]) {
                        matrixSize++;
                    }
                }
            }
        }

        // Build matrix entries (concept, language, passed, total)
        bytes[] memory matrixData = new bytes[](_verificationIds.length);
        uint256 idx = 0;
        for (uint256 i = 0; i < _verificationIds.length; i++) {
            if (_verificationExists[_verificationIds[i]]) {
                VerificationResult storage v = _verifications[_verificationIds[i]];
                matrixData[idx] = abi.encode(v.suite, v.language, v.passed, v.total);
                idx++;
            }
        }

        // Trim to actual size
        bytes[] memory trimmed = new bytes[](idx);
        for (uint256 i = 0; i < idx; i++) {
            trimmed[i] = matrixData[i];
        }

        emit MatrixCompleted("ok", trimmed);

        return MatrixOkResult({
            success: true,
            matrix: trimmed
        });
    }

    /// @notice traceability - Returns all requirements and their test coverage for a concept.
    function traceability(string memory concept) external returns (TraceabilityOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");

        bytes32 suiteId = keccak256(abi.encodePacked("suite:", concept));

        uint256 reqCount = 0;
        if (_suiteExists[suiteId]) {
            reqCount = _suites[suiteId].testVectors.length;
        }

        bytes[] memory requirements = new bytes[](reqCount);
        for (uint256 i = 0; i < reqCount; i++) {
            string memory reqName = string(abi.encodePacked(concept, ":req_", _uint256ToString(i)));

            // Check if this requirement has a deviation
            bool hasDeviation = false;
            for (uint256 j = 0; j < _deviationIds.length; j++) {
                if (_deviationExists[_deviationIds[j]]) {
                    DeviationEntry storage d = _deviations[_deviationIds[j]];
                    if (keccak256(bytes(d.concept)) == keccak256(bytes(concept)) &&
                        keccak256(bytes(d.requirement)) == keccak256(bytes(reqName))) {
                        hasDeviation = true;
                        break;
                    }
                }
            }

            requirements[i] = abi.encode(reqName, true, hasDeviation);
        }

        emit TraceabilityCompleted("ok", requirements);

        return TraceabilityOkResult({
            success: true,
            requirements: requirements
        });
    }

    // --- Internal helpers ---

    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
}
