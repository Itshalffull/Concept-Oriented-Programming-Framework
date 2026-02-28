// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EnvProvider
/// @notice Generic environment variable provider — fetches environment variables.
contract EnvProvider {

    // --- Storage ---

    /// @dev variable name hash => encoded variable data (name, value, timestamp)
    mapping(bytes32 => bytes) private _varData;

    /// @dev tracks which variable name hashes exist
    mapping(bytes32 => bool) private _varExists;

    /// @dev ordered list of variable name hashes
    bytes32[] private _varKeys;

    // --- Types ---

    struct FetchOkResult {
        bool success;
        string value;
    }

    struct FetchVariableNotSetResult {
        bool success;
        string name;
    }

    // --- Events ---

    event FetchCompleted(string variant);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "env-provider";
        category = "env";
        capabilities = new string[](1);
        capabilities[0] = "fetch";
    }

    // --- Actions ---

    /// @notice Fetch an environment variable by name.
    function fetch(string memory name) external returns (FetchOkResult memory) {
        require(bytes(name).length > 0, "Variable name must not be empty");

        bytes32 key = keccak256(abi.encodePacked(name));

        _varData[key] = abi.encode(name, block.timestamp);
        if (!_varExists[key]) {
            _varExists[key] = true;
            _varKeys.push(key);
        }

        emit FetchCompleted("ok");

        return FetchOkResult({success: true, value: ""});
    }

}
