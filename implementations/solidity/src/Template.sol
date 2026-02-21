// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Template
/// @notice Stores reusable template definitions with block trees, variables, and trigger conditions.
contract Template {
    struct TemplateData {
        string blockTree;
        string variables;
        string triggerCondition;
        bool exists;
    }

    mapping(bytes32 => TemplateData) private _templates;

    event TemplateDefined(bytes32 indexed templateId);
    event TriggerRegistered(bytes32 indexed templateId);

    /// @notice Defines a new template.
    /// @param templateId Unique identifier for the template.
    /// @param blockTree Serialised block tree structure.
    /// @param variables Serialised variable definitions.
    function define(bytes32 templateId, string calldata blockTree, string calldata variables) external {
        require(!_templates[templateId].exists, "Template already exists");

        _templates[templateId] = TemplateData({
            blockTree: blockTree,
            variables: variables,
            triggerCondition: "",
            exists: true
        });

        emit TemplateDefined(templateId);
    }

    /// @notice Registers a trigger condition for a template.
    /// @param templateId The template to add a trigger to.
    /// @param condition The trigger condition expression.
    function registerTrigger(bytes32 templateId, string calldata condition) external {
        require(_templates[templateId].exists, "Template does not exist");

        _templates[templateId].triggerCondition = condition;

        emit TriggerRegistered(templateId);
    }

    /// @notice Retrieves template data.
    /// @param templateId The template to look up.
    /// @return The template struct.
    function getTemplate(bytes32 templateId) external view returns (TemplateData memory) {
        require(_templates[templateId].exists, "Template does not exist");
        return _templates[templateId];
    }

    /// @notice Checks whether a template exists.
    /// @param templateId The template to check.
    /// @return True if the template exists.
    function templateExists(bytes32 templateId) external view returns (bool) {
        return _templates[templateId].exists;
    }
}
