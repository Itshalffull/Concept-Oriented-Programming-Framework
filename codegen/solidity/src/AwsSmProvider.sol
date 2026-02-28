// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AwsSmProvider
/// @notice AWS Secrets Manager provider — fetches and rotates secrets.
contract AwsSmProvider {

    // --- Storage ---

    /// @dev secret key hash => encoded secret data (value, versionId, arn, timestamp)
    mapping(bytes32 => bytes) private _secretData;

    /// @dev tracks which secret key hashes exist
    mapping(bytes32 => bool) private _secretExists;

    /// @dev ordered list of secret key hashes
    bytes32[] private _secretKeys;

    /// @dev secret key hash => version counter for rotation
    mapping(bytes32 => uint256) private _versionCounter;

    // --- Types ---

    struct FetchInput {
        string secretId;
        string versionStage;
    }

    struct FetchOkResult {
        bool success;
        string value;
        string versionId;
        string arn;
    }

    struct FetchKmsKeyInaccessibleResult {
        bool success;
        string secretId;
        string kmsKeyId;
    }

    struct FetchResourceNotFoundResult {
        bool success;
        string secretId;
    }

    struct FetchDecryptionFailedResult {
        bool success;
        string secretId;
        string reason;
    }

    struct RotateOkResult {
        bool success;
        string secretId;
        string newVersionId;
    }

    struct RotateRotationInProgressResult {
        bool success;
        string secretId;
    }

    // --- Events ---

    event FetchCompleted(string variant);
    event RotateCompleted(string variant);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "aws-sm";
        category = "secret";
        capabilities = new string[](2);
        capabilities[0] = "fetch";
        capabilities[1] = "rotate";
    }

    // --- Actions ---

    /// @notice Fetch a secret from AWS Secrets Manager.
    function fetch(string memory secretId, string memory versionStage) external returns (FetchOkResult memory) {
        require(bytes(secretId).length > 0, "Secret ID must not be empty");

        bytes32 key = keccak256(abi.encodePacked(secretId));

        // Store the secret entry if not already present
        if (!_secretExists[key]) {
            _secretExists[key] = true;
            _secretKeys.push(key);
            _versionCounter[key] = 1;
            _secretData[key] = abi.encode(secretId, versionStage, block.timestamp);
        }

        string memory versionId = string(abi.encodePacked("v", _toString(_versionCounter[key])));
        string memory arn = string(abi.encodePacked("arn:aws:secretsmanager:us-east-1:000000000000:secret:", secretId));

        emit FetchCompleted("ok");

        return FetchOkResult({
            success: true,
            value: "",
            versionId: versionId,
            arn: arn
        });
    }

    /// @notice Rotate a secret in AWS Secrets Manager.
    function rotate(string memory secretId) external returns (RotateOkResult memory) {
        bytes32 key = keccak256(abi.encodePacked(secretId));
        require(_secretExists[key], "Secret not found - fetch first");

        _versionCounter[key] += 1;
        string memory newVersionId = string(abi.encodePacked("v", _toString(_versionCounter[key])));

        _secretData[key] = abi.encode(secretId, newVersionId, block.timestamp);

        emit RotateCompleted("ok");

        return RotateOkResult({
            success: true,
            secretId: secretId,
            newVersionId: newVersionId
        });
    }

    // --- Internal helpers ---

    function _toString(uint256 value) internal pure returns (string memory) {
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
