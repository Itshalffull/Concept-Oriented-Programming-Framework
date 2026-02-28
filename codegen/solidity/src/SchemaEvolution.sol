// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SchemaEvolution
/// @notice Versioned schema definitions with compatibility guarantees.
contract SchemaEvolution {
    struct SchemaRecord {
        bytes32 subject;
        uint256 version;
        bytes schema;
        string compatibility;
        bool exists;
    }

    mapping(bytes32 => SchemaRecord) private _schemas;
    mapping(bytes32 => uint256) private _subjectVersionCount;
    mapping(bytes32 => mapping(uint256 => bytes32)) private _subjectVersions;
    uint256 private _nonce;

    event SchemaRegistered(bytes32 indexed schemaId, bytes32 indexed subject, uint256 version);
    event CompatibilityChecked(bytes32 indexed oldSchemaId, bytes32 indexed newSchemaId, bool compatible);
    event SchemaUpcast(bytes32 indexed subject, uint256 fromVersion, uint256 toVersion);

    /// @notice Registers a new schema version for a subject.
    /// @param subject The subject identifier (e.g. topic or entity type).
    /// @param schema The encoded schema data.
    /// @param compatibility The compatibility mode (e.g. "backward", "forward", "full", "none").
    /// @return version The auto-incremented version number.
    /// @return schemaId The unique identifier of the registered schema.
    function register(
        string calldata subject,
        bytes calldata schema,
        string calldata compatibility
    ) external returns (uint256 version, bytes32 schemaId) {
        bytes32 subjectHash = keccak256(abi.encodePacked(subject));

        version = _subjectVersionCount[subjectHash] + 1;
        _subjectVersionCount[subjectHash] = version;

        schemaId = keccak256(abi.encodePacked(subjectHash, version, _nonce++));

        _schemas[schemaId] = SchemaRecord({
            subject: subjectHash,
            version: version,
            schema: schema,
            compatibility: compatibility,
            exists: true
        });

        _subjectVersions[subjectHash][version] = schemaId;

        emit SchemaRegistered(schemaId, subjectHash, version);
    }

    /// @notice Checks compatibility between two schemas.
    /// @param oldSchemaId The existing schema ID.
    /// @param newSchemaId The proposed schema ID.
    /// @param mode The compatibility mode to check against.
    /// @return compatible Whether the schemas are compatible under the given mode.
    function check(
        bytes32 oldSchemaId,
        bytes32 newSchemaId,
        string calldata mode
    ) external returns (bool compatible) {
        require(_schemas[oldSchemaId].exists, "Old schema not found");
        require(_schemas[newSchemaId].exists, "New schema not found");

        // On-chain compatibility checking is limited; emit event for off-chain verification.
        // For "none" mode, always compatible. Otherwise, signal for off-chain validation.
        compatible = keccak256(abi.encodePacked(mode)) == keccak256(abi.encodePacked("none"));

        emit CompatibilityChecked(oldSchemaId, newSchemaId, compatible);
    }

    /// @notice Requests an upcast transformation between schema versions.
    /// @param subject The subject name.
    /// @param fromVersion The source version.
    /// @param toVersion The target version.
    /// @return data The schema data from the target version (actual transformation is off-chain).
    function upcast(
        string calldata subject,
        uint256 fromVersion,
        uint256 toVersion
    ) external returns (bytes memory data) {
        bytes32 subjectHash = keccak256(abi.encodePacked(subject));

        require(fromVersion > 0 && fromVersion <= _subjectVersionCount[subjectHash], "Invalid fromVersion");
        require(toVersion > 0 && toVersion <= _subjectVersionCount[subjectHash], "Invalid toVersion");
        require(toVersion > fromVersion, "toVersion must be greater than fromVersion");

        bytes32 targetSchemaId = _subjectVersions[subjectHash][toVersion];
        data = _schemas[targetSchemaId].schema;

        emit SchemaUpcast(subjectHash, fromVersion, toVersion);
    }

    /// @notice Retrieves a schema by subject name and version number.
    /// @param subject The subject name.
    /// @param version The version number to retrieve.
    /// @return schema The encoded schema data.
    /// @return compatibility The compatibility mode.
    function getSchema(
        string calldata subject,
        uint256 version
    ) external view returns (bytes memory schema, string memory compatibility) {
        bytes32 subjectHash = keccak256(abi.encodePacked(subject));
        bytes32 schemaId = _subjectVersions[subjectHash][version];
        require(_schemas[schemaId].exists, "Schema not found");

        SchemaRecord storage rec = _schemas[schemaId];
        return (rec.schema, rec.compatibility);
    }

    /// @notice Returns the latest version number for a subject.
    /// @param subject The subject name.
    /// @return The latest version number (0 if none registered).
    function latestVersion(string calldata subject) external view returns (uint256) {
        bytes32 subjectHash = keccak256(abi.encodePacked(subject));
        return _subjectVersionCount[subjectHash];
    }
}
