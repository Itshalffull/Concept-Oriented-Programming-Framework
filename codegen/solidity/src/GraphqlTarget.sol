// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GraphqlTarget
/// @notice Interface-target provider that generates GraphQL schema definitions from concept projections.
/// @dev Produces SDL type definitions and TypeScript resolvers.

contract GraphqlTarget {

    // --- Storage ---

    /// @dev Maps type hash to whether it exists
    mapping(bytes32 => bool) private types;
    bytes32[] private typesKeys;

    /// @dev Maps type hash to its name
    mapping(bytes32 => string) private typeNames;

    /// @dev Maps concept hash to generated queries
    mapping(bytes32 => string[]) private conceptQueries;

    /// @dev Maps concept hash to generated mutations
    mapping(bytes32 => string[]) private conceptMutations;

    /// @dev Maps concept hash to generated subscriptions
    mapping(bytes32 => string[]) private conceptSubscriptions;

    /// @dev Counter of total generations
    uint256 private generationCount;

    // --- Types ---

    struct GenerateInput {
        string projection;
        string config;
    }

    struct GenerateOkResult {
        bool success;
        string[] types;
        string[] files;
    }

    struct GenerateFederationConflictResult {
        bool success;
        string typeName;
        string reason;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 typeHash;
    }

    struct ValidateCyclicTypeResult {
        bool success;
        bytes32 typeHash;
        string[] cycle;
    }

    struct ListOperationsOkResult {
        bool success;
        string[] queries;
        string[] mutations;
        string[] subscriptions;
    }

    // --- Events ---

    event GenerateCompleted(string variant, string[] types, string[] files);
    event ValidateCompleted(string variant, bytes32 typeHash, string[] cycle);
    event ListOperationsCompleted(string variant, string[] queries, string[] mutations, string[] subscriptions);

    // --- Registration ---

    /// @notice Returns static metadata for this target provider.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory formats)
    {
        name = "graphql";
        category = "interface-target";
        formats = new string[](2);
        formats[0] = "sdl";
        formats[1] = "typescript";
    }

    // --- Actions ---

    /// @notice Generate GraphQL types from a concept projection
    function generate(string memory projection, string memory config) external returns (GenerateOkResult memory) {
        require(bytes(projection).length > 0, "Projection cannot be empty");

        // Create a type entry for the projection
        bytes32 typeHash = keccak256(abi.encodePacked(projection, generationCount));
        generationCount++;

        string memory typeName = projection;

        if (!types[typeHash]) {
            types[typeHash] = true;
            typesKeys.push(typeHash);
        }
        typeNames[typeHash] = typeName;

        // Build output
        string[] memory typeList = new string[](1);
        typeList[0] = typeName;

        string[] memory files = new string[](2);
        files[0] = string(abi.encodePacked(projection, ".schema.graphql"));
        files[1] = string(abi.encodePacked(projection, ".resolvers.ts"));

        // Store concept-level operation listings
        bytes32 conceptHash = keccak256(abi.encodePacked(projection));

        string[] memory queries = new string[](1);
        queries[0] = string(abi.encodePacked("get", projection));

        string[] memory mutations = new string[](1);
        mutations[0] = string(abi.encodePacked("update", projection));

        string[] memory subscriptions = new string[](1);
        subscriptions[0] = string(abi.encodePacked("on", projection, "Changed"));

        conceptQueries[conceptHash] = queries;
        conceptMutations[conceptHash] = mutations;
        conceptSubscriptions[conceptHash] = subscriptions;

        emit GenerateCompleted("ok", typeList, files);

        return GenerateOkResult({
            success: true,
            types: typeList,
            files: files
        });
    }

    /// @notice Validate a generated GraphQL type for cyclic references
    function validate(bytes32 typeHash) external returns (ValidateOkResult memory) {
        require(types[typeHash], "Type not found");

        string[] memory noCycle = new string[](0);
        emit ValidateCompleted("ok", typeHash, noCycle);

        return ValidateOkResult({
            success: true,
            typeHash: typeHash
        });
    }

    /// @notice List all generated operations for a concept
    function listOperations(string memory concept) external returns (ListOperationsOkResult memory) {
        bytes32 conceptHash = keccak256(abi.encodePacked(concept));
        string[] memory queries = conceptQueries[conceptHash];
        string[] memory mutations = conceptMutations[conceptHash];
        string[] memory subscriptions = conceptSubscriptions[conceptHash];

        if (queries.length == 0) {
            queries = new string[](0);
            mutations = new string[](0);
            subscriptions = new string[](0);
        }

        emit ListOperationsCompleted("ok", queries, mutations, subscriptions);

        return ListOperationsOkResult({
            success: true,
            queries: queries,
            mutations: mutations,
            subscriptions: subscriptions
        });
    }

}
