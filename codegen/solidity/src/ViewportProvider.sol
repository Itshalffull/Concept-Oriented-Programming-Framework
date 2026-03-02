// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ViewportProvider
/// @notice Viewport surface provider
/// @dev Implements the ViewportProvider concept from Clef specification.
///      Provides viewport observation and breakpoint management for surface generation.

contract ViewportProvider {

    // --- Types ---

    struct InitializeOkResult {
        bool success;
        bytes32 instance;
    }

    struct InitializeConfigErrorResult {
        bool success;
        string message;
    }

    struct ObserveOkResult {
        bool success;
        bytes32 instance;
        uint256 width;
        uint256 height;
    }

    struct ObserveUnavailableErrorResult {
        bool success;
        string message;
    }

    struct GetBreakpointOkResult {
        bool success;
        bytes32 instance;
        string breakpoint;
    }

    struct GetBreakpointNotFoundErrorResult {
        bool success;
        string message;
    }

    struct SetBreakpointsOkResult {
        bool success;
        bytes32 instance;
        uint256 count;
    }

    struct SetBreakpointsValidationErrorResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Maps instance ID to existence
    mapping(bytes32 => bool) private _instances;

    /// @dev Ordered list of instance IDs
    bytes32[] private _instanceKeys;

    /// @dev Maps instance ID to viewport width
    mapping(bytes32 => uint256) private _viewportWidth;

    /// @dev Maps instance ID to viewport height
    mapping(bytes32 => uint256) private _viewportHeight;

    /// @dev Maps instance ID to breakpoint threshold count
    mapping(bytes32 => uint256) private _breakpointCount;

    // --- Events ---

    event InitializeCompleted(string variant, bytes32 instance);
    event ObserveCompleted(string variant, bytes32 instance);
    event GetBreakpointCompleted(string variant, bytes32 instance);
    event SetBreakpointsCompleted(string variant, bytes32 instance);

    // --- Metadata ---

    /// @notice Returns static provider metadata
    /// @return name The provider name
    /// @return category The provider category
    function register() external pure returns (string memory name, string memory category) {
        return ("viewport", "surface-provider");
    }

    // --- Actions ---

    /// @notice initialize — create a new viewport provider instance
    function initialize() external returns (InitializeOkResult memory) {
        bytes32 instance = keccak256(abi.encodePacked("viewport", "surface-provider", block.timestamp, _instanceKeys.length));

        _instances[instance] = true;
        _instanceKeys.push(instance);

        emit InitializeCompleted("ok", instance);

        return InitializeOkResult({success: true, instance: instance});
    }

    /// @notice observe — record current viewport dimensions
    function observe(bytes32 instance, uint256 width, uint256 height) external returns (ObserveOkResult memory) {
        require(_instances[instance], "Instance not found");

        _viewportWidth[instance] = width;
        _viewportHeight[instance] = height;

        emit ObserveCompleted("ok", instance);

        return ObserveOkResult({success: true, instance: instance, width: width, height: height});
    }

    /// @notice getBreakpoint — get the active breakpoint name for current dimensions
    function getBreakpoint(bytes32 instance) external returns (GetBreakpointOkResult memory) {
        require(_instances[instance], "Instance not found");

        uint256 width = _viewportWidth[instance];
        string memory breakpoint;

        if (width < 640) {
            breakpoint = "sm";
        } else if (width < 1024) {
            breakpoint = "md";
        } else {
            breakpoint = "lg";
        }

        emit GetBreakpointCompleted("ok", instance);

        return GetBreakpointOkResult({success: true, instance: instance, breakpoint: breakpoint});
    }

    /// @notice setBreakpoints — configure breakpoint thresholds
    function setBreakpoints(bytes32 instance, uint256 count) external returns (SetBreakpointsOkResult memory) {
        require(_instances[instance], "Instance not found");

        _breakpointCount[instance] = count;

        emit SetBreakpointsCompleted("ok", instance);

        return SetBreakpointsOkResult({success: true, instance: instance, count: count});
    }

}
