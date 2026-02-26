// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Query.sol";

contract QueryTest is Test {
    Query public target;

    event QueryCreated(bytes32 indexed queryId);
    event FilterAdded(bytes32 indexed queryId);
    event SortAdded(bytes32 indexed queryId);

    function setUp() public {
        target = new Query();
    }

    // --- create tests ---

    function test_create_stores_query() public {
        bytes32 qid = keccak256("q1");
        target.create(qid, "SELECT *", "global");

        Query.QueryDef memory q = target.getQuery(qid);
        assertEq(q.queryString, "SELECT *");
        assertEq(q.scope, "global");
        assertTrue(q.exists);
    }

    function test_create_emits_event() public {
        bytes32 qid = keccak256("q1");

        vm.expectEmit(true, false, false, false);
        emit QueryCreated(qid);

        target.create(qid, "SELECT *", "global");
    }

    function test_create_duplicate_reverts() public {
        bytes32 qid = keccak256("q1");
        target.create(qid, "SELECT *", "global");

        vm.expectRevert("Query already exists");
        target.create(qid, "SELECT *", "global");
    }

    // --- addFilter tests ---

    function test_addFilter_appends_filter() public {
        bytes32 qid = keccak256("q1");
        target.create(qid, "SELECT *", "global");
        target.addFilter(qid, "status", "eq", "active");

        Query.QueryDef memory q = target.getQuery(qid);
        assertEq(q.filters, "status:eq:active;");
    }

    function test_addFilter_emits_event() public {
        bytes32 qid = keccak256("q1");
        target.create(qid, "SELECT *", "global");

        vm.expectEmit(true, false, false, false);
        emit FilterAdded(qid);

        target.addFilter(qid, "status", "eq", "active");
    }

    function test_addFilter_nonexistent_query_reverts() public {
        bytes32 qid = keccak256("nonexistent");

        vm.expectRevert("Query does not exist");
        target.addFilter(qid, "status", "eq", "active");
    }

    // --- addSort tests ---

    function test_addSort_appends_sort() public {
        bytes32 qid = keccak256("q1");
        target.create(qid, "SELECT *", "global");
        target.addSort(qid, "name", "asc");

        Query.QueryDef memory q = target.getQuery(qid);
        assertEq(q.sorts, "name:asc;");
    }

    function test_addSort_emits_event() public {
        bytes32 qid = keccak256("q1");
        target.create(qid, "SELECT *", "global");

        vm.expectEmit(true, false, false, false);
        emit SortAdded(qid);

        target.addSort(qid, "name", "asc");
    }

    function test_addSort_nonexistent_query_reverts() public {
        bytes32 qid = keccak256("nonexistent");

        vm.expectRevert("Query does not exist");
        target.addSort(qid, "name", "asc");
    }

    // --- getQuery tests ---

    function test_getQuery_nonexistent_reverts() public {
        bytes32 qid = keccak256("nonexistent");

        vm.expectRevert("Query does not exist");
        target.getQuery(qid);
    }

    function test_getQuery_returns_filters_and_sorts() public {
        bytes32 qid = keccak256("q1");
        target.create(qid, "SELECT *", "global");
        target.addFilter(qid, "status", "eq", "active");
        target.addSort(qid, "name", "desc");

        Query.QueryDef memory q = target.getQuery(qid);
        assertEq(q.filters, "status:eq:active;");
        assertEq(q.sorts, "name:desc;");
    }
}
