// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DailyNote
/// @notice Maps date hashes to page IDs for daily note tracking.
contract DailyNote {
    mapping(bytes32 => bytes32) private _dateToPage; // dateHash -> pageId
    mapping(bytes32 => bool) private _exists;
    bytes32[] private _allDates;

    event NoteCreated(bytes32 indexed dateHash, bytes32 indexed pageId);

    /// @notice Creates a daily note linking a date hash to a page.
    /// @param dateHash A hash representing the date.
    /// @param pageId The page ID to associate with the date.
    function createNote(bytes32 dateHash, bytes32 pageId) external {
        require(!_exists[dateHash], "Note already exists for this date");
        require(pageId != bytes32(0), "Invalid page ID");

        _dateToPage[dateHash] = pageId;
        _exists[dateHash] = true;
        _allDates.push(dateHash);

        emit NoteCreated(dateHash, pageId);
    }

    /// @notice Retrieves the page associated with a date.
    /// @param dateHash The date hash to look up.
    /// @return found Whether a note exists for the date.
    /// @return pageId The associated page ID (zero if not found).
    function getNote(bytes32 dateHash) external view returns (bool found, bytes32 pageId) {
        if (_exists[dateHash]) {
            return (true, _dateToPage[dateHash]);
        }
        return (false, bytes32(0));
    }

    /// @notice Returns the total number of daily notes created.
    /// @return The count of daily notes.
    function noteCount() external view returns (uint256) {
        return _allDates.length;
    }
}
