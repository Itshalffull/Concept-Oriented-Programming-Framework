// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FrameworkAdapter
/// @notice Base render-framework adapter — registers framework renderers,
///         normalizes widget props for a target framework, and manages
///         mount/unmount lifecycle of rendered output.
/// @dev Skeleton contract — implement action bodies

contract FrameworkAdapter {

    // --- Storage (from concept state) ---

    /// @dev Renderer registration: renderer id => encoded (framework, version, normalizer, mountFn)
    mapping(bytes32 => bytes) private rendererConfigs;

    /// @dev Track which renderers have been registered
    mapping(bytes32 => bool) private registeredRenderers;

    /// @dev Mount targets: keccak256(renderer, target) => true when mounted
    mapping(bytes32 => bool) private mountedTargets;

    /// @dev Render state: adapter id => encoded normalized props
    mapping(bytes32 => bytes) private renderState;

    // --- Types ---

    struct RegisterInput {
        bytes32 renderer;
        string framework;
        string version;
        string normalizer;
        string mountFn;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 renderer;
    }

    struct RegisterDuplicateResult {
        bool success;
        string message;
    }

    struct NormalizeInput {
        bytes32 renderer;
        string props;
    }

    struct NormalizeOkResult {
        bool success;
        string normalized;
    }

    struct NormalizeNotfoundResult {
        bool success;
        string message;
    }

    struct MountInput {
        bytes32 renderer;
        string machine;
        string target;
    }

    struct MountOkResult {
        bool success;
        bytes32 renderer;
    }

    struct MountErrorResult {
        bool success;
        string message;
    }

    struct RenderInput {
        bytes32 adapter;
        string props;
    }

    struct RenderOkResult {
        bool success;
        bytes32 adapter;
    }

    struct RenderErrorResult {
        bool success;
        string message;
    }

    struct UnmountInput {
        bytes32 renderer;
        string target;
    }

    struct UnmountOkResult {
        bool success;
        bytes32 renderer;
    }

    struct UnmountNotfoundResult {
        bool success;
        string message;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 renderer);
    event NormalizeCompleted(string variant);
    event MountCompleted(string variant, bytes32 renderer);
    event RenderCompleted(string variant, bytes32 adapter);
    event UnmountCompleted(string variant, bytes32 renderer);

    // --- Actions ---

    /// @notice Register a framework renderer with its metadata and callbacks.
    function register(bytes32 renderer, string memory framework, string memory version, string memory normalizer, string memory mountFn) external returns (RegisterOkResult memory) {
        require(!registeredRenderers[renderer], "Renderer already registered");

        rendererConfigs[renderer] = abi.encode(framework, version, normalizer, mountFn);
        registeredRenderers[renderer] = true;

        emit RegisterCompleted("ok", renderer);

        return RegisterOkResult({
            success: true,
            renderer: renderer
        });
    }

    /// @notice Normalize widget props for a registered renderer's framework.
    function normalize(bytes32 renderer, string memory props) external returns (NormalizeOkResult memory) {
        require(registeredRenderers[renderer], "Renderer not found");
        require(bytes(props).length > 0, "Props must not be empty");

        (string memory framework, , string memory normalizer, ) =
            abi.decode(rendererConfigs[renderer], (string, string, string, string));

        // Produce normalized output: framework-qualified props
        string memory normalized = string(abi.encodePacked(framework, ":", normalizer, ":", props));

        emit NormalizeCompleted("ok");

        return NormalizeOkResult({
            success: true,
            normalized: normalized
        });
    }

    /// @notice Mount a state machine to a render target using the registered renderer.
    function mount(bytes32 renderer, string memory machine, string memory target) external returns (MountOkResult memory) {
        require(registeredRenderers[renderer], "Renderer not registered");
        require(bytes(target).length > 0, "Target must not be empty");
        require(bytes(machine).length > 0, "Machine must not be empty");

        bytes32 mountKey = keccak256(abi.encodePacked(renderer, target));
        require(!mountedTargets[mountKey], "Target already mounted");

        mountedTargets[mountKey] = true;

        emit MountCompleted("ok", renderer);

        return MountOkResult({
            success: true,
            renderer: renderer
        });
    }

    /// @notice Render props through the adapter, storing normalized output.
    function render(bytes32 adapter, string memory props) external returns (RenderOkResult memory) {
        require(bytes(props).length > 0, "Props must not be empty");

        renderState[adapter] = abi.encode(props);

        emit RenderCompleted("ok", adapter);

        return RenderOkResult({
            success: true,
            adapter: adapter
        });
    }

    /// @notice Unmount a previously mounted render target.
    function unmount(bytes32 renderer, string memory target) external returns (UnmountOkResult memory) {
        require(registeredRenderers[renderer], "Renderer not registered");

        bytes32 mountKey = keccak256(abi.encodePacked(renderer, target));
        require(mountedTargets[mountKey], "Target not mounted");

        mountedTargets[mountKey] = false;

        emit UnmountCompleted("ok", renderer);

        return UnmountOkResult({
            success: true,
            renderer: renderer
        });
    }

}
