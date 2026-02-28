// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CliTarget
/// @notice Interface-target provider that generates CLI command definitions from concept projections.
/// @dev Maps concept actions to CLI commands with flags and positional arguments.

contract CliTarget {

    // --- Storage ---

    /// @dev Maps command hash to whether it exists
    mapping(bytes32 => bool) private commands;
    bytes32[] private commandsKeys;

    /// @dev Maps command hash to its name
    mapping(bytes32 => string) private commandNames;

    /// @dev Maps command hash to its parent concept
    mapping(bytes32 => string) private commandConcepts;

    /// @dev Maps projection hash to the generated file list
    mapping(bytes32 => string[]) private generatedFiles;

    /// @dev Maps concept hash to its generated command names
    mapping(bytes32 => string[]) private conceptCommands;

    /// @dev Maps concept hash to its generated subcommand names
    mapping(bytes32 => string[]) private conceptSubcommands;

    /// @dev Counter of total generations
    uint256 private generationCount;

    // --- Types ---

    struct GenerateInput {
        string projection;
        string config;
    }

    struct GenerateOkResult {
        bool success;
        string[] commands;
        string[] files;
    }

    struct GenerateTooManyPositionalResult {
        bool success;
        string action;
        int256 count;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 command;
    }

    struct ValidateFlagCollisionResult {
        bool success;
        bytes32 command;
        string flag;
        string[] actions;
    }

    struct ListCommandsOkResult {
        bool success;
        string[] commands;
        string[] subcommands;
    }

    // --- Events ---

    event GenerateCompleted(string variant, string[] commands, string[] files, int256 count);
    event ValidateCompleted(string variant, bytes32 command, string[] actions);
    event ListCommandsCompleted(string variant, string[] commands, string[] subcommands);

    // --- Registration ---

    /// @notice Returns static metadata for this target provider.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory formats)
    {
        name = "cli";
        category = "interface-target";
        formats = new string[](2);
        formats[0] = "typescript";
        formats[1] = "python";
    }

    // --- Actions ---

    /// @notice Generate CLI commands from a concept projection
    function generate(string memory projection, string memory config) external returns (GenerateOkResult memory) {
        require(bytes(projection).length > 0, "Projection cannot be empty");

        bytes32 projHash = keccak256(abi.encodePacked(projection, config));

        // Create a command for this projection
        bytes32 cmdHash = keccak256(abi.encodePacked(projection, generationCount));
        generationCount++;

        string memory cmdName = projection;

        if (!commands[cmdHash]) {
            commands[cmdHash] = true;
            commandsKeys.push(cmdHash);
        }
        commandNames[cmdHash] = cmdName;
        commandConcepts[cmdHash] = projection;

        // Build generated output
        string[] memory cmdList = new string[](1);
        cmdList[0] = cmdName;

        string[] memory files = new string[](2);
        files[0] = string(abi.encodePacked(projection, ".cmd.ts"));
        files[1] = string(abi.encodePacked(projection, ".cmd.py"));

        generatedFiles[projHash] = files;

        // Store concept-level listings
        bytes32 conceptHash = keccak256(abi.encodePacked(projection));
        conceptCommands[conceptHash] = cmdList;

        emit GenerateCompleted("ok", cmdList, files, 0);

        return GenerateOkResult({
            success: true,
            commands: cmdList,
            files: files
        });
    }

    /// @notice Validate a generated CLI command definition
    function validate(bytes32 command) external returns (ValidateOkResult memory) {
        require(commands[command], "Command not found");

        string[] memory noActions = new string[](0);
        emit ValidateCompleted("ok", command, noActions);

        return ValidateOkResult({
            success: true,
            command: command
        });
    }

    /// @notice List all generated commands for a concept
    function listCommands(string memory concept) external returns (ListCommandsOkResult memory) {
        bytes32 conceptHash = keccak256(abi.encodePacked(concept));
        string[] memory cmds = conceptCommands[conceptHash];
        string[] memory subs = conceptSubcommands[conceptHash];

        // If no stored commands, return empty arrays
        if (cmds.length == 0) {
            cmds = new string[](0);
            subs = new string[](0);
        }

        emit ListCommandsCompleted("ok", cmds, subs);

        return ListCommandsOkResult({
            success: true,
            commands: cmds,
            subcommands: subs
        });
    }

}
