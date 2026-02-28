// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AnatomyPartEntity
/// @notice Anatomy part entity extraction and query for widget specifications.
/// @dev Manages widget anatomy parts with role-based and binding-based lookups.

contract AnatomyPartEntity {

    // --- Storage ---

    struct PartData {
        string widget;
        string name;
        string role;
        string required;
        bool exists;
    }

    mapping(bytes32 => PartData) private _parts;
    bytes32[] private _partIds;

    // Role index: roleHash => list of part IDs
    mapping(bytes32 => bytes32[]) private _roleIndex;

    // Widget index: widgetHash => list of part IDs
    mapping(bytes32 => bytes32[]) private _widgetIndex;

    // --- Types ---

    struct RegisterInput {
        string widget;
        string name;
        string role;
        string required;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 part;
    }

    struct FindByRoleOkResult {
        bool success;
        string parts;
    }

    struct FindBoundToFieldOkResult {
        bool success;
        string parts;
    }

    struct FindBoundToActionOkResult {
        bool success;
        string parts;
    }

    struct GetOkResult {
        bool success;
        bytes32 part;
        string widget;
        string name;
        string semanticRole;
        string required;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 part);
    event FindByRoleCompleted(string variant);
    event FindBoundToFieldCompleted(string variant);
    event FindBoundToActionCompleted(string variant);
    event GetCompleted(string variant, bytes32 part);

    // --- Actions ---

    /// @notice register
    function register(string memory widget, string memory name, string memory role, string memory required) external returns (RegisterOkResult memory) {
        require(bytes(widget).length > 0, "Widget must not be empty");
        require(bytes(name).length > 0, "Name must not be empty");

        bytes32 partId = keccak256(abi.encodePacked(widget, name));
        require(!_parts[partId].exists, "Part already registered");

        _parts[partId] = PartData({
            widget: widget,
            name: name,
            role: role,
            required: required,
            exists: true
        });
        _partIds.push(partId);

        bytes32 roleHash = keccak256(abi.encodePacked(role));
        _roleIndex[roleHash].push(partId);

        bytes32 widgetHash = keccak256(abi.encodePacked(widget));
        _widgetIndex[widgetHash].push(partId);

        emit RegisterCompleted("ok", partId);
        return RegisterOkResult({success: true, part: partId});
    }

    /// @notice findByRole
    function findByRole(string memory role) external returns (FindByRoleOkResult memory) {
        bytes32 roleHash = keccak256(abi.encodePacked(role));
        bytes32[] storage ids = _roleIndex[roleHash];

        string memory result = "";
        for (uint256 i = 0; i < ids.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _parts[ids[i]].name));
        }

        emit FindByRoleCompleted("ok");
        return FindByRoleOkResult({success: true, parts: result});
    }

    /// @notice findBoundToField
    function findBoundToField(string memory field) external returns (FindBoundToFieldOkResult memory) {
        bytes32 fieldHash = keccak256(abi.encodePacked("field:", field));

        // Search all parts for field binding match via role containing the field reference
        string memory result = "";
        uint256 count = 0;
        for (uint256 i = 0; i < _partIds.length; i++) {
            PartData storage p = _parts[_partIds[i]];
            bytes32 partRoleHash = keccak256(abi.encodePacked("field:", p.role));
            if (partRoleHash == fieldHash) {
                if (count > 0) {
                    result = string(abi.encodePacked(result, ","));
                }
                result = string(abi.encodePacked(result, p.name));
                count++;
            }
        }

        emit FindBoundToFieldCompleted("ok");
        return FindBoundToFieldOkResult({success: true, parts: result});
    }

    /// @notice findBoundToAction
    function findBoundToAction(string memory action) external returns (FindBoundToActionOkResult memory) {
        bytes32 actionHash = keccak256(abi.encodePacked("action:", action));

        string memory result = "";
        uint256 count = 0;
        for (uint256 i = 0; i < _partIds.length; i++) {
            PartData storage p = _parts[_partIds[i]];
            bytes32 partRoleHash = keccak256(abi.encodePacked("action:", p.role));
            if (partRoleHash == actionHash) {
                if (count > 0) {
                    result = string(abi.encodePacked(result, ","));
                }
                result = string(abi.encodePacked(result, p.name));
                count++;
            }
        }

        emit FindBoundToActionCompleted("ok");
        return FindBoundToActionOkResult({success: true, parts: result});
    }

    /// @notice get
    function get(bytes32 part) external returns (GetOkResult memory) {
        require(_parts[part].exists, "Part not found");

        PartData storage data = _parts[part];

        emit GetCompleted("ok", part);
        return GetOkResult({
            success: true,
            part: part,
            widget: data.widget,
            name: data.name,
            semanticRole: data.role,
            required: data.required
        });
    }

}
