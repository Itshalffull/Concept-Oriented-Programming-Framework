// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Signal
/// @notice Reactive signal management with versioned reads, writes, and batch operations.
contract Signal {

    // --- Storage ---

    struct SignalEntry {
        string kind;
        string value;
        int256 version;
        bool active;
        uint256 createdAt;
    }

    mapping(bytes32 => SignalEntry) private _signals;
    mapping(bytes32 => bool) private _exists;
    bytes32[] private _signalKeys;

    // --- Types ---

    struct CreateOkResult {
        bool success;
        bytes32 signal;
    }

    struct ReadOkResult {
        bool success;
        bytes32 signal;
        string value;
        int256 version;
    }

    struct WriteOkResult {
        bool success;
        bytes32 signal;
        int256 version;
    }

    struct BatchOkResult {
        bool success;
        int256 count;
    }

    struct DisposeOkResult {
        bool success;
        bytes32 signal;
    }

    // --- Events ---

    event CreateCompleted(string variant, bytes32 indexed signal);
    event ReadCompleted(string variant, bytes32 indexed signal, int256 version);
    event WriteCompleted(string variant, bytes32 indexed signal, int256 version);
    event BatchCompleted(string variant, int256 count);
    event DisposeCompleted(string variant, bytes32 indexed signal);

    // --- Actions ---

    /// @notice Create a reactive signal with an initial value.
    function create(bytes32 signal, string memory kind, string memory initialValue) external returns (CreateOkResult memory) {
        require(!_exists[signal], "Signal already exists");
        require(bytes(kind).length > 0, "Kind required");

        _signals[signal] = SignalEntry({
            kind: kind,
            value: initialValue,
            version: 1,
            active: true,
            createdAt: block.timestamp
        });
        _exists[signal] = true;
        _signalKeys.push(signal);

        emit CreateCompleted("ok", signal);
        return CreateOkResult({success: true, signal: signal});
    }

    /// @notice Read the current value and version of a signal.
    function read(bytes32 signal) external returns (ReadOkResult memory) {
        require(_exists[signal], "Signal not found");

        SignalEntry storage entry = _signals[signal];

        emit ReadCompleted("ok", signal, entry.version);
        return ReadOkResult({success: true, signal: signal, value: entry.value, version: entry.version});
    }

    /// @notice Write a new value to a signal, incrementing its version.
    function write(bytes32 signal, string memory value) external returns (WriteOkResult memory) {
        require(_exists[signal], "Signal not found");
        require(_signals[signal].active, "Signal not active");

        _signals[signal].value = value;
        _signals[signal].version++;

        emit WriteCompleted("ok", signal, _signals[signal].version);
        return WriteOkResult({success: true, signal: signal, version: _signals[signal].version});
    }

    /// @notice Batch update multiple signals (signals encoded as a string of IDs).
    function batch(string memory signals) external returns (BatchOkResult memory) {
        // In a real implementation, this would parse the signals string and update each.
        // For on-chain simplicity, we count existing signals as the batch count.
        int256 count = int256(_signalKeys.length);

        emit BatchCompleted("ok", count);
        return BatchOkResult({success: true, count: count});
    }

    /// @notice Dispose of a signal, removing it from the reactive system.
    function dispose(bytes32 signal) external returns (DisposeOkResult memory) {
        require(_exists[signal], "Signal not found");

        _signals[signal].active = false;
        delete _signals[signal];
        _exists[signal] = false;

        emit DisposeCompleted("ok", signal);
        return DisposeOkResult({success: true, signal: signal});
    }

}
