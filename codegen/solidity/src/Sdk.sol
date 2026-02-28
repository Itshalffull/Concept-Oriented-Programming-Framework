// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Sdk
/// @notice Generated from Sdk concept specification
/// @dev Manages SDK generation from projections and publishing to registries

contract Sdk {

    // --- Storage ---

    struct PackageInfo {
        string projection;
        string language;
        string config;
        string[] files;
        string packageJson;
        string publishedVersion;
        bool published;
        uint256 created;
        bool exists;
    }

    mapping(bytes32 => PackageInfo) private _packages;
    bytes32[] private _packageKeys;
    uint256 private _nonce;

    // --- Types ---

    struct GenerateInput {
        string projection;
        string language;
        string config;
    }

    struct GenerateOkResult {
        bool success;
        bytes32 package;
        string[] files;
        string packageJson;
    }

    struct GenerateUnsupportedTypeResult {
        bool success;
        string typeName;
        string language;
    }

    struct GenerateLanguageErrorResult {
        bool success;
        string language;
        string reason;
    }

    struct PublishInput {
        bytes32 package;
        string registry;
    }

    struct PublishOkResult {
        bool success;
        bytes32 package;
        string publishedVersion;
    }

    struct PublishVersionExistsResult {
        bool success;
        bytes32 package;
        string version;
    }

    struct PublishRegistryUnavailableResult {
        bool success;
        string registry;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes32 package, string[] files);
    event PublishCompleted(string variant, bytes32 package);

    // --- Actions ---

    /// @notice generate
    function generate(string memory projection, string memory language, string memory config) external returns (GenerateOkResult memory) {
        require(bytes(projection).length > 0, "Projection must not be empty");
        require(bytes(language).length > 0, "Language must not be empty");

        bytes32 packageId = keccak256(abi.encodePacked(projection, language, block.timestamp, _nonce++));

        // Generate default SDK file list based on language
        string[] memory files = new string[](2);
        files[0] = string(abi.encodePacked("index.", language));
        files[1] = string(abi.encodePacked("types.", language));

        string memory packageJson = string(abi.encodePacked(
            "{\"name\":\"", projection, "-sdk\",\"language\":\"", language, "\"}"
        ));

        _packages[packageId] = PackageInfo({
            projection: projection,
            language: language,
            config: config,
            files: files,
            packageJson: packageJson,
            publishedVersion: "",
            published: false,
            created: block.timestamp,
            exists: true
        });
        _packageKeys.push(packageId);

        emit GenerateCompleted("ok", packageId, files);

        return GenerateOkResult({
            success: true,
            package: packageId,
            files: files,
            packageJson: packageJson
        });
    }

    /// @notice publish
    function publish(bytes32 packageId, string memory registry) external returns (PublishOkResult memory) {
        require(_packages[packageId].exists, "Package does not exist");
        require(!_packages[packageId].published, "Package already published");
        require(bytes(registry).length > 0, "Registry must not be empty");

        string memory version = "1.0.0";
        _packages[packageId].published = true;
        _packages[packageId].publishedVersion = version;

        emit PublishCompleted("ok", packageId);

        return PublishOkResult({
            success: true,
            package: packageId,
            publishedVersion: version
        });
    }

}
