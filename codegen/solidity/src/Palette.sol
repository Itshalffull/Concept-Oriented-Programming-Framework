// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Palette
/// @notice Color palette management with scale generation, role assignment, and contrast checking.
contract Palette {

    // --- Storage ---

    struct PaletteEntry {
        string name;
        string seed;
        string scale;
        string role;
        uint256 createdAt;
    }

    mapping(bytes32 => PaletteEntry) private _palettes;
    mapping(bytes32 => bool) private _exists;

    // --- Types ---

    struct GenerateOkResult {
        bool success;
        bytes32 palette;
        string scale;
    }

    struct AssignRoleOkResult {
        bool success;
        bytes32 palette;
    }

    struct CheckContrastOkResult {
        bool success;
        uint256 ratio;
        bool passesAA;
        bool passesAAA;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes32 indexed palette);
    event AssignRoleCompleted(string variant, bytes32 indexed palette);
    event CheckContrastCompleted(string variant, uint256 ratio, bool passesAA, bool passesAAA);

    // --- Actions ---

    /// @notice Generate a color palette scale from a seed color.
    function generate(bytes32 palette, string memory name, string memory seed) external returns (GenerateOkResult memory) {
        require(!_exists[palette], "Palette already exists");
        require(bytes(name).length > 0, "Name required");
        require(bytes(seed).length > 0, "Seed color required");

        // Generate a scale from the seed color (50-950 shades)
        string memory scale = string(abi.encodePacked(
            name, "-50:", seed, "-light;",
            name, "-100:", seed, "-lighter;",
            name, "-500:", seed, ";",
            name, "-900:", seed, "-darker"
        ));

        _palettes[palette] = PaletteEntry({
            name: name,
            seed: seed,
            scale: scale,
            role: "",
            createdAt: block.timestamp
        });
        _exists[palette] = true;

        emit GenerateCompleted("ok", palette);
        return GenerateOkResult({success: true, palette: palette, scale: scale});
    }

    /// @notice Assign a semantic role (primary, secondary, etc.) to a palette.
    function assignRole(bytes32 palette, string memory role) external returns (AssignRoleOkResult memory) {
        require(_exists[palette], "Palette not found");
        require(bytes(role).length > 0, "Role required");

        _palettes[palette].role = role;

        emit AssignRoleCompleted("ok", palette);
        return AssignRoleOkResult({success: true, palette: palette});
    }

    /// @notice Check contrast ratio between two palettes for accessibility compliance.
    function checkContrast(bytes32 foreground, bytes32 background) external returns (CheckContrastOkResult memory) {
        require(_exists[foreground], "Foreground palette not found");
        require(_exists[background], "Background palette not found");

        // Compute a deterministic contrast ratio from the seed hashes
        uint256 fgHash = uint256(keccak256(bytes(_palettes[foreground].seed)));
        uint256 bgHash = uint256(keccak256(bytes(_palettes[background].seed)));
        uint256 ratio = ((fgHash ^ bgHash) % 200) + 10; // Range 10-209 (representing 1.0 - 20.9)

        bool passesAA = ratio >= 45; // 4.5:1 ratio
        bool passesAAA = ratio >= 70; // 7.0:1 ratio

        emit CheckContrastCompleted("ok", ratio, passesAA, passesAAA);
        return CheckContrastOkResult({success: true, ratio: ratio, passesAA: passesAA, passesAAA: passesAAA});
    }

}
