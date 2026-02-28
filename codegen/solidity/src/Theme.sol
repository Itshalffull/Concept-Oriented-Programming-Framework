// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Theme
/// @notice Theme management with creation, extension, activation, and token resolution.
contract Theme {

    // --- Storage ---

    struct ThemeEntry {
        string name;
        string overrides;
        bytes32 baseTheme;
        bool hasBase;
        bool active;
        int256 priority;
        string tokens;
        uint256 createdAt;
    }

    mapping(bytes32 => ThemeEntry) private _themes;
    mapping(bytes32 => bool) private _exists;

    // --- Types ---

    struct CreateOkResult {
        bool success;
        bytes32 theme;
    }

    struct ExtendOkResult {
        bool success;
        bytes32 theme;
    }

    struct ActivateOkResult {
        bool success;
        bytes32 theme;
    }

    struct DeactivateOkResult {
        bool success;
        bytes32 theme;
    }

    struct ResolveOkResult {
        bool success;
        string tokens;
    }

    // --- Events ---

    event CreateCompleted(string variant, bytes32 indexed theme);
    event ExtendCompleted(string variant, bytes32 indexed theme);
    event ActivateCompleted(string variant, bytes32 indexed theme);
    event DeactivateCompleted(string variant, bytes32 indexed theme);
    event ResolveCompleted(string variant);

    // --- Actions ---

    /// @notice Create a new theme with optional token overrides.
    function create(bytes32 theme, string memory name, string memory overrides) external returns (CreateOkResult memory) {
        require(!_exists[theme], "Theme already exists");
        require(bytes(name).length > 0, "Name required");

        _themes[theme] = ThemeEntry({
            name: name,
            overrides: overrides,
            baseTheme: bytes32(0),
            hasBase: false,
            active: false,
            priority: 0,
            tokens: overrides,
            createdAt: block.timestamp
        });
        _exists[theme] = true;

        emit CreateCompleted("ok", theme);
        return CreateOkResult({success: true, theme: theme});
    }

    /// @notice Extend an existing theme with additional overrides.
    function extend(bytes32 theme, bytes32 base, string memory overrides) external returns (ExtendOkResult memory) {
        require(!_exists[theme], "Theme already exists");
        require(_exists[base], "Base theme not found");

        // Merge base tokens with overrides
        string memory mergedTokens = string(abi.encodePacked(
            _themes[base].tokens, ";", overrides
        ));

        _themes[theme] = ThemeEntry({
            name: string(abi.encodePacked(_themes[base].name, "-extended")),
            overrides: overrides,
            baseTheme: base,
            hasBase: true,
            active: false,
            priority: 0,
            tokens: mergedTokens,
            createdAt: block.timestamp
        });
        _exists[theme] = true;

        emit ExtendCompleted("ok", theme);
        return ExtendOkResult({success: true, theme: theme});
    }

    /// @notice Activate a theme at a given priority level.
    function activate(bytes32 theme, int256 priority) external returns (ActivateOkResult memory) {
        require(_exists[theme], "Theme not found");

        _themes[theme].active = true;
        _themes[theme].priority = priority;

        emit ActivateCompleted("ok", theme);
        return ActivateOkResult({success: true, theme: theme});
    }

    /// @notice Deactivate a theme.
    function deactivate(bytes32 theme) external returns (DeactivateOkResult memory) {
        require(_exists[theme], "Theme not found");

        _themes[theme].active = false;

        emit DeactivateCompleted("ok", theme);
        return DeactivateOkResult({success: true, theme: theme});
    }

    /// @notice Resolve all tokens for a theme, including inherited tokens from base themes.
    function resolve(bytes32 theme) external returns (ResolveOkResult memory) {
        require(_exists[theme], "Theme not found");

        // Walk the base chain to build resolved tokens
        string memory tokens = _themes[theme].tokens;

        if (_themes[theme].hasBase) {
            bytes32 current = _themes[theme].baseTheme;
            uint256 depth = 0;
            while (_exists[current] && depth < 10) {
                tokens = string(abi.encodePacked(_themes[current].tokens, ";", tokens));
                if (!_themes[current].hasBase) break;
                current = _themes[current].baseTheme;
                depth++;
            }
        }

        emit ResolveCompleted("ok");
        return ResolveOkResult({success: true, tokens: tokens});
    }

}
