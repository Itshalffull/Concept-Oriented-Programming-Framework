// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DesignTokenProvider
/// @notice Design token surface provider
/// @dev Implements the DesignTokenProvider concept from Clef specification.
///      Provides design token resolution and theme switching for surface generation.

contract DesignTokenProvider {

    // --- Types ---

    struct InitializeOkResult {
        bool success;
        bytes32 instance;
    }

    struct InitializeConfigErrorResult {
        bool success;
        string message;
    }

    struct ResolveOkResult {
        bool success;
        bytes32 instance;
        string value;
    }

    struct ResolveNotFoundErrorResult {
        bool success;
        string message;
    }

    struct SwitchThemeOkResult {
        bool success;
        bytes32 instance;
        string theme;
    }

    struct SwitchThemeNotFoundErrorResult {
        bool success;
        string message;
    }

    struct GetTokensOkResult {
        bool success;
        bytes32 instance;
        uint256 count;
    }

    struct GetTokensEmptyErrorResult {
        bool success;
        string message;
    }

    struct ExportOkResult {
        bool success;
        bytes32 instance;
        string format;
    }

    struct ExportFormatErrorResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Maps instance ID to existence
    mapping(bytes32 => bool) private _instances;

    /// @dev Ordered list of instance IDs
    bytes32[] private _instanceKeys;

    /// @dev Maps instance ID to token name to token value
    mapping(bytes32 => mapping(string => string)) private _tokens;

    /// @dev Maps instance ID to active theme name
    mapping(bytes32 => string) private _activeTheme;

    // --- Events ---

    event InitializeCompleted(string variant, bytes32 instance);
    event ResolveCompleted(string variant, bytes32 instance);
    event SwitchThemeCompleted(string variant, bytes32 instance);
    event GetTokensCompleted(string variant, bytes32 instance);
    event ExportCompleted(string variant, bytes32 instance);

    // --- Metadata ---

    /// @notice Returns static provider metadata
    /// @return name The provider name
    /// @return category The provider category
    function register() external pure returns (string memory name, string memory category) {
        return ("design-token", "surface-provider");
    }

    // --- Actions ---

    /// @notice initialize — create a new design token provider instance
    function initialize() external returns (InitializeOkResult memory) {
        bytes32 instance = keccak256(abi.encodePacked("design-token", "surface-provider", block.timestamp, _instanceKeys.length));

        _instances[instance] = true;
        _instanceKeys.push(instance);

        emit InitializeCompleted("ok", instance);

        return InitializeOkResult({success: true, instance: instance});
    }

    /// @notice resolve — resolve a design token by name
    function resolve(bytes32 instance, string calldata tokenName) external returns (ResolveOkResult memory) {
        require(_instances[instance], "Instance not found");

        string memory value = _tokens[instance][tokenName];

        emit ResolveCompleted("ok", instance);

        return ResolveOkResult({success: true, instance: instance, value: value});
    }

    /// @notice switchTheme — switch the active theme for an instance
    function switchTheme(bytes32 instance, string calldata theme) external returns (SwitchThemeOkResult memory) {
        require(_instances[instance], "Instance not found");

        _activeTheme[instance] = theme;

        emit SwitchThemeCompleted("ok", instance);

        return SwitchThemeOkResult({success: true, instance: instance, theme: theme});
    }

    /// @notice getTokens — retrieve token count for an instance
    function getTokens(bytes32 instance) external returns (GetTokensOkResult memory) {
        require(_instances[instance], "Instance not found");

        emit GetTokensCompleted("ok", instance);

        return GetTokensOkResult({success: true, instance: instance, count: _instanceKeys.length});
    }

    /// @notice export — export tokens in a specified format
    function export_(bytes32 instance, string calldata format) external returns (ExportOkResult memory) {
        require(_instances[instance], "Instance not found");

        emit ExportCompleted("ok", instance);

        return ExportOkResult({success: true, instance: instance, format: format});
    }

}
