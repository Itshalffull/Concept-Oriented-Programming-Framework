// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Shell
/// @notice Application shell/frame management with zone assignment and overlay stack.
contract Shell {

    // --- Storage ---

    struct ShellEntry {
        string zones;
        bool initialized;
        uint256 createdAt;
    }

    mapping(bytes32 => ShellEntry) private _shells;
    mapping(bytes32 => bool) private _exists;
    mapping(bytes32 => mapping(bytes32 => string)) private _zoneAssignments;
    mapping(bytes32 => mapping(bytes32 => bool)) private _zoneAssigned;
    mapping(bytes32 => string[]) private _overlayStack;

    // --- Types ---

    struct InitializeOkResult {
        bool success;
        bytes32 shell;
    }

    struct AssignToZoneOkResult {
        bool success;
        bytes32 shell;
    }

    struct ClearZoneOkResult {
        bool success;
        bytes32 shell;
        string previous;
    }

    struct PushOverlayOkResult {
        bool success;
        bytes32 shell;
    }

    struct PopOverlayOkResult {
        bool success;
        bytes32 shell;
        string overlay;
    }

    // --- Events ---

    event InitializeCompleted(string variant, bytes32 indexed shell);
    event AssignToZoneCompleted(string variant, bytes32 indexed shell);
    event ClearZoneCompleted(string variant, bytes32 indexed shell, string previous);
    event PushOverlayCompleted(string variant, bytes32 indexed shell);
    event PopOverlayCompleted(string variant, bytes32 indexed shell);

    // --- Actions ---

    /// @notice Initialize a shell with zone definitions.
    function initialize(bytes32 shell, string memory zones) external returns (InitializeOkResult memory) {
        require(!_exists[shell], "Shell already initialized");
        require(bytes(zones).length > 0, "Zones required");

        _shells[shell] = ShellEntry({
            zones: zones,
            initialized: true,
            createdAt: block.timestamp
        });
        _exists[shell] = true;

        emit InitializeCompleted("ok", shell);
        return InitializeOkResult({success: true, shell: shell});
    }

    /// @notice Assign a reference to a named zone in the shell.
    function assignToZone(bytes32 shell, string memory zone, string memory ref) external returns (AssignToZoneOkResult memory) {
        require(_exists[shell], "Shell not found");
        require(_shells[shell].initialized, "Shell not initialized");
        require(bytes(zone).length > 0, "Zone name required");

        bytes32 zoneKey = keccak256(abi.encodePacked(zone));
        _zoneAssignments[shell][zoneKey] = ref;
        _zoneAssigned[shell][zoneKey] = true;

        emit AssignToZoneCompleted("ok", shell);
        return AssignToZoneOkResult({success: true, shell: shell});
    }

    /// @notice Clear a zone assignment, returning the previous value.
    function clearZone(bytes32 shell, string memory zone) external returns (ClearZoneOkResult memory) {
        require(_exists[shell], "Shell not found");

        bytes32 zoneKey = keccak256(abi.encodePacked(zone));
        require(_zoneAssigned[shell][zoneKey], "Zone not assigned");

        string memory previous = _zoneAssignments[shell][zoneKey];
        delete _zoneAssignments[shell][zoneKey];
        _zoneAssigned[shell][zoneKey] = false;

        emit ClearZoneCompleted("ok", shell, previous);
        return ClearZoneOkResult({success: true, shell: shell, previous: previous});
    }

    /// @notice Push an overlay onto the shell overlay stack.
    function pushOverlay(bytes32 shell, string memory ref) external returns (PushOverlayOkResult memory) {
        require(_exists[shell], "Shell not found");
        require(bytes(ref).length > 0, "Overlay ref required");

        _overlayStack[shell].push(ref);

        emit PushOverlayCompleted("ok", shell);
        return PushOverlayOkResult({success: true, shell: shell});
    }

    /// @notice Pop the top overlay from the shell overlay stack.
    function popOverlay(bytes32 shell) external returns (PopOverlayOkResult memory) {
        require(_exists[shell], "Shell not found");
        require(_overlayStack[shell].length > 0, "No overlays to pop");

        uint256 lastIndex = _overlayStack[shell].length - 1;
        string memory overlay = _overlayStack[shell][lastIndex];
        _overlayStack[shell].pop();

        emit PopOverlayCompleted("ok", shell);
        return PopOverlayOkResult({success: true, shell: shell, overlay: overlay});
    }

}
