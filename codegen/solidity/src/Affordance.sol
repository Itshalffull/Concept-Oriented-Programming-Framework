// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Affordance
/// @notice UI affordance management linking widgets to interactor types with specificity-based matching.
contract Affordance {

    // --- Storage ---

    struct AffordanceEntry {
        string widget;
        string interactor;
        int256 specificity;
        string conditions;
        uint256 createdAt;
    }

    mapping(bytes32 => AffordanceEntry) private _affordances;
    mapping(bytes32 => bool) private _exists;
    bytes32[] private _affordanceKeys;

    // --- Types ---

    struct DeclareOkResult {
        bool success;
        bytes32 affordance;
    }

    struct MatchOkResult {
        bool success;
        string matches;
    }

    struct ExplainOkResult {
        bool success;
        bytes32 affordance;
        string reason;
    }

    struct RemoveOkResult {
        bool success;
        bytes32 affordance;
    }

    // --- Events ---

    event DeclareCompleted(string variant, bytes32 indexed affordance);
    event MatchCompleted(string variant);
    event ExplainCompleted(string variant, bytes32 indexed affordance);
    event RemoveCompleted(string variant, bytes32 indexed affordance);

    // --- Actions ---

    /// @notice Declare an affordance linking a widget to an interactor type.
    function declare(bytes32 affordance, string memory widget, string memory interactor, int256 specificity, string memory conditions) external returns (DeclareOkResult memory) {
        require(!_exists[affordance], "Affordance already declared");
        require(bytes(widget).length > 0, "Widget required");
        require(bytes(interactor).length > 0, "Interactor required");

        _affordances[affordance] = AffordanceEntry({
            widget: widget,
            interactor: interactor,
            specificity: specificity,
            conditions: conditions,
            createdAt: block.timestamp
        });
        _exists[affordance] = true;
        _affordanceKeys.push(affordance);

        emit DeclareCompleted("ok", affordance);
        return DeclareOkResult({success: true, affordance: affordance});
    }

    /// @notice Match affordances for a given interactor type and context.
    function matchAffordance(bytes32 affordance, string memory interactor, string memory context) external returns (MatchOkResult memory) {
        // Search through all declared affordances for matching interactor type
        string memory matches = "";
        bool found = false;

        for (uint256 i = 0; i < _affordanceKeys.length; i++) {
            bytes32 key = _affordanceKeys[i];
            if (_exists[key] && keccak256(bytes(_affordances[key].interactor)) == keccak256(bytes(interactor))) {
                if (found) {
                    matches = string(abi.encodePacked(matches, ",", _affordances[key].widget));
                } else {
                    matches = _affordances[key].widget;
                    found = true;
                }
            }
        }

        require(found, "No matching affordances");

        emit MatchCompleted("ok");
        return MatchOkResult({success: true, matches: matches});
    }

    /// @notice Explain the reasoning behind an affordance declaration.
    function explain(bytes32 affordance) external returns (ExplainOkResult memory) {
        require(_exists[affordance], "Affordance not found");

        AffordanceEntry storage entry = _affordances[affordance];
        string memory reason = string(abi.encodePacked(
            "Widget '", entry.widget, "' handles interactor '", entry.interactor,
            "' with specificity ", _intToString(entry.specificity)
        ));

        emit ExplainCompleted("ok", affordance);
        return ExplainOkResult({success: true, affordance: affordance, reason: reason});
    }

    /// @notice Remove an affordance declaration.
    function remove(bytes32 affordance) external returns (RemoveOkResult memory) {
        require(_exists[affordance], "Affordance not found");

        delete _affordances[affordance];
        _exists[affordance] = false;

        emit RemoveCompleted("ok", affordance);
        return RemoveOkResult({success: true, affordance: affordance});
    }

    // --- Internal helpers ---

    function _intToString(int256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        bool negative = value < 0;
        uint256 absValue = negative ? uint256(-value) : uint256(value);
        uint256 temp = absValue;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(negative ? digits + 1 : digits);
        if (negative) buffer[0] = "-";
        while (absValue != 0) {
            digits--;
            buffer[negative ? digits + 1 : digits] = bytes1(uint8(48 + absValue % 10));
            absValue /= 10;
        }
        return string(buffer);
    }

}
