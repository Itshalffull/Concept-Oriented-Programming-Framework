// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PlatformAdapter
/// @notice Base platform adapter — registers platform configuration and maps
///         navigation transitions, layout zones, and platform events to
///         platform-specific actions.
/// @dev Skeleton contract — implement action bodies

contract PlatformAdapter {

    // --- Storage (from concept state) ---

    /// @dev Adapter registration: adapter id => encoded (platform, config)
    mapping(bytes32 => bytes) private adapterConfigs;

    /// @dev Track which adapters have been registered
    mapping(bytes32 => bool) private registered;

    // --- Types ---

    struct RegisterInput {
        bytes32 adapter;
        string platform;
        string config;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 adapter;
    }

    struct RegisterDuplicateResult {
        bool success;
        string message;
    }

    struct MapNavigationInput {
        bytes32 adapter;
        string transition;
    }

    struct MapNavigationOkResult {
        bool success;
        bytes32 adapter;
        string platformAction;
    }

    struct MapNavigationUnsupportedResult {
        bool success;
        string message;
    }

    struct MapZoneInput {
        bytes32 adapter;
        string role;
    }

    struct MapZoneOkResult {
        bool success;
        bytes32 adapter;
        string platformConfig;
    }

    struct MapZoneUnmappedResult {
        bool success;
        string message;
    }

    struct HandlePlatformEventInput {
        bytes32 adapter;
        string eventData;
    }

    struct HandlePlatformEventOkResult {
        bool success;
        bytes32 adapter;
        string action;
    }

    struct HandlePlatformEventIgnoredResult {
        bool success;
        string message;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 adapter);
    event MapNavigationCompleted(string variant, bytes32 adapter);
    event MapZoneCompleted(string variant, bytes32 adapter);
    event HandlePlatformEventCompleted(string variant, bytes32 adapter);

    // --- Actions ---

    /// @notice Register a platform adapter with its platform type and configuration.
    function register(bytes32 adapter, string memory platform, string memory config) external returns (RegisterOkResult memory) {
        require(!registered[adapter], "Adapter already registered");

        adapterConfigs[adapter] = abi.encode(platform, config);
        registered[adapter] = true;

        emit RegisterCompleted("ok", adapter);

        return RegisterOkResult({
            success: true,
            adapter: adapter
        });
    }

    /// @notice Map a navigation transition to a platform-specific navigation action.
    function mapNavigation(bytes32 adapter, string memory transition) external returns (MapNavigationOkResult memory) {
        require(registered[adapter], "Adapter not registered");
        require(bytes(transition).length > 0, "Transition must not be empty");

        // Derive a platform action by hashing the adapter config with the transition
        (string memory platform, ) = abi.decode(adapterConfigs[adapter], (string, string));
        string memory platformAction = string(abi.encodePacked(platform, ":", transition));

        emit MapNavigationCompleted("ok", adapter);

        return MapNavigationOkResult({
            success: true,
            adapter: adapter,
            platformAction: platformAction
        });
    }

    /// @notice Map a layout zone role to platform-specific configuration.
    function mapZone(bytes32 adapter, string memory role) external returns (MapZoneOkResult memory) {
        require(registered[adapter], "Adapter not registered");
        require(bytes(role).length > 0, "Role must not be empty");

        (string memory platform, string memory config) = abi.decode(adapterConfigs[adapter], (string, string));
        string memory platformConfig = string(abi.encodePacked(platform, ":zone:", role, ":", config));

        emit MapZoneCompleted("ok", adapter);

        return MapZoneOkResult({
            success: true,
            adapter: adapter,
            platformConfig: platformConfig
        });
    }

    /// @notice Handle an incoming platform event and return the corresponding action.
    function handlePlatformEvent(bytes32 adapter, string memory event_) external returns (HandlePlatformEventOkResult memory) {
        require(registered[adapter], "Adapter not registered");
        require(bytes(event_).length > 0, "Event must not be empty");

        (string memory platform, ) = abi.decode(adapterConfigs[adapter], (string, string));
        string memory action = string(abi.encodePacked(platform, ":handle:", event_));

        emit HandlePlatformEventCompleted("ok", adapter);

        return HandlePlatformEventOkResult({
            success: true,
            adapter: adapter,
            action: action
        });
    }

}
