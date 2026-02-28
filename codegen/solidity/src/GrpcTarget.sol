// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GrpcTarget
/// @notice Interface-target provider that generates gRPC service definitions from concept projections.
/// @dev Produces .proto service definitions and TypeScript client stubs.

contract GrpcTarget {

    // --- Storage ---

    /// @dev Maps service hash to whether it exists
    mapping(bytes32 => bool) private services;
    bytes32[] private servicesKeys;

    /// @dev Maps service hash to its name
    mapping(bytes32 => string) private serviceNames;

    /// @dev Maps concept hash to generated RPC names
    mapping(bytes32 => string[]) private conceptRpcs;

    /// @dev Maps concept hash to streaming modes per RPC
    mapping(bytes32 => string[]) private conceptStreamingModes;

    /// @dev Counter of total generations
    uint256 private generationCount;

    // --- Types ---

    struct GenerateInput {
        string projection;
        string config;
    }

    struct GenerateOkResult {
        bool success;
        string[] services;
        string[] files;
    }

    struct GenerateProtoIncompatibleResult {
        bool success;
        string typeName;
        string reason;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 service;
    }

    struct ValidateFieldNumberConflictResult {
        bool success;
        bytes32 service;
        string message;
        string field;
    }

    struct ListRpcsOkResult {
        bool success;
        string[] rpcs;
        string[] streamingModes;
    }

    // --- Events ---

    event GenerateCompleted(string variant, string[] services, string[] files);
    event ValidateCompleted(string variant, bytes32 service);
    event ListRpcsCompleted(string variant, string[] rpcs, string[] streamingModes);

    // --- Registration ---

    /// @notice Returns static metadata for this target provider.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory formats)
    {
        name = "grpc";
        category = "interface-target";
        formats = new string[](2);
        formats[0] = "proto";
        formats[1] = "typescript";
    }

    // --- Actions ---

    /// @notice Generate gRPC service definitions from a concept projection
    function generate(string memory projection, string memory config) external returns (GenerateOkResult memory) {
        require(bytes(projection).length > 0, "Projection cannot be empty");

        bytes32 svcHash = keccak256(abi.encodePacked(projection, generationCount));
        generationCount++;

        string memory svcName = string(abi.encodePacked(projection, "Service"));

        if (!services[svcHash]) {
            services[svcHash] = true;
            servicesKeys.push(svcHash);
        }
        serviceNames[svcHash] = svcName;

        // Build output
        string[] memory svcList = new string[](1);
        svcList[0] = svcName;

        string[] memory files = new string[](2);
        files[0] = string(abi.encodePacked(projection, ".proto"));
        files[1] = string(abi.encodePacked(projection, ".grpc.ts"));

        // Store concept-level RPC listings
        bytes32 conceptHash = keccak256(abi.encodePacked(projection));

        string[] memory rpcs = new string[](2);
        rpcs[0] = string(abi.encodePacked("Get", projection));
        rpcs[1] = string(abi.encodePacked("Update", projection));

        string[] memory modes = new string[](2);
        modes[0] = "unary";
        modes[1] = "unary";

        conceptRpcs[conceptHash] = rpcs;
        conceptStreamingModes[conceptHash] = modes;

        emit GenerateCompleted("ok", svcList, files);

        return GenerateOkResult({
            success: true,
            services: svcList,
            files: files
        });
    }

    /// @notice Validate a generated gRPC service definition
    function validate(bytes32 service) external returns (ValidateOkResult memory) {
        require(services[service], "Service not found");

        emit ValidateCompleted("ok", service);

        return ValidateOkResult({
            success: true,
            service: service
        });
    }

    /// @notice List all generated RPCs for a concept
    function listRpcs(string memory concept) external returns (ListRpcsOkResult memory) {
        bytes32 conceptHash = keccak256(abi.encodePacked(concept));
        string[] memory rpcs = conceptRpcs[conceptHash];
        string[] memory modes = conceptStreamingModes[conceptHash];

        if (rpcs.length == 0) {
            rpcs = new string[](0);
            modes = new string[](0);
        }

        emit ListRpcsCompleted("ok", rpcs, modes);

        return ListRpcsOkResult({
            success: true,
            rpcs: rpcs,
            streamingModes: modes
        });
    }

}
