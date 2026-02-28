// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Motion
/// @notice Motion/animation management for durations, easings, and transition presets.
contract Motion {

    // --- Storage ---

    struct DurationEntry {
        string name;
        int256 ms;
        uint256 createdAt;
    }

    struct EasingEntry {
        string name;
        string value;
        uint256 createdAt;
    }

    struct TransitionEntry {
        string name;
        string config;
        uint256 createdAt;
    }

    mapping(bytes32 => DurationEntry) private _durations;
    mapping(bytes32 => bool) private _durationExists;

    mapping(bytes32 => EasingEntry) private _easings;
    mapping(bytes32 => bool) private _easingExists;

    mapping(bytes32 => TransitionEntry) private _transitions;
    mapping(bytes32 => bool) private _transitionExists;

    // --- Types ---

    struct DefineDurationOkResult {
        bool success;
        bytes32 motion;
    }

    struct DefineEasingOkResult {
        bool success;
        bytes32 motion;
    }

    struct DefineTransitionOkResult {
        bool success;
        bytes32 motion;
    }

    // --- Events ---

    event DefineDurationCompleted(string variant, bytes32 indexed motion);
    event DefineEasingCompleted(string variant, bytes32 indexed motion);
    event DefineTransitionCompleted(string variant, bytes32 indexed motion);

    // --- Actions ---

    /// @notice Define a named duration preset in milliseconds.
    function defineDuration(bytes32 motion, string memory name, int256 ms) external returns (DefineDurationOkResult memory) {
        require(!_durationExists[motion], "Duration already defined");
        require(bytes(name).length > 0, "Name required");
        require(ms >= 0, "Duration must be non-negative");

        _durations[motion] = DurationEntry({
            name: name,
            ms: ms,
            createdAt: block.timestamp
        });
        _durationExists[motion] = true;

        emit DefineDurationCompleted("ok", motion);
        return DefineDurationOkResult({success: true, motion: motion});
    }

    /// @notice Define a named easing function.
    function defineEasing(bytes32 motion, string memory name, string memory value) external returns (DefineEasingOkResult memory) {
        require(!_easingExists[motion], "Easing already defined");
        require(bytes(name).length > 0, "Name required");
        require(bytes(value).length > 0, "Value required");

        _easings[motion] = EasingEntry({
            name: name,
            value: value,
            createdAt: block.timestamp
        });
        _easingExists[motion] = true;

        emit DefineEasingCompleted("ok", motion);
        return DefineEasingOkResult({success: true, motion: motion});
    }

    /// @notice Define a named transition preset combining duration, easing, and property.
    function defineTransition(bytes32 motion, string memory name, string memory config) external returns (DefineTransitionOkResult memory) {
        require(!_transitionExists[motion], "Transition already defined");
        require(bytes(name).length > 0, "Name required");
        require(bytes(config).length > 0, "Config required");

        _transitions[motion] = TransitionEntry({
            name: name,
            config: config,
            createdAt: block.timestamp
        });
        _transitionExists[motion] = true;

        emit DefineTransitionCompleted("ok", motion);
        return DefineTransitionOkResult({success: true, motion: motion});
    }

}
