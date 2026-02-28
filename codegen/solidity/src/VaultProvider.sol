// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VaultProvider
/// @notice HashiCorp Vault provider — fetches secrets, manages leases, and rotates credentials.
contract VaultProvider {

    // --- Storage ---

    /// @dev path hash => encoded secret data
    mapping(bytes32 => bytes) private _secretData;

    /// @dev tracks which path hashes have been fetched
    mapping(bytes32 => bool) private _pathExists;

    /// @dev ordered list of path hashes
    bytes32[] private _pathKeys;

    /// @dev lease ID hash => encoded lease data (path, duration, timestamp)
    mapping(bytes32 => bytes) private _leaseData;

    /// @dev tracks which lease IDs exist
    mapping(bytes32 => bool) private _leaseExists;

    /// @dev path hash => version counter for rotation
    mapping(bytes32 => uint256) private _versionCounter;

    /// @dev path hash => lease counter for generating unique lease IDs
    mapping(bytes32 => uint256) private _leaseCounter;

    // --- Types ---

    struct FetchOkResult {
        bool success;
        string value;
        string leaseId;
        int256 leaseDuration;
    }

    struct FetchSealedResult {
        bool success;
        string vaultAddress;
    }

    struct FetchTokenExpiredResult {
        bool success;
        string vaultAddress;
    }

    struct FetchPathNotFoundResult {
        bool success;
        string path;
    }

    struct RenewLeaseOkResult {
        bool success;
        string leaseId;
        int256 newDuration;
    }

    struct RenewLeaseLeaseExpiredResult {
        bool success;
        string leaseId;
    }

    struct RotateOkResult {
        bool success;
        int256 newVersion;
    }

    // --- Events ---

    event FetchCompleted(string variant, int256 leaseDuration);
    event RenewLeaseCompleted(string variant, int256 newDuration);
    event RotateCompleted(string variant, int256 newVersion);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "vault";
        category = "secret";
        capabilities = new string[](3);
        capabilities[0] = "fetch";
        capabilities[1] = "renewLease";
        capabilities[2] = "rotate";
    }

    // --- Actions ---

    /// @notice Fetch a secret from HashiCorp Vault.
    function fetch(string memory path) external returns (FetchOkResult memory) {
        require(bytes(path).length > 0, "Path must not be empty");

        bytes32 key = keccak256(abi.encodePacked(path));

        if (!_pathExists[key]) {
            _pathExists[key] = true;
            _pathKeys.push(key);
            _versionCounter[key] = 1;
            _leaseCounter[key] = 0;
        }

        _leaseCounter[key] += 1;
        string memory leaseId = string(abi.encodePacked("lease-", _toString(_leaseCounter[key])));
        int256 leaseDuration = int256(3600); // 1 hour default

        bytes32 leaseKey = keccak256(abi.encodePacked(leaseId));
        _leaseData[leaseKey] = abi.encode(path, leaseDuration, block.timestamp);
        _leaseExists[leaseKey] = true;

        _secretData[key] = abi.encode(path, leaseId, block.timestamp);

        emit FetchCompleted("ok", leaseDuration);

        return FetchOkResult({
            success: true,
            value: "",
            leaseId: leaseId,
            leaseDuration: leaseDuration
        });
    }

    /// @notice Renew a Vault lease.
    function renewLease(string memory leaseId) external returns (RenewLeaseOkResult memory) {
        bytes32 leaseKey = keccak256(abi.encodePacked(leaseId));
        require(_leaseExists[leaseKey], "Lease not found - fetch first");

        int256 newDuration = int256(3600); // renew for 1 hour

        _leaseData[leaseKey] = abi.encode(leaseId, newDuration, block.timestamp);

        emit RenewLeaseCompleted("ok", newDuration);

        return RenewLeaseOkResult({
            success: true,
            leaseId: leaseId,
            newDuration: newDuration
        });
    }

    /// @notice Rotate a secret at the given path.
    function rotate(string memory path) external returns (RotateOkResult memory) {
        bytes32 key = keccak256(abi.encodePacked(path));
        require(_pathExists[key], "Path not found - fetch first");

        _versionCounter[key] += 1;
        int256 newVersion = int256(_versionCounter[key]);

        _secretData[key] = abi.encode(path, newVersion, block.timestamp);

        emit RotateCompleted("ok", newVersion);

        return RotateOkResult({success: true, newVersion: newVersion});
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
