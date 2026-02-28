// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title OpenaiTarget
/// @notice AI-target provider that generates OpenAI function-calling definitions from concept projections.
/// @dev Produces JSON function schemas compatible with the OpenAI API.

contract OpenaiTarget {

    // --- Storage ---

    /// @dev Maps function hash to whether it exists
    mapping(bytes32 => bool) private functions;
    bytes32[] private functionsKeys;

    /// @dev Maps function hash to its name
    mapping(bytes32 => string) private functionNames;

    /// @dev Maps concept hash to generated function names
    mapping(bytes32 => string[]) private conceptFunctions;

    /// @dev Counter of total generations
    uint256 private generationCount;

    // --- Types ---

    struct GenerateInput {
        string projection;
        string config;
    }

    struct GenerateOkResult {
        bool success;
        string[] functions;
        string[] files;
    }

    struct GenerateTooManyFunctionsResult {
        bool success;
        int256 count;
        int256 limit;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 fn;
    }

    struct ValidateMissingDescriptionResult {
        bool success;
        bytes32 fn;
        string functionName;
    }

    struct ListFunctionsOkResult {
        bool success;
        string[] functions;
    }

    // --- Events ---

    event GenerateCompleted(string variant, string[] functions, string[] files, int256 count, int256 limit);
    event ValidateCompleted(string variant, bytes32 fn);
    event ListFunctionsCompleted(string variant, string[] functions);

    // --- Registration ---

    /// @notice Returns static metadata for this target provider.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory formats)
    {
        name = "openai";
        category = "ai-target";
        formats = new string[](1);
        formats[0] = "json";
    }

    // --- Actions ---

    /// @notice Generate OpenAI function definitions from a concept projection
    function generate(string memory projection, string memory config) external returns (GenerateOkResult memory) {
        require(bytes(projection).length > 0, "Projection cannot be empty");

        bytes32 fnHash = keccak256(abi.encodePacked(projection, generationCount));
        generationCount++;

        string memory fnName = string(abi.encodePacked(projection, "_action"));

        if (!functions[fnHash]) {
            functions[fnHash] = true;
            functionsKeys.push(fnHash);
        }
        functionNames[fnHash] = fnName;

        // Build output
        string[] memory fnList = new string[](1);
        fnList[0] = fnName;

        string[] memory files = new string[](1);
        files[0] = string(abi.encodePacked(projection, ".functions.json"));

        // Store concept-level listings
        bytes32 conceptHash = keccak256(abi.encodePacked(projection));
        conceptFunctions[conceptHash] = fnList;

        emit GenerateCompleted("ok", fnList, files, 1, 128);

        return GenerateOkResult({
            success: true,
            functions: fnList,
            files: files
        });
    }

    /// @notice Validate a generated OpenAI function definition
    function validate(bytes32 fn) external returns (ValidateOkResult memory) {
        require(functions[fn], "Function not found");

        emit ValidateCompleted("ok", fn);

        return ValidateOkResult({
            success: true,
            fn: fn
        });
    }

    /// @notice List all generated functions for a concept
    function listFunctions(string memory concept) external returns (ListFunctionsOkResult memory) {
        bytes32 conceptHash = keccak256(abi.encodePacked(concept));
        string[] memory fnList = conceptFunctions[conceptHash];

        if (fnList.length == 0) {
            fnList = new string[](0);
        }

        emit ListFunctionsCompleted("ok", fnList);

        return ListFunctionsOkResult({
            success: true,
            functions: fnList
        });
    }

}
