// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CoifThemeScaffoldGen
/// @notice Scaffold generator for Clef UI theme specifications
/// @dev Implements the CoifThemeScaffoldGen concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      generate() produces theme scaffold files from a theme definition.
///      preview() returns what would be generated without persisting.

contract CoifThemeScaffoldGen {

    // --- Storage (from concept state) ---

    // entries
    mapping(bytes32 => bytes) private _entries;

    // themes
    mapping(bytes32 => bool) private _themes;
    bytes32[] private _themesKeys;

    // --- Types ---

    struct GenerateInput {
        string name;
        string primaryColor;
        string fontFamily;
        int256 baseSize;
        string mode;
    }

    struct GenerateOkResult {
        bool success;
        bytes[] files;
        int256 filesGenerated;
    }

    struct GenerateErrorResult {
        bool success;
        string message;
    }

    struct PreviewInput {
        string name;
        string primaryColor;
        string fontFamily;
        int256 baseSize;
        string mode;
    }

    struct PreviewOkResult {
        bool success;
        bytes[] files;
        int256 wouldWrite;
        int256 wouldSkip;
    }

    struct PreviewErrorResult {
        bool success;
        string message;
    }

    struct RegisterOkResult {
        bool success;
        string name;
        string inputKind;
        string outputKind;
        string[] capabilities;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes[] files, int256 filesGenerated);
    event PreviewCompleted(string variant, bytes[] files, int256 wouldWrite, int256 wouldSkip);
    event RegisterCompleted(string variant, string[] capabilities);

    // --- Actions ---

    /// @notice register - returns static provider metadata for this scaffold generator
    /// @return result The provider metadata (name, inputKind, outputKind, capabilities)
    function register() external pure returns (RegisterOkResult memory result) {
        string[] memory capabilities = new string[](3);
        capabilities[0] = "theme-scaffold";
        capabilities[1] = "color-tokens";
        capabilities[2] = "typography-tokens";

        result = RegisterOkResult({
            success: true,
            name: "coif-theme-scaffold-gen",
            inputKind: "theme-spec",
            outputKind: "scaffold-files",
            capabilities: capabilities
        });
    }

    /// @notice generate - produces theme scaffold files and persists the generation record
    /// @param name The theme name
    /// @param primaryColor The primary color value
    /// @param fontFamily The font family name
    /// @param baseSize The base font size
    /// @param mode The theme mode (e.g. "light", "dark")
    /// @return result The generation result with produced files
    function generate(
        string memory name,
        string memory primaryColor,
        string memory fontFamily,
        int256 baseSize,
        string memory mode
    ) external returns (GenerateOkResult memory result) {
        require(bytes(name).length > 0, "Theme name cannot be empty");
        require(bytes(primaryColor).length > 0, "Primary color cannot be empty");
        require(baseSize > 0, "Base size must be positive");

        bytes32 themeId = keccak256(abi.encodePacked(name));

        // Build scaffold files: theme tokens + typography + mode variant
        bytes[] memory files = new bytes[](3);

        // Color tokens file
        files[0] = abi.encodePacked(
            "// Theme scaffold: ", name,
            "\n// Primary color: ", primaryColor,
            "\n// Mode: ", mode
        );

        // Typography tokens file
        files[1] = abi.encodePacked(
            "// Typography scaffold: ", name,
            "\n// Font family: ", fontFamily,
            "\n// Base size: ", _int2str(baseSize)
        );

        // Mode variant file
        files[2] = abi.encodePacked(
            "// Mode variant scaffold: ", name,
            "\n// Mode: ", mode,
            "\n// Primary color: ", primaryColor
        );

        // Persist generation record
        _entries[themeId] = abi.encode(name, primaryColor, fontFamily, baseSize, mode, block.timestamp);
        if (!_themes[themeId]) {
            _themes[themeId] = true;
            _themesKeys.push(themeId);
        }

        int256 filesGenerated = int256(3);

        result = GenerateOkResult({
            success: true,
            files: files,
            filesGenerated: filesGenerated
        });

        emit GenerateCompleted("ok", files, filesGenerated);
    }

    /// @notice preview - returns what would be generated without persisting
    /// @param name The theme name
    /// @param primaryColor The primary color value
    /// @param fontFamily The font family name
    /// @param baseSize The base font size
    /// @param mode The theme mode (e.g. "light", "dark")
    /// @return result The preview result with files that would be produced
    function preview(
        string memory name,
        string memory primaryColor,
        string memory fontFamily,
        int256 baseSize,
        string memory mode
    ) external view returns (PreviewOkResult memory result) {
        require(bytes(name).length > 0, "Theme name cannot be empty");
        require(bytes(primaryColor).length > 0, "Primary color cannot be empty");
        require(baseSize > 0, "Base size must be positive");

        bytes32 themeId = keccak256(abi.encodePacked(name));

        bytes[] memory files = new bytes[](3);

        files[0] = abi.encodePacked(
            "// Theme scaffold: ", name,
            "\n// Primary color: ", primaryColor,
            "\n// Mode: ", mode
        );

        files[1] = abi.encodePacked(
            "// Typography scaffold: ", name,
            "\n// Font family: ", fontFamily,
            "\n// Base size: ", _int2str(baseSize)
        );

        files[2] = abi.encodePacked(
            "// Mode variant scaffold: ", name,
            "\n// Mode: ", mode,
            "\n// Primary color: ", primaryColor
        );

        int256 wouldSkip = _themes[themeId] ? int256(1) : int256(0);
        int256 wouldWrite = int256(3) - wouldSkip;

        result = PreviewOkResult({
            success: true,
            files: files,
            wouldWrite: wouldWrite,
            wouldSkip: wouldSkip
        });
    }

    // --- Views ---

    /// @notice Check if a theme scaffold has been generated
    /// @param name The theme name to check
    /// @return Whether the scaffold exists
    function hasTheme(string memory name) external view returns (bool) {
        return _themes[keccak256(abi.encodePacked(name))];
    }

    /// @notice Get the number of generated theme scaffolds
    /// @return The count of generated scaffolds
    function themeCount() external view returns (uint256) {
        return _themesKeys.length;
    }

    // --- Internal ---

    /// @dev Convert an int256 to its string representation
    function _int2str(int256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        bool negative = value < 0;
        uint256 absValue = negative ? uint256(-value) : uint256(value);
        uint256 temp = absValue;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(negative ? digits + 1 : digits);
        if (negative) {
            buffer[0] = "-";
        }
        while (absValue != 0) {
            digits -= 1;
            buffer[negative ? digits + 1 : digits] = bytes1(uint8(48 + uint256(absValue % 10)));
            absValue /= 10;
        }
        return string(buffer);
    }
}
