// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ContractTest
/// @notice Contract testing with generation, cross-language verification, and deployment safety checks.
/// @dev Manages producer/consumer contract tests for validating concept interoperability.

contract ContractTest {

    // --- Storage ---

    struct ContractEntry {
        string concept;
        string specPath;
        bytes definition;
        uint256 createdAt;
        bool exists;
    }

    mapping(bytes32 => ContractEntry) private _contracts;
    bytes32[] private _contractIds;
    mapping(bytes32 => bool) private _contractExists;

    // Verification records
    struct VerificationRecord {
        bytes32 contractId;
        string producerLanguage;
        string consumerLanguage;
        int256 passed;
        int256 total;
        uint256 verifiedAt;
        bool exists;
    }

    mapping(bytes32 => VerificationRecord) private _verifications;
    bytes32[] private _verificationIds;
    mapping(bytes32 => bool) private _verificationExists;

    // --- Types ---

    struct GenerateInput {
        string concept;
        string specPath;
    }

    struct GenerateOkResult {
        bool success;
        bytes32 contractId;
        bytes definition;
    }

    struct GenerateSpecErrorResult {
        bool success;
        string concept;
        string message;
    }

    struct VerifyInput {
        bytes32 contractId;
        string producerArtifact;
        string producerLanguage;
        string consumerArtifact;
        string consumerLanguage;
    }

    struct VerifyOkResult {
        bool success;
        bytes32 contractId;
        int256 passed;
        int256 total;
    }

    struct VerifyIncompatibleResult {
        bool success;
        bytes32 contractId;
        bytes[] failures;
    }

    struct VerifyProducerUnavailableResult {
        bool success;
        string language;
        string reason;
    }

    struct VerifyConsumerUnavailableResult {
        bool success;
        string language;
        string reason;
    }

    struct MatrixOkResult {
        bool success;
        bytes[] matrix;
    }

    struct CanDeployInput {
        string concept;
        string language;
    }

    struct CanDeployOkResult {
        bool success;
        bool safe;
        string[] verifiedAgainst;
    }

    struct CanDeployUnverifiedResult {
        bool success;
        bytes[] missingPairs;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes32 contractId, bytes definition);
    event VerifyCompleted(string variant, bytes32 contractId, int256 passed, int256 total, bytes[] failures);
    event MatrixCompleted(string variant, bytes[] matrix);
    event CanDeployCompleted(string variant, bool safe, string[] verifiedAgainst, bytes[] missingPairs);

    // --- Actions ---

    /// @notice generate - Generates a contract test definition from a concept spec.
    function generate(string memory concept, string memory specPath) external returns (GenerateOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(specPath).length > 0, "Spec path must not be empty");

        bytes32 contractId = keccak256(abi.encodePacked("contract:", concept, specPath));

        // Generate contract definition
        bytes memory definition = abi.encode(
            concept,
            specPath,
            "producer must satisfy all state invariants",
            "consumer must handle all result variants"
        );

        _contracts[contractId] = ContractEntry({
            concept: concept,
            specPath: specPath,
            definition: definition,
            createdAt: block.timestamp,
            exists: true
        });

        if (!_contractExists[contractId]) {
            _contractExists[contractId] = true;
            _contractIds.push(contractId);
        }

        emit GenerateCompleted("ok", contractId, definition);

        return GenerateOkResult({
            success: true,
            contractId: contractId,
            definition: definition
        });
    }

    /// @notice verify - Verifies producer and consumer artifacts against a contract.
    function verify(bytes32 contractId, string memory producerArtifact, string memory producerLanguage, string memory consumerArtifact, string memory consumerLanguage) external returns (VerifyOkResult memory) {
        require(_contractExists[contractId], "Contract not found");

        // Simulate verification
        int256 total = 5;
        int256 passed = total;

        // Record verification
        bytes32 verifId = keccak256(abi.encodePacked(contractId, producerLanguage, consumerLanguage, block.timestamp));
        _verifications[verifId] = VerificationRecord({
            contractId: contractId,
            producerLanguage: producerLanguage,
            consumerLanguage: consumerLanguage,
            passed: passed,
            total: total,
            verifiedAt: block.timestamp,
            exists: true
        });
        _verificationExists[verifId] = true;
        _verificationIds.push(verifId);

        bytes[] memory emptyFailures = new bytes[](0);
        emit VerifyCompleted("ok", contractId, passed, total, emptyFailures);

        return VerifyOkResult({
            success: true,
            contractId: contractId,
            passed: passed,
            total: total
        });
    }

    /// @notice matrix - Returns the cross-language contract verification matrix.
    function matrix(string[] memory concepts) external returns (MatrixOkResult memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < _verificationIds.length; i++) {
            if (_verificationExists[_verificationIds[i]]) count++;
        }

        bytes[] memory matrixData = new bytes[](count);
        uint256 idx = 0;

        for (uint256 i = 0; i < _verificationIds.length; i++) {
            bytes32 id = _verificationIds[i];
            if (_verificationExists[id]) {
                VerificationRecord storage v = _verifications[id];
                matrixData[idx] = abi.encode(
                    v.contractId,
                    v.producerLanguage,
                    v.consumerLanguage,
                    v.passed,
                    v.total
                );
                idx++;
            }
        }

        emit MatrixCompleted("ok", matrixData);

        return MatrixOkResult({
            success: true,
            matrix: matrixData
        });
    }

    /// @notice canDeploy - Checks if a concept implementation is safe to deploy based on contract tests.
    function canDeploy(string memory concept, string memory language) external returns (CanDeployOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");

        // Find all verifications involving this concept and language
        uint256 verifiedCount = 0;

        for (uint256 i = 0; i < _verificationIds.length; i++) {
            bytes32 id = _verificationIds[i];
            if (!_verificationExists[id]) continue;
            VerificationRecord storage v = _verifications[id];

            // Check if this verification involves the requested language
            if (keccak256(bytes(v.producerLanguage)) == keccak256(bytes(language)) ||
                keccak256(bytes(v.consumerLanguage)) == keccak256(bytes(language))) {
                verifiedCount++;
            }
        }

        string[] memory verifiedAgainst = new string[](verifiedCount);
        uint256 idx = 0;

        for (uint256 i = 0; i < _verificationIds.length; i++) {
            bytes32 id = _verificationIds[i];
            if (!_verificationExists[id]) continue;
            VerificationRecord storage v = _verifications[id];

            if (keccak256(bytes(v.producerLanguage)) == keccak256(bytes(language))) {
                verifiedAgainst[idx] = v.consumerLanguage;
                idx++;
            } else if (keccak256(bytes(v.consumerLanguage)) == keccak256(bytes(language))) {
                verifiedAgainst[idx] = v.producerLanguage;
                idx++;
            }
        }

        bool safe = verifiedCount > 0;

        bytes[] memory emptyMissing = new bytes[](0);
        emit CanDeployCompleted("ok", safe, verifiedAgainst, emptyMissing);

        return CanDeployOkResult({
            success: true,
            safe: safe,
            verifiedAgainst: verifiedAgainst
        });
    }
}
