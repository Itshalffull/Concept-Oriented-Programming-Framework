// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DotenvProvider
/// @notice .env file environment provider — fetches environment variables from dotenv files.
contract DotenvProvider {

    // --- Storage ---

    /// @dev variable key hash => encoded variable data (name, value, filePath, timestamp)
    mapping(bytes32 => bytes) private _varData;

    /// @dev tracks which variable key hashes exist
    mapping(bytes32 => bool) private _varExists;

    /// @dev ordered list of variable key hashes
    bytes32[] private _varKeys;

    // --- Types ---

    struct FetchInput {
        string name;
        string filePath;
    }

    struct FetchOkResult {
        bool success;
        string value;
    }

    struct FetchFileNotFoundResult {
        bool success;
        string filePath;
    }

    struct FetchParseErrorResult {
        bool success;
        string filePath;
        int256 line;
        string reason;
    }

    struct FetchVariableNotSetResult {
        bool success;
        string name;
        string filePath;
    }

    // --- Events ---

    event FetchCompleted(string variant, int256 line);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "dotenv";
        category = "env";
        capabilities = new string[](1);
        capabilities[0] = "fetch";
    }

    // --- Actions ---

    /// @notice Fetch an environment variable from a .env file.
    function fetch(string memory name, string memory filePath) external returns (FetchOkResult memory) {
        require(bytes(name).length > 0, "Variable name must not be empty");
        require(bytes(filePath).length > 0, "File path must not be empty");

        bytes32 key = keccak256(abi.encodePacked(name, filePath));

        _varData[key] = abi.encode(name, filePath, block.timestamp);
        if (!_varExists[key]) {
            _varExists[key] = true;
            _varKeys.push(key);
        }

        emit FetchCompleted("ok", int256(0));

        return FetchOkResult({success: true, value: ""});
    }

}
