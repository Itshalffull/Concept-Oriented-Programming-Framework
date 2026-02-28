// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Host
/// @notice Application host management for mounting concepts into zones with lifecycle control.
contract Host {

    // --- Storage ---

    struct HostEntry {
        string concept;
        string viewName;
        int256 level;
        string zone;
        bool mounted;
        bool ready;
        string errorInfo;
        uint256 createdAt;
    }

    struct ResourceEntry {
        string kind;
        string resourceRef;
        uint256 trackedAt;
    }

    mapping(bytes32 => HostEntry) private _hosts;
    mapping(bytes32 => bool) private _exists;
    mapping(bytes32 => ResourceEntry[]) private _resources;

    // --- Types ---

    struct MountOkResult {
        bool success;
        bytes32 host;
    }

    struct ReadyOkResult {
        bool success;
        bytes32 host;
    }

    struct TrackResourceOkResult {
        bool success;
        bytes32 host;
    }

    struct UnmountOkResult {
        bool success;
        bytes32 host;
    }

    struct RefreshOkResult {
        bool success;
        bytes32 host;
    }

    struct SetErrorOkResult {
        bool success;
        bytes32 host;
    }

    // --- Events ---

    event MountCompleted(string variant, bytes32 indexed host);
    event ReadyCompleted(string variant, bytes32 indexed host);
    event TrackResourceCompleted(string variant, bytes32 indexed host);
    event UnmountCompleted(string variant, bytes32 indexed host);
    event RefreshCompleted(string variant, bytes32 indexed host);
    event SetErrorCompleted(string variant, bytes32 indexed host);

    // --- Actions ---

    /// @notice Mount a concept view into a host at a given zone and level.
    function mount(bytes32 host, string memory concept, string memory viewName, int256 level, string memory zone) external returns (MountOkResult memory) {
        require(!_exists[host], "Host already mounted");
        require(bytes(concept).length > 0, "Concept required");

        _hosts[host] = HostEntry({
            concept: concept,
            viewName: viewName,
            level: level,
            zone: zone,
            mounted: true,
            ready: false,
            errorInfo: "",
            createdAt: block.timestamp
        });
        _exists[host] = true;

        emit MountCompleted("ok", host);
        return MountOkResult({success: true, host: host});
    }

    /// @notice Mark a mounted host as ready.
    function ready(bytes32 host) external returns (ReadyOkResult memory) {
        require(_exists[host], "Host not found");
        require(_hosts[host].mounted, "Host not mounted");

        _hosts[host].ready = true;

        emit ReadyCompleted("ok", host);
        return ReadyOkResult({success: true, host: host});
    }

    /// @notice Track a resource associated with a host.
    function trackResource(bytes32 host, string memory kind, string memory ref) external returns (TrackResourceOkResult memory) {
        require(_exists[host], "Host not found");
        require(_hosts[host].mounted, "Host not mounted");

        _resources[host].push(ResourceEntry({
            kind: kind,
            resourceRef: ref,
            trackedAt: block.timestamp
        }));

        emit TrackResourceCompleted("ok", host);
        return TrackResourceOkResult({success: true, host: host});
    }

    /// @notice Unmount a host, tearing down its resources.
    function unmount(bytes32 host) external returns (UnmountOkResult memory) {
        require(_exists[host], "Host not found");
        require(_hosts[host].mounted, "Host not mounted");

        _hosts[host].mounted = false;
        _hosts[host].ready = false;
        delete _resources[host];

        emit UnmountCompleted("ok", host);
        return UnmountOkResult({success: true, host: host});
    }

    /// @notice Refresh a mounted host.
    function refresh(bytes32 host) external returns (RefreshOkResult memory) {
        require(_exists[host], "Host not found");
        require(_hosts[host].mounted, "Host not mounted");

        _hosts[host].errorInfo = "";

        emit RefreshCompleted("ok", host);
        return RefreshOkResult({success: true, host: host});
    }

    /// @notice Set an error state on a host.
    function setError(bytes32 host, string memory errorInfo) external returns (SetErrorOkResult memory) {
        require(_exists[host], "Host not found");

        _hosts[host].errorInfo = errorInfo;

        emit SetErrorCompleted("ok", host);
        return SetErrorOkResult({success: true, host: host});
    }

}
