// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Typography
/// @notice Typography management with scale definition, font stacks, and styling
/// @dev Implements the Typography concept from Clef specification.
///      Supports defining typography scales (base size + ratio + steps),
///      font stack registration, and text style configuration.

contract Typography {

    // --- Types ---

    struct TypographyEntry {
        uint256 baseSize;
        uint256 ratio;
        int256 steps;
        string scale;
        bool scaleExists;
        bool exists;
    }

    struct FontStack {
        string name;
        string fonts;
        string category;
        bool exists;
    }

    struct TextStyle {
        string name;
        string config;
        bool exists;
    }

    struct DefineScaleInput {
        bytes32 typography;
        uint256 baseSize;
        uint256 ratio;
        int256 steps;
    }

    struct DefineScaleOkResult {
        bool success;
        bytes32 typography;
        string scale;
    }

    struct DefineScaleInvalidResult {
        bool success;
        string message;
    }

    struct DefineFontStackInput {
        bytes32 typography;
        string name;
        string fonts;
        string category;
    }

    struct DefineFontStackOkResult {
        bool success;
        bytes32 typography;
    }

    struct DefineFontStackDuplicateResult {
        bool success;
        string message;
    }

    struct DefineStyleInput {
        bytes32 typography;
        string name;
        string config;
    }

    struct DefineStyleOkResult {
        bool success;
        bytes32 typography;
    }

    struct DefineStyleInvalidResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Maps typography ID to its entry
    mapping(bytes32 => TypographyEntry) private _typographies;

    /// @dev Maps typography ID -> font stack name hash -> FontStack
    mapping(bytes32 => mapping(bytes32 => FontStack)) private _fontStacks;

    /// @dev Maps typography ID -> font stack count
    mapping(bytes32 => uint256) private _fontStackCount;

    /// @dev Maps typography ID -> style name hash -> TextStyle
    mapping(bytes32 => mapping(bytes32 => TextStyle)) private _styles;

    /// @dev Maps typography ID -> style count
    mapping(bytes32 => uint256) private _styleCount;

    /// @dev Ordered list of all typography IDs
    bytes32[] private _typographyIds;

    // --- Events ---

    event DefineScaleCompleted(string variant, bytes32 typography);
    event DefineFontStackCompleted(string variant, bytes32 typography);
    event DefineStyleCompleted(string variant, bytes32 typography);

    // --- Actions ---

    /// @notice defineScale - creates or updates a typography scale
    /// @param typography The typography ID
    /// @param baseSize The base font size in the scale
    /// @param ratio The scaling ratio (stored as fixed-point, e.g. 1250 = 1.250)
    /// @param steps The number of steps in the scale
    /// @return result The scale definition result
    function defineScale(bytes32 typography, uint256 baseSize, uint256 ratio, int256 steps) external returns (DefineScaleOkResult memory result) {
        require(typography != bytes32(0), "Typography ID cannot be zero");
        require(baseSize > 0, "Base size must be positive");
        require(ratio > 0, "Ratio must be positive");

        string memory scale = string(abi.encodePacked(
            "base:", _uint2str(baseSize),
            ",ratio:", _uint2str(ratio),
            ",steps:", _int2str(steps)
        ));

        if (!_typographies[typography].exists) {
            _typographyIds.push(typography);
        }

        _typographies[typography] = TypographyEntry({
            baseSize: baseSize,
            ratio: ratio,
            steps: steps,
            scale: scale,
            scaleExists: true,
            exists: true
        });

        result = DefineScaleOkResult({
            success: true,
            typography: typography,
            scale: scale
        });

        emit DefineScaleCompleted("ok", typography);
    }

    /// @notice defineFontStack - registers a named font stack for a typography
    /// @param typography The typography ID
    /// @param name The font stack name
    /// @param fonts Comma-separated font family list
    /// @param category The font category (e.g. "serif", "sans-serif", "monospace")
    /// @return result The font stack definition result
    function defineFontStack(bytes32 typography, string calldata name, string calldata fonts, string calldata category) external returns (DefineFontStackOkResult memory result) {
        require(typography != bytes32(0), "Typography ID cannot be zero");
        require(bytes(name).length > 0, "Font stack name cannot be empty");
        require(bytes(fonts).length > 0, "Fonts cannot be empty");

        if (!_typographies[typography].exists) {
            _typographies[typography] = TypographyEntry({
                baseSize: 0,
                ratio: 0,
                steps: 0,
                scale: "",
                scaleExists: false,
                exists: true
            });
            _typographyIds.push(typography);
        }

        bytes32 nameHash = keccak256(abi.encodePacked(name));
        require(!_fontStacks[typography][nameHash].exists, "Font stack already exists");

        _fontStacks[typography][nameHash] = FontStack({
            name: name,
            fonts: fonts,
            category: category,
            exists: true
        });
        _fontStackCount[typography]++;

        result = DefineFontStackOkResult({ success: true, typography: typography });

        emit DefineFontStackCompleted("ok", typography);
    }

    /// @notice defineStyle - defines a named text style for a typography
    /// @param typography The typography ID
    /// @param name The style name
    /// @param config The serialised style configuration
    /// @return result The style definition result
    function defineStyle(bytes32 typography, string calldata name, string calldata config) external returns (DefineStyleOkResult memory result) {
        require(typography != bytes32(0), "Typography ID cannot be zero");
        require(_typographies[typography].exists, "Typography not found");
        require(bytes(name).length > 0, "Style name cannot be empty");
        require(bytes(config).length > 0, "Config cannot be empty");

        bytes32 nameHash = keccak256(abi.encodePacked(name));

        _styles[typography][nameHash] = TextStyle({
            name: name,
            config: config,
            exists: true
        });
        _styleCount[typography]++;

        result = DefineStyleOkResult({ success: true, typography: typography });

        emit DefineStyleCompleted("ok", typography);
    }

    // --- Views ---

    /// @notice get - retrieves a typography entry
    /// @param typography The typography ID to look up
    /// @return The TypographyEntry struct
    function get(bytes32 typography) external view returns (TypographyEntry memory) {
        require(_typographies[typography].exists, "Typography not found");
        return _typographies[typography];
    }

    /// @notice Get a font stack by typography ID and name
    /// @param typography The typography ID
    /// @param name The font stack name
    /// @return The FontStack struct
    function getFontStack(bytes32 typography, string calldata name) external view returns (FontStack memory) {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        require(_fontStacks[typography][nameHash].exists, "Font stack not found");
        return _fontStacks[typography][nameHash];
    }

    /// @notice Get a text style by typography ID and name
    /// @param typography The typography ID
    /// @param name The style name
    /// @return The TextStyle struct
    function getStyle(bytes32 typography, string calldata name) external view returns (TextStyle memory) {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        require(_styles[typography][nameHash].exists, "Style not found");
        return _styles[typography][nameHash];
    }

    /// @notice list - returns all typography IDs
    /// @return The array of typography IDs
    function list() external view returns (bytes32[] memory) {
        return _typographyIds;
    }

    /// @notice Check if a typography exists
    /// @param typography The typography ID to check
    /// @return Whether the typography exists
    function typographyExists(bytes32 typography) external view returns (bool) {
        return _typographies[typography].exists;
    }

    // --- Internal ---

    /// @dev Converts a uint256 to its string representation
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /// @dev Converts an int256 to its string representation
    function _int2str(int256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        bool negative = value < 0;
        uint256 absValue = negative ? uint256(-value) : uint256(value);
        string memory absStr = _uint2str(absValue);
        if (negative) {
            return string(abi.encodePacked("-", absStr));
        }
        return absStr;
    }
}
