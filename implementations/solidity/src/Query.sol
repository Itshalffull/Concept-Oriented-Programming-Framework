// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Query
/// @notice Stores structured query definitions with filters and sorts. Actual query execution happens off-chain.
contract Query {
    struct QueryDef {
        string queryString;
        string scope;
        string filters;
        string sorts;
        bool exists;
    }

    mapping(bytes32 => QueryDef) private _queries;

    event QueryCreated(bytes32 indexed queryId);
    event FilterAdded(bytes32 indexed queryId);
    event SortAdded(bytes32 indexed queryId);

    /// @notice Creates a new query definition.
    /// @param queryId Unique identifier for the query.
    /// @param queryString The query expression.
    /// @param scope The scope of the query.
    function create(bytes32 queryId, string calldata queryString, string calldata scope) external {
        require(!_queries[queryId].exists, "Query already exists");

        _queries[queryId] = QueryDef({
            queryString: queryString,
            scope: scope,
            filters: "",
            sorts: "",
            exists: true
        });

        emit QueryCreated(queryId);
    }

    /// @notice Adds a filter condition to an existing query.
    /// @param queryId The query to modify.
    /// @param field The field name to filter on.
    /// @param operator_ The comparison operator.
    /// @param value The value to compare against.
    function addFilter(
        bytes32 queryId,
        string calldata field,
        string calldata operator_,
        string calldata value
    ) external {
        require(_queries[queryId].exists, "Query does not exist");

        _queries[queryId].filters = string(
            abi.encodePacked(_queries[queryId].filters, field, ":", operator_, ":", value, ";")
        );

        emit FilterAdded(queryId);
    }

    /// @notice Adds a sort rule to an existing query.
    /// @param queryId The query to modify.
    /// @param field The field name to sort by.
    /// @param direction The sort direction (e.g. "asc" or "desc").
    function addSort(bytes32 queryId, string calldata field, string calldata direction) external {
        require(_queries[queryId].exists, "Query does not exist");

        _queries[queryId].sorts = string(
            abi.encodePacked(_queries[queryId].sorts, field, ":", direction, ";")
        );

        emit SortAdded(queryId);
    }

    /// @notice Retrieves a query definition.
    /// @param queryId The query to look up.
    /// @return The query struct.
    function getQuery(bytes32 queryId) external view returns (QueryDef memory) {
        require(_queries[queryId].exists, "Query does not exist");
        return _queries[queryId];
    }
}
