// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ExposedFilter
/// @notice Manages user-facing filter configurations with default values and collected user input.
contract ExposedFilter {
    struct FilterConfig {
        string config;
        string defaultValue;
        string currentValue;
        bool exists;
    }

    mapping(bytes32 => FilterConfig) private _filters;

    event FilterExposed(bytes32 indexed filterId);
    event InputCollected(bytes32 indexed filterId);
    event FiltersReset();

    /// @notice Exposes a new filter with a configuration and default value.
    /// @param filterId Unique identifier for the filter.
    /// @param config Serialised filter configuration.
    /// @param defaultValue The default filter value.
    function expose(bytes32 filterId, string calldata config, string calldata defaultValue) external {
        require(!_filters[filterId].exists, "Filter already exists");

        _filters[filterId] = FilterConfig({
            config: config,
            defaultValue: defaultValue,
            currentValue: defaultValue,
            exists: true
        });

        emit FilterExposed(filterId);
    }

    /// @notice Collects user input for an exposed filter.
    /// @param filterId The filter to update.
    /// @param userValue The user-provided value.
    function collectInput(bytes32 filterId, string calldata userValue) external {
        require(_filters[filterId].exists, "Filter does not exist");

        _filters[filterId].currentValue = userValue;

        emit InputCollected(filterId);
    }

    /// @notice Retrieves a filter configuration.
    /// @param filterId The filter to look up.
    /// @return The filter config struct.
    function getFilter(bytes32 filterId) external view returns (FilterConfig memory) {
        require(_filters[filterId].exists, "Filter does not exist");
        return _filters[filterId];
    }

    /// @notice Resets a filter to its default value.
    /// @param filterId The filter to reset.
    function resetToDefaults(bytes32 filterId) external {
        require(_filters[filterId].exists, "Filter does not exist");

        _filters[filterId].currentValue = _filters[filterId].defaultValue;

        emit FiltersReset();
    }
}
