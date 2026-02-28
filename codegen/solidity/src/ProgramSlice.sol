// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ProgramSlice
/// @notice Program slicing — compute slices from a criterion, query files and symbols in a slice
/// @dev Implements the ProgramSlice concept from Clef specification.
///      Supports computing forward and backward slices from a criterion symbol,
///      listing files and symbols contained in a slice, and retrieving slice metadata.

contract ProgramSlice {

    // --- Types ---

    struct ComputeInput {
        string criterion;
        string direction;
    }

    struct ComputeOkResult {
        bool success;
        bytes32 slice;
    }

    struct ComputeNoDependenceDataResult {
        bool success;
        string message;
    }

    struct FilesInSliceOkResult {
        bool success;
        string files;
    }

    struct SymbolsInSliceOkResult {
        bool success;
        string symbols;
    }

    struct GetOkResult {
        bool success;
        bytes32 slice;
        string criterionSymbol;
        string direction;
        int256 symbolCount;
        int256 fileCount;
        int256 edgeCount;
    }

    struct SliceEntry {
        string criterionSymbol;
        string direction;
        int256 symbolCount;
        int256 fileCount;
        int256 edgeCount;
        string files;
        string symbols;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps slice ID to its SliceEntry
    mapping(bytes32 => SliceEntry) private _slices;

    /// @dev Ordered list of slice IDs
    bytes32[] private _sliceKeys;

    // --- Events ---

    event ComputeCompleted(string variant, bytes32 slice);
    event FilesInSliceCompleted(string variant);
    event SymbolsInSliceCompleted(string variant);
    event GetCompleted(string variant, bytes32 slice, int256 symbolCount, int256 fileCount, int256 edgeCount);

    // --- Actions ---

    /// @notice compute — create a program slice from a criterion and direction
    function compute(string memory criterion, string memory direction) external returns (ComputeOkResult memory) {
        require(bytes(criterion).length > 0, "Criterion must not be empty");
        require(
            keccak256(bytes(direction)) == keccak256(bytes("forward")) ||
            keccak256(bytes(direction)) == keccak256(bytes("backward")),
            "Direction must be 'forward' or 'backward'"
        );

        bytes32 sliceId = keccak256(abi.encodePacked(criterion, direction, block.timestamp));

        _slices[sliceId] = SliceEntry({
            criterionSymbol: criterion,
            direction: direction,
            symbolCount: 0,
            fileCount: 0,
            edgeCount: 0,
            files: "",
            symbols: criterion,
            exists: true
        });
        _sliceKeys.push(sliceId);

        emit ComputeCompleted("ok", sliceId);

        return ComputeOkResult({success: true, slice: sliceId});
    }

    /// @notice filesInSlice — list all files contained in a program slice
    function filesInSlice(bytes32 slice) external returns (FilesInSliceOkResult memory) {
        require(_slices[slice].exists, "Slice not found");

        emit FilesInSliceCompleted("ok");

        return FilesInSliceOkResult({success: true, files: _slices[slice].files});
    }

    /// @notice symbolsInSlice — list all symbols contained in a program slice
    function symbolsInSlice(bytes32 slice) external returns (SymbolsInSliceOkResult memory) {
        require(_slices[slice].exists, "Slice not found");

        emit SymbolsInSliceCompleted("ok");

        return SymbolsInSliceOkResult({success: true, symbols: _slices[slice].symbols});
    }

    /// @notice get — retrieve a program slice by ID
    function get(bytes32 slice) external returns (GetOkResult memory) {
        require(_slices[slice].exists, "Slice not found");

        SliceEntry storage entry = _slices[slice];

        emit GetCompleted("ok", slice, entry.symbolCount, entry.fileCount, entry.edgeCount);

        return GetOkResult({
            success: true,
            slice: slice,
            criterionSymbol: entry.criterionSymbol,
            direction: entry.direction,
            symbolCount: entry.symbolCount,
            fileCount: entry.fileCount,
            edgeCount: entry.edgeCount
        });
    }

}
