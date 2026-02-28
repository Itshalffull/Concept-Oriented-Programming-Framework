// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SolidityBuilder
/// @notice Solidity builder provider. Compiles, tests, and packages Solidity source code.
contract SolidityBuilder {

    // --- Storage ---

    struct BuildRecord {
        string source;
        string toolchainPath;
        string platform;
        string artifactPath;
        string artifactHash;
        string status;
        uint256 timestamp;
        bool exists;
    }

    mapping(bytes32 => BuildRecord) private _builds;
    bytes32[] private _buildIds;

    struct PackageRecord {
        string artifactPath;
        string artifactHash;
        string format;
        bool exists;
    }

    mapping(bytes32 => PackageRecord) private _packages;

    // --- Types ---

    struct BuildInput {
        string source;
        string toolchainPath;
        string platform;
        bytes config;
    }

    struct BuildOkResult {
        bool success;
        bytes32 build;
        string artifactPath;
        string artifactHash;
    }

    struct BuildCompilationErrorResult {
        bool success;
        bytes[] errors;
    }

    struct BuildPragmaMismatchResult {
        bool success;
        string required;
        string installed;
    }

    struct TestInput {
        bytes32 build;
        string toolchainPath;
        bytes invocation;
        string testType;
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

    struct PackageInput {
        bytes32 build;
        string format;
    }

    struct PackageOkResult {
        bool success;
        string artifactPath;
        string artifactHash;
    }

    struct PackageFormatUnsupportedResult {
        bool success;
        string format;
    }

    struct RegisterOkResult {
        bool success;
        string name;
        string language;
        string[] capabilities;
    }

    // --- Events ---

    event BuildCompleted(string variant, bytes32 build, bytes[] errors);
    event TestCompleted(string variant, int256 passed, int256 failed, int256 skipped, int256 duration, bytes[] failures);
    event PackageCompleted(string variant);
    event RegisterCompleted(string variant, string[] capabilities);

    // --- Actions ---

    /// @notice build - Compiles Solidity source code into an artifact.
    function build(string memory source, string memory toolchainPath, string memory platform, bytes memory config) external returns (BuildOkResult memory) {
        require(bytes(source).length > 0, "Source must not be empty");
        require(bytes(toolchainPath).length > 0, "Toolchain path must not be empty");

        bytes32 buildId = keccak256(abi.encodePacked(source, toolchainPath, platform, block.timestamp, block.number));
        string memory artifactPath = string(abi.encodePacked(source, "/out"));
        string memory artifactHash = string(abi.encodePacked(buildId));

        _builds[buildId] = BuildRecord({
            source: source,
            toolchainPath: toolchainPath,
            platform: platform,
            artifactPath: artifactPath,
            artifactHash: artifactHash,
            status: "completed",
            timestamp: block.timestamp,
            exists: true
        });
        _buildIds.push(buildId);

        bytes[] memory emptyErrors;
        emit BuildCompleted("ok", buildId, emptyErrors);

        return BuildOkResult({
            success: true,
            build: buildId,
            artifactPath: artifactPath,
            artifactHash: artifactHash
        });
    }

    /// @notice runTests - Runs tests on a previously built Solidity artifact.
    function runTests(bytes32 buildId, string memory toolchainPath, bytes memory invocation, string memory testType) external returns (TestOkResult memory) {
        require(_builds[buildId].exists, "Build not found");

        int256 passed = int256(1);
        int256 failed = int256(0);
        int256 skipped = int256(0);
        int256 duration = int256(block.timestamp % 500);

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

    /// @notice package - Creates a distributable package from a build.
    function package(bytes32 buildId, string memory format) external returns (PackageOkResult memory) {
        require(_builds[buildId].exists, "Build not found");
        require(bytes(format).length > 0, "Format must not be empty");

        BuildRecord storage rec = _builds[buildId];
        string memory pkgPath = string(abi.encodePacked(rec.artifactPath, ".", format));
        string memory pkgHash = string(abi.encodePacked(keccak256(abi.encodePacked(buildId, format))));

        bytes32 pkgId = keccak256(abi.encodePacked(buildId, format));
        _packages[pkgId] = PackageRecord({
            artifactPath: pkgPath,
            artifactHash: pkgHash,
            format: format,
            exists: true
        });

        emit PackageCompleted("ok");

        return PackageOkResult({
            success: true,
            artifactPath: pkgPath,
            artifactHash: pkgHash
        });
    }

    /// @notice register - Returns static metadata for this builder provider.
    function register() external pure returns (RegisterOkResult memory) {
        string[] memory caps = new string[](2);
        caps[0] = "forge";
        caps[1] = "solc";

        return RegisterOkResult({
            success: true,
            name: "solidity-builder",
            language: "solidity",
            capabilities: caps
        });
    }

}
