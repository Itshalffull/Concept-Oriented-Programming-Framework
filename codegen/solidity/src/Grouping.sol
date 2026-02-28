// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Grouping
/// @notice Generated from Grouping concept specification
/// @dev Groups interface actions by classification with CRUD role inference

contract Grouping {

    // --- Storage ---

    struct GroupingInfo {
        string[] items;
        string config;
        string[] groups;
        uint256 created;
        bool exists;
    }

    mapping(bytes32 => GroupingInfo) private _groupings;
    bytes32[] private _groupingKeys;
    uint256 private _nonce;

    // --- Types ---

    struct GroupInput {
        string[] items;
        string config;
    }

    struct GroupOkResult {
        bool success;
        bytes32 grouping;
        string[] groups;
        int256 groupCount;
    }

    struct GroupInvalidStrategyResult {
        bool success;
        string strategy;
    }

    struct ClassifyOkResult {
        bool success;
        string crudRole;
        string intent;
        bool eventProducing;
        string eventVerb;
        string mcpType;
    }

    // --- Events ---

    event GroupCompleted(string variant, bytes32 grouping, string[] groups, int256 groupCount);
    event ClassifyCompleted(string variant, bool eventProducing);

    // --- Actions ---

    /// @notice group
    function group(string[] memory items, string memory config) external returns (GroupOkResult memory) {
        require(items.length > 0, "Items must not be empty");
        require(bytes(config).length > 0, "Config must not be empty");

        bytes32 groupingId = keccak256(abi.encodePacked(config, block.timestamp, _nonce++));

        // Group items - each distinct item is its own group in the simple strategy
        string[] memory groups = new string[](items.length);
        for (uint256 i = 0; i < items.length; i++) {
            groups[i] = items[i];
        }

        string[] memory itemsCopy = new string[](items.length);
        for (uint256 i = 0; i < items.length; i++) {
            itemsCopy[i] = items[i];
        }

        _groupings[groupingId] = GroupingInfo({
            items: itemsCopy,
            config: config,
            groups: groups,
            created: block.timestamp,
            exists: true
        });
        _groupingKeys.push(groupingId);

        int256 groupCount = int256(groups.length);

        emit GroupCompleted("ok", groupingId, groups, groupCount);

        return GroupOkResult({
            success: true,
            grouping: groupingId,
            groups: groups,
            groupCount: groupCount
        });
    }

    /// @notice classify
    function classify(string memory actionName) external returns (ClassifyOkResult memory) {
        require(bytes(actionName).length > 0, "Action name must not be empty");

        // Classify action based on naming conventions
        bytes32 nameHash = keccak256(abi.encodePacked(actionName));

        string memory crudRole;
        string memory intent;
        bool eventProducing;
        string memory eventVerb;
        string memory mcpType;

        // Match common CRUD patterns
        if (nameHash == keccak256(abi.encodePacked("create")) ||
            nameHash == keccak256(abi.encodePacked("add")) ||
            nameHash == keccak256(abi.encodePacked("register")) ||
            nameHash == keccak256(abi.encodePacked("define"))) {
            crudRole = "create";
            intent = "mutation";
            eventProducing = true;
            eventVerb = "Created";
            mcpType = "tool";
        } else if (nameHash == keccak256(abi.encodePacked("get")) ||
                   nameHash == keccak256(abi.encodePacked("read")) ||
                   nameHash == keccak256(abi.encodePacked("list")) ||
                   nameHash == keccak256(abi.encodePacked("resolve")) ||
                   nameHash == keccak256(abi.encodePacked("retrieve"))) {
            crudRole = "read";
            intent = "query";
            eventProducing = false;
            eventVerb = "";
            mcpType = "resource";
        } else if (nameHash == keccak256(abi.encodePacked("update")) ||
                   nameHash == keccak256(abi.encodePacked("modify")) ||
                   nameHash == keccak256(abi.encodePacked("edit"))) {
            crudRole = "update";
            intent = "mutation";
            eventProducing = true;
            eventVerb = "Updated";
            mcpType = "tool";
        } else if (nameHash == keccak256(abi.encodePacked("delete")) ||
                   nameHash == keccak256(abi.encodePacked("remove"))) {
            crudRole = "delete";
            intent = "mutation";
            eventProducing = true;
            eventVerb = "Deleted";
            mcpType = "tool";
        } else {
            crudRole = "action";
            intent = "command";
            eventProducing = true;
            eventVerb = "Executed";
            mcpType = "tool";
        }

        emit ClassifyCompleted("ok", eventProducing);

        return ClassifyOkResult({
            success: true,
            crudRole: crudRole,
            intent: intent,
            eventProducing: eventProducing,
            eventVerb: eventVerb,
            mcpType: mcpType
        });
    }

}
