// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Slot
/// @notice Content slot management for defining named insertion points and filling them with content.
contract Slot {

    // --- Storage ---

    struct SlotEntry {
        string name;
        string host;
        string position;
        string fallbackContent;
        string content;
        bool filled;
        uint256 createdAt;
    }

    mapping(bytes32 => SlotEntry) private _slots;
    mapping(bytes32 => bool) private _exists;

    // --- Types ---

    struct DefineOkResult {
        bool success;
        bytes32 slot;
    }

    struct FillOkResult {
        bool success;
        bytes32 slot;
    }

    struct ClearOkResult {
        bool success;
        bytes32 slot;
    }

    // --- Events ---

    event DefineCompleted(string variant, bytes32 indexed slot);
    event FillCompleted(string variant, bytes32 indexed slot);
    event ClearCompleted(string variant, bytes32 indexed slot);

    // --- Actions ---

    /// @notice Define a named content slot with position and optional fallback.
    function defineSlot(bytes32 slot, string memory name, string memory host, string memory position, string memory fallbackContent) external returns (DefineOkResult memory) {
        require(!_exists[slot], "Slot already defined");
        require(bytes(name).length > 0, "Name required");

        _slots[slot] = SlotEntry({
            name: name,
            host: host,
            position: position,
            fallbackContent: fallbackContent,
            content: "",
            filled: false,
            createdAt: block.timestamp
        });
        _exists[slot] = true;

        emit DefineCompleted("ok", slot);
        return DefineOkResult({success: true, slot: slot});
    }

    /// @notice Fill a defined slot with content.
    function fill(bytes32 slot, string memory content) external returns (FillOkResult memory) {
        require(_exists[slot], "Slot not found");

        _slots[slot].content = content;
        _slots[slot].filled = true;

        emit FillCompleted("ok", slot);
        return FillOkResult({success: true, slot: slot});
    }

    /// @notice Clear the content from a slot, reverting to fallback.
    function clear(bytes32 slot) external returns (ClearOkResult memory) {
        require(_exists[slot], "Slot not found");

        _slots[slot].content = "";
        _slots[slot].filled = false;

        emit ClearCompleted("ok", slot);
        return ClearOkResult({success: true, slot: slot});
    }

}
