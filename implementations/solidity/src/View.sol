// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title View
/// @notice Defines configurable data views with layout, filters, sorts, grouping, and visible field settings.
contract View {
    struct ViewData {
        string name;
        string dataSource;
        string layout;
        string filters;
        string sorts;
        string groupField;
        string visibleFields;
        bool exists;
    }

    mapping(bytes32 => ViewData) private _views;
    uint256 private _viewCounter;

    event ViewCreated(bytes32 indexed viewId);
    event ViewUpdated(bytes32 indexed viewId);
    event ViewDuplicated(bytes32 indexed originalId, bytes32 indexed newId);

    /// @notice Creates a new view.
    /// @param viewId Unique identifier for the view.
    /// @param name Human-readable view name.
    /// @param dataSource The data source for the view.
    /// @param layout The initial layout type.
    function create(
        bytes32 viewId,
        string calldata name,
        string calldata dataSource,
        string calldata layout
    ) external {
        require(!_views[viewId].exists, "View already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _views[viewId] = ViewData({
            name: name,
            dataSource: dataSource,
            layout: layout,
            filters: "",
            sorts: "",
            groupField: "",
            visibleFields: "",
            exists: true
        });

        _viewCounter++;

        emit ViewCreated(viewId);
    }

    /// @notice Sets filter rules on a view.
    /// @param viewId The view to update.
    /// @param rules Serialised filter rules.
    function setFilter(bytes32 viewId, string calldata rules) external {
        require(_views[viewId].exists, "View does not exist");

        _views[viewId].filters = rules;

        emit ViewUpdated(viewId);
    }

    /// @notice Sets sort rules on a view.
    /// @param viewId The view to update.
    /// @param rules Serialised sort rules.
    function setSort(bytes32 viewId, string calldata rules) external {
        require(_views[viewId].exists, "View does not exist");

        _views[viewId].sorts = rules;

        emit ViewUpdated(viewId);
    }

    /// @notice Sets the grouping field for a view.
    /// @param viewId The view to update.
    /// @param field The field name to group by.
    function setGroup(bytes32 viewId, string calldata field) external {
        require(_views[viewId].exists, "View does not exist");

        _views[viewId].groupField = field;

        emit ViewUpdated(viewId);
    }

    /// @notice Sets which fields are visible in a view.
    /// @param viewId The view to update.
    /// @param fieldIds Serialised list of visible field IDs.
    function setVisibleFields(bytes32 viewId, string calldata fieldIds) external {
        require(_views[viewId].exists, "View does not exist");

        _views[viewId].visibleFields = fieldIds;

        emit ViewUpdated(viewId);
    }

    /// @notice Changes the layout type of a view.
    /// @param viewId The view to update.
    /// @param layout The new layout type.
    function changeLayout(bytes32 viewId, string calldata layout) external {
        require(_views[viewId].exists, "View does not exist");

        _views[viewId].layout = layout;

        emit ViewUpdated(viewId);
    }

    /// @notice Retrieves view data.
    /// @param viewId The view to look up.
    /// @return The view struct.
    function getView(bytes32 viewId) external view returns (ViewData memory) {
        require(_views[viewId].exists, "View does not exist");
        return _views[viewId];
    }
}
