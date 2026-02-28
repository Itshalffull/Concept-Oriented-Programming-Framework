// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Viewport
/// @notice Viewport management for tracking dimensions, breakpoints, and orientation.
contract Viewport {

    // --- Storage ---

    struct ViewportEntry {
        int256 width;
        int256 height;
        string breakpoint;
        string orientation;
        string breakpoints;
        bool observed;
        uint256 createdAt;
    }

    mapping(bytes32 => ViewportEntry) private _viewports;
    mapping(bytes32 => bool) private _exists;

    // --- Types ---

    struct ObserveOkResult {
        bool success;
        bytes32 viewport;
        string breakpoint;
        string orientation;
    }

    struct SetBreakpointsOkResult {
        bool success;
        bytes32 viewport;
    }

    struct GetBreakpointOkResult {
        bool success;
        bytes32 viewport;
        string breakpoint;
        int256 width;
        int256 height;
    }

    // --- Events ---

    event ObserveCompleted(string variant, bytes32 indexed viewport);
    event SetBreakpointsCompleted(string variant, bytes32 indexed viewport);
    event GetBreakpointCompleted(string variant, bytes32 indexed viewport, int256 width, int256 height);

    // --- Actions ---

    /// @notice Observe viewport dimensions and derive breakpoint and orientation.
    function observe(bytes32 viewport, int256 width, int256 height) external returns (ObserveOkResult memory) {
        require(width > 0 && height > 0, "Dimensions must be positive");

        // Derive breakpoint from width
        string memory breakpoint;
        if (width < 640) {
            breakpoint = "xs";
        } else if (width < 768) {
            breakpoint = "sm";
        } else if (width < 1024) {
            breakpoint = "md";
        } else if (width < 1280) {
            breakpoint = "lg";
        } else {
            breakpoint = "xl";
        }

        // Derive orientation
        string memory orientation = width >= height ? "landscape" : "portrait";

        _viewports[viewport] = ViewportEntry({
            width: width,
            height: height,
            breakpoint: breakpoint,
            orientation: orientation,
            breakpoints: _exists[viewport] ? _viewports[viewport].breakpoints : "",
            observed: true,
            createdAt: _exists[viewport] ? _viewports[viewport].createdAt : block.timestamp
        });
        _exists[viewport] = true;

        emit ObserveCompleted("ok", viewport);
        return ObserveOkResult({success: true, viewport: viewport, breakpoint: breakpoint, orientation: orientation});
    }

    /// @notice Set custom breakpoint definitions for a viewport.
    function setBreakpoints(bytes32 viewport, string memory breakpoints) external returns (SetBreakpointsOkResult memory) {
        require(bytes(breakpoints).length > 0, "Breakpoints required");

        if (!_exists[viewport]) {
            _viewports[viewport] = ViewportEntry({
                width: 0,
                height: 0,
                breakpoint: "",
                orientation: "",
                breakpoints: breakpoints,
                observed: false,
                createdAt: block.timestamp
            });
            _exists[viewport] = true;
        } else {
            _viewports[viewport].breakpoints = breakpoints;
        }

        emit SetBreakpointsCompleted("ok", viewport);
        return SetBreakpointsOkResult({success: true, viewport: viewport});
    }

    /// @notice Get the current breakpoint and dimensions for a viewport.
    function getBreakpoint(bytes32 viewport) external returns (GetBreakpointOkResult memory) {
        require(_exists[viewport], "Viewport not found");
        require(_viewports[viewport].observed, "Viewport not yet observed");

        ViewportEntry storage entry = _viewports[viewport];

        emit GetBreakpointCompleted("ok", viewport, entry.width, entry.height);
        return GetBreakpointOkResult({
            success: true,
            viewport: viewport,
            breakpoint: entry.breakpoint,
            width: entry.width,
            height: entry.height
        });
    }

}
