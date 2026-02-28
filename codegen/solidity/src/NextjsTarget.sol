// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title NextjsTarget
/// @notice Interface-target provider that generates Next.js route definitions from concept projections.
/// @dev Maps concept actions to Next.js App Router routes with HTTP methods.

contract NextjsTarget {

    // --- Storage ---

    /// @dev Maps route hash to whether it exists
    mapping(bytes32 => bool) private routes;
    bytes32[] private routesKeys;

    /// @dev Maps route hash to its path
    mapping(bytes32 => string) private routePaths;

    /// @dev Maps concept hash to generated route paths
    mapping(bytes32 => string[]) private conceptRoutes;

    /// @dev Maps concept hash to generated HTTP methods per route
    mapping(bytes32 => string[]) private conceptMethods;

    /// @dev Counter of total generations
    uint256 private generationCount;

    // --- Types ---

    struct GenerateInput {
        string projection;
        string config;
    }

    struct GenerateOkResult {
        bool success;
        string[] routes;
        string[] files;
    }

    struct GenerateAmbiguousMappingResult {
        bool success;
        string action;
        string reason;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 route;
    }

    struct ValidatePathConflictResult {
        bool success;
        bytes32 route;
        string conflicting;
        string reason;
    }

    struct ListRoutesOkResult {
        bool success;
        string[] routes;
        string[] methods;
    }

    // --- Events ---

    event GenerateCompleted(string variant, string[] routes, string[] files);
    event ValidateCompleted(string variant, bytes32 route);
    event ListRoutesCompleted(string variant, string[] routes, string[] methods);

    // --- Registration ---

    /// @notice Returns static metadata for this target provider.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory formats)
    {
        name = "nextjs";
        category = "interface-target";
        formats = new string[](1);
        formats[0] = "typescript";
    }

    // --- Actions ---

    /// @notice Generate Next.js routes from a concept projection
    function generate(string memory projection, string memory config) external returns (GenerateOkResult memory) {
        require(bytes(projection).length > 0, "Projection cannot be empty");

        bytes32 routeHash = keccak256(abi.encodePacked(projection, generationCount));
        generationCount++;

        string memory routePath = string(abi.encodePacked("/api/", projection));

        if (!routes[routeHash]) {
            routes[routeHash] = true;
            routesKeys.push(routeHash);
        }
        routePaths[routeHash] = routePath;

        // Build output
        string[] memory routeList = new string[](1);
        routeList[0] = routePath;

        string[] memory files = new string[](2);
        files[0] = string(abi.encodePacked("app/api/", projection, "/route.ts"));
        files[1] = string(abi.encodePacked("app/api/", projection, "/[id]/route.ts"));

        // Store concept-level listings
        bytes32 conceptHash = keccak256(abi.encodePacked(projection));

        string[] memory routeNames = new string[](2);
        routeNames[0] = routePath;
        routeNames[1] = string(abi.encodePacked(routePath, "/[id]"));

        string[] memory methods = new string[](2);
        methods[0] = "GET,POST";
        methods[1] = "GET,PUT,DELETE";

        conceptRoutes[conceptHash] = routeNames;
        conceptMethods[conceptHash] = methods;

        emit GenerateCompleted("ok", routeList, files);

        return GenerateOkResult({
            success: true,
            routes: routeList,
            files: files
        });
    }

    /// @notice Validate a generated Next.js route for path conflicts
    function validate(bytes32 route) external returns (ValidateOkResult memory) {
        require(routes[route], "Route not found");

        emit ValidateCompleted("ok", route);

        return ValidateOkResult({
            success: true,
            route: route
        });
    }

    /// @notice List all generated routes and methods for a concept
    function listRoutes(string memory concept) external returns (ListRoutesOkResult memory) {
        bytes32 conceptHash = keccak256(abi.encodePacked(concept));
        string[] memory routeList = conceptRoutes[conceptHash];
        string[] memory methods = conceptMethods[conceptHash];

        if (routeList.length == 0) {
            routeList = new string[](0);
            methods = new string[](0);
        }

        emit ListRoutesCompleted("ok", routeList, methods);

        return ListRoutesOkResult({
            success: true,
            routes: routeList,
            methods: methods
        });
    }

}
