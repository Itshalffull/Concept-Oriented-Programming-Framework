// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ExpressionLanguage
/// @notice Concept-oriented expression language registry with grammar and function definitions
/// @dev Implements the ExpressionLanguage concept from Clef specification.
///      Supports registering languages with grammars and their associated functions.

contract ExpressionLanguage {
    // --- Types ---

    struct Language {
        string grammar;
        bool exists;
    }

    struct FunctionDef {
        string signature;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps language ID to its grammar definition
    mapping(bytes32 => Language) private _languages;

    /// @dev Maps language ID -> function name hash -> function definition
    mapping(bytes32 => mapping(bytes32 => FunctionDef)) private _functions;

    // --- Events ---

    event LanguageRegistered(bytes32 indexed languageId);
    event FunctionRegistered(bytes32 indexed languageId, string name);

    // --- Actions ---

    /// @notice Register a new expression language with its grammar
    /// @param languageId The unique identifier for the language
    /// @param grammar The grammar definition string
    function registerLanguage(bytes32 languageId, string calldata grammar) external {
        require(languageId != bytes32(0), "Language ID cannot be zero");
        require(bytes(grammar).length > 0, "Grammar cannot be empty");

        _languages[languageId] = Language({
            grammar: grammar,
            exists: true
        });

        emit LanguageRegistered(languageId);
    }

    /// @notice Register a function within an expression language
    /// @param languageId The language to register the function in
    /// @param funcNameHash The hash of the function name
    /// @param name The human-readable function name
    /// @param signature The function signature definition
    function registerFunction(
        bytes32 languageId,
        bytes32 funcNameHash,
        string calldata name,
        string calldata signature
    ) external {
        require(_languages[languageId].exists, "Language not found");
        require(funcNameHash != bytes32(0), "Function name hash cannot be zero");
        require(bytes(signature).length > 0, "Signature cannot be empty");

        _functions[languageId][funcNameHash] = FunctionDef({
            signature: signature,
            exists: true
        });

        emit FunctionRegistered(languageId, name);
    }

    // --- Views ---

    /// @notice Retrieve a language's grammar definition
    /// @param languageId The language ID
    /// @return The language data struct
    function getLanguage(bytes32 languageId) external view returns (Language memory) {
        require(_languages[languageId].exists, "Language not found");
        return _languages[languageId];
    }

    /// @notice Retrieve a function definition within a language
    /// @param languageId The language ID
    /// @param funcNameHash The function name hash
    /// @return The function definition struct
    function getFunction(bytes32 languageId, bytes32 funcNameHash) external view returns (FunctionDef memory) {
        require(_functions[languageId][funcNameHash].exists, "Function not found");
        return _functions[languageId][funcNameHash];
    }

    /// @notice Check if a language exists
    /// @param languageId The language ID
    /// @return Whether the language is registered
    function languageExists(bytes32 languageId) external view returns (bool) {
        return _languages[languageId].exists;
    }
}
