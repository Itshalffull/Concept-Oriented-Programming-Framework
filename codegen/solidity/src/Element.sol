// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Element
/// @notice UI element management with nesting, constraints, interactor enrichment, and widget assignment.
contract Element {

    // --- Storage ---

    struct ElementEntry {
        string kind;
        string label;
        string dataType;
        string constraints;
        string interactorType;
        string interactorProps;
        string widget;
        bytes32 parentId;
        bool hasParent;
        uint256 createdAt;
    }

    mapping(bytes32 => ElementEntry) private _elements;
    mapping(bytes32 => bool) private _exists;
    mapping(bytes32 => bytes32[]) private _children;

    // --- Types ---

    struct CreateOkResult {
        bool success;
        bytes32 element;
    }

    struct NestOkResult {
        bool success;
        bytes32 parent;
    }

    struct SetConstraintsOkResult {
        bool success;
        bytes32 element;
    }

    struct EnrichOkResult {
        bool success;
        bytes32 element;
    }

    struct AssignWidgetOkResult {
        bool success;
        bytes32 element;
    }

    struct RemoveOkResult {
        bool success;
        bytes32 element;
    }

    // --- Events ---

    event CreateCompleted(string variant, bytes32 indexed element);
    event NestCompleted(string variant, bytes32 indexed parent);
    event SetConstraintsCompleted(string variant, bytes32 indexed element);
    event EnrichCompleted(string variant, bytes32 indexed element);
    event AssignWidgetCompleted(string variant, bytes32 indexed element);
    event RemoveCompleted(string variant, bytes32 indexed element);

    // --- Actions ---

    /// @notice Create a UI element with a kind, label, and data type.
    function create(bytes32 element, string memory kind, string memory label, string memory dataType) external returns (CreateOkResult memory) {
        require(!_exists[element], "Element already exists");
        require(bytes(kind).length > 0, "Kind required");

        _elements[element] = ElementEntry({
            kind: kind,
            label: label,
            dataType: dataType,
            constraints: "",
            interactorType: "",
            interactorProps: "",
            widget: "",
            parentId: bytes32(0),
            hasParent: false,
            createdAt: block.timestamp
        });
        _exists[element] = true;

        emit CreateCompleted("ok", element);
        return CreateOkResult({success: true, element: element});
    }

    /// @notice Nest a child element under a parent element.
    function nest(bytes32 parent, bytes32 child) external returns (NestOkResult memory) {
        require(_exists[parent], "Parent element not found");
        require(_exists[child], "Child element not found");
        require(parent != child, "Cannot nest element under itself");

        _elements[child].parentId = parent;
        _elements[child].hasParent = true;
        _children[parent].push(child);

        emit NestCompleted("ok", parent);
        return NestOkResult({success: true, parent: parent});
    }

    /// @notice Set constraints on an element.
    function setConstraints(bytes32 element, string memory constraints) external returns (SetConstraintsOkResult memory) {
        require(_exists[element], "Element not found");

        _elements[element].constraints = constraints;

        emit SetConstraintsCompleted("ok", element);
        return SetConstraintsOkResult({success: true, element: element});
    }

    /// @notice Enrich an element with interactor type information.
    function enrich(bytes32 element, string memory interactorType, string memory interactorProps) external returns (EnrichOkResult memory) {
        require(_exists[element], "Element not found");

        _elements[element].interactorType = interactorType;
        _elements[element].interactorProps = interactorProps;

        emit EnrichCompleted("ok", element);
        return EnrichOkResult({success: true, element: element});
    }

    /// @notice Assign a widget to an element.
    function assignWidget(bytes32 element, string memory widget) external returns (AssignWidgetOkResult memory) {
        require(_exists[element], "Element not found");

        _elements[element].widget = widget;

        emit AssignWidgetCompleted("ok", element);
        return AssignWidgetOkResult({success: true, element: element});
    }

    /// @notice Remove an element and disassociate it from its parent.
    function remove(bytes32 element) external returns (RemoveOkResult memory) {
        require(_exists[element], "Element not found");

        delete _elements[element];
        _exists[element] = false;

        emit RemoveCompleted("ok", element);
        return RemoveOkResult({success: true, element: element});
    }

}
