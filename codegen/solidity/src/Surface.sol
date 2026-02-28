// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Surface
/// @notice Render surface management with mounting, resizing, and zone-based content attachment.
contract Surface {

    // --- Storage ---

    struct SurfaceEntry {
        string kind;
        string mountPoint;
        string renderer;
        int256 width;
        int256 height;
        bool active;
        uint256 createdAt;
    }

    mapping(bytes32 => SurfaceEntry) private _surfaces;
    mapping(bytes32 => bool) private _exists;
    mapping(bytes32 => mapping(bytes32 => string)) private _mountedTrees;
    mapping(bytes32 => mapping(bytes32 => bool)) private _zoneMounted;

    // --- Types ---

    struct CreateOkResult {
        bool success;
        bytes32 surface;
    }

    struct AttachOkResult {
        bool success;
        bytes32 surface;
    }

    struct ResizeOkResult {
        bool success;
        bytes32 surface;
    }

    struct MountOkResult {
        bool success;
        bytes32 surface;
    }

    struct UnmountOkResult {
        bool success;
        bytes32 surface;
    }

    struct DestroyOkResult {
        bool success;
        bytes32 surface;
    }

    // --- Events ---

    event CreateCompleted(string variant, bytes32 indexed surface);
    event AttachCompleted(string variant, bytes32 indexed surface);
    event ResizeCompleted(string variant, bytes32 indexed surface);
    event MountCompleted(string variant, bytes32 indexed surface);
    event UnmountCompleted(string variant, bytes32 indexed surface);
    event DestroyCompleted(string variant, bytes32 indexed surface);

    // --- Actions ---

    /// @notice Create a render surface with a kind and mount point.
    function create(bytes32 surface, string memory kind, string memory mountPoint) external returns (CreateOkResult memory) {
        require(!_exists[surface], "Surface already exists");
        require(bytes(kind).length > 0, "Kind required");

        _surfaces[surface] = SurfaceEntry({
            kind: kind,
            mountPoint: mountPoint,
            renderer: "",
            width: 0,
            height: 0,
            active: true,
            createdAt: block.timestamp
        });
        _exists[surface] = true;

        emit CreateCompleted("ok", surface);
        return CreateOkResult({success: true, surface: surface});
    }

    /// @notice Attach a renderer to the surface.
    function attach(bytes32 surface, string memory renderer) external returns (AttachOkResult memory) {
        require(_exists[surface], "Surface not found");
        require(_surfaces[surface].active, "Surface not active");

        _surfaces[surface].renderer = renderer;

        emit AttachCompleted("ok", surface);
        return AttachOkResult({success: true, surface: surface});
    }

    /// @notice Resize the surface dimensions.
    function resize(bytes32 surface, int256 width, int256 height) external returns (ResizeOkResult memory) {
        require(_exists[surface], "Surface not found");

        _surfaces[surface].width = width;
        _surfaces[surface].height = height;

        emit ResizeCompleted("ok", surface);
        return ResizeOkResult({success: true, surface: surface});
    }

    /// @notice Mount a component tree into a zone on the surface.
    function mount(bytes32 surface, string memory tree, string memory zone) external returns (MountOkResult memory) {
        require(_exists[surface], "Surface not found");
        require(_surfaces[surface].active, "Surface not active");

        bytes32 zoneKey = keccak256(abi.encodePacked(zone));
        _mountedTrees[surface][zoneKey] = tree;
        _zoneMounted[surface][zoneKey] = true;

        emit MountCompleted("ok", surface);
        return MountOkResult({success: true, surface: surface});
    }

    /// @notice Unmount a component tree from a zone on the surface.
    function unmount(bytes32 surface, string memory zone) external returns (UnmountOkResult memory) {
        require(_exists[surface], "Surface not found");

        bytes32 zoneKey = keccak256(abi.encodePacked(zone));
        require(_zoneMounted[surface][zoneKey], "Zone not mounted");

        delete _mountedTrees[surface][zoneKey];
        _zoneMounted[surface][zoneKey] = false;

        emit UnmountCompleted("ok", surface);
        return UnmountOkResult({success: true, surface: surface});
    }

    /// @notice Destroy a surface, cleaning up all mounted content.
    function destroy(bytes32 surface) external returns (DestroyOkResult memory) {
        require(_exists[surface], "Surface not found");

        _surfaces[surface].active = false;
        delete _surfaces[surface];
        _exists[surface] = false;

        emit DestroyCompleted("ok", surface);
        return DestroyOkResult({success: true, surface: surface});
    }

}
