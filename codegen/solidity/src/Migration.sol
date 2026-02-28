// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Migration
/// @notice Schema/data migration management with expand-migrate-contract lifecycle.
/// @dev Tracks migrations through plan, expand, migrate, contract phases with rollback support.

contract Migration {

    // --- Storage ---

    enum MigrationPhase { Planned, Expanded, Migrating, Migrated, Contracted, Failed }

    struct MigrationEntry {
        string concept;
        int256 fromVersion;
        int256 toVersion;
        string[] steps;
        int256 estimatedRecords;
        int256 recordsMigrated;
        MigrationPhase phase;
        uint256 progress;
        uint256 createdAt;
        bool exists;
    }

    mapping(bytes32 => MigrationEntry) private _migrations;
    bytes32[] private _migrationIds;
    mapping(bytes32 => bool) private _migrationExists;

    // --- Types ---

    struct PlanInput {
        string concept;
        int256 fromVersion;
        int256 toVersion;
    }

    struct PlanOkResult {
        bool success;
        bytes32 migration;
        string[] steps;
        int256 estimatedRecords;
    }

    struct PlanNoMigrationNeededResult {
        bool success;
        string concept;
    }

    struct PlanIncompatibleResult {
        bool success;
        string concept;
        string reason;
    }

    struct ExpandOkResult {
        bool success;
        bytes32 migration;
    }

    struct ExpandFailedResult {
        bool success;
        bytes32 migration;
        string reason;
    }

    struct MigrateOkResult {
        bool success;
        bytes32 migration;
        int256 recordsMigrated;
    }

    struct MigratePartialResult {
        bool success;
        bytes32 migration;
        int256 migrated;
        int256 failed;
        string[] errors;
    }

    struct ContractOkResult {
        bool success;
        bytes32 migration;
    }

    struct ContractRollbackResult {
        bool success;
        bytes32 migration;
    }

    struct StatusOkResult {
        bool success;
        bytes32 migration;
        string phase;
        uint256 progress;
    }

    // --- Events ---

    event PlanCompleted(string variant, bytes32 migration, string[] steps, int256 estimatedRecords);
    event ExpandCompleted(string variant, bytes32 migration);
    event MigrateCompleted(string variant, bytes32 migration, int256 recordsMigrated, int256 migrated, int256 failed, string[] errors);
    event ContractCompleted(string variant, bytes32 migration);
    event StatusCompleted(string variant, bytes32 migration, uint256 progress);

    // --- Actions ---

    /// @notice plan - Creates a migration plan between schema versions.
    function plan(string memory concept, int256 fromVersion, int256 toVersion) external returns (PlanOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(toVersion > fromVersion, "Target version must be greater than source version");

        bytes32 migrationId = keccak256(abi.encodePacked(concept, fromVersion, toVersion, block.timestamp));

        // Generate migration steps for each version increment
        uint256 stepCount = uint256(toVersion - fromVersion);
        string[] memory steps = new string[](stepCount);
        for (uint256 i = 0; i < stepCount; i++) {
            steps[i] = string(abi.encodePacked("migrate_v", _int256ToString(fromVersion + int256(i)), "_to_v", _int256ToString(fromVersion + int256(i) + 1)));
        }

        int256 estimatedRecords = (toVersion - fromVersion) * 100;

        _migrations[migrationId] = MigrationEntry({
            concept: concept,
            fromVersion: fromVersion,
            toVersion: toVersion,
            steps: steps,
            estimatedRecords: estimatedRecords,
            recordsMigrated: 0,
            phase: MigrationPhase.Planned,
            progress: 0,
            createdAt: block.timestamp,
            exists: true
        });
        _migrationExists[migrationId] = true;
        _migrationIds.push(migrationId);

        emit PlanCompleted("ok", migrationId, steps, estimatedRecords);

        return PlanOkResult({
            success: true,
            migration: migrationId,
            steps: steps,
            estimatedRecords: estimatedRecords
        });
    }

    /// @notice expand - Expands the schema to support both old and new versions.
    function expand(bytes32 migration) external returns (ExpandOkResult memory) {
        require(_migrationExists[migration], "Migration not found");
        MigrationEntry storage m = _migrations[migration];
        require(m.phase == MigrationPhase.Planned, "Migration must be in Planned phase to expand");

        m.phase = MigrationPhase.Expanded;
        m.progress = 25;

        emit ExpandCompleted("ok", migration);

        return ExpandOkResult({
            success: true,
            migration: migration
        });
    }

    /// @notice migrate - Executes the data migration.
    function migrate(bytes32 migration) external returns (MigrateOkResult memory) {
        require(_migrationExists[migration], "Migration not found");
        MigrationEntry storage m = _migrations[migration];
        require(m.phase == MigrationPhase.Expanded, "Migration must be expanded before migrating");

        m.phase = MigrationPhase.Migrated;
        m.recordsMigrated = m.estimatedRecords;
        m.progress = 75;

        string[] memory emptyErrors = new string[](0);
        emit MigrateCompleted("ok", migration, m.recordsMigrated, m.recordsMigrated, 0, emptyErrors);

        return MigrateOkResult({
            success: true,
            migration: migration,
            recordsMigrated: m.recordsMigrated
        });
    }

    /// @notice contractMigration - Contracts the schema to remove old version support.
    /// @dev Named contractMigration to avoid collision with Solidity's contract keyword.
    function contractMigration(bytes32 migration) external returns (ContractOkResult memory) {
        require(_migrationExists[migration], "Migration not found");
        MigrationEntry storage m = _migrations[migration];
        require(m.phase == MigrationPhase.Migrated, "Migration must be migrated before contracting");

        m.phase = MigrationPhase.Contracted;
        m.progress = 100;

        emit ContractCompleted("ok", migration);

        return ContractOkResult({
            success: true,
            migration: migration
        });
    }

    /// @notice status - Returns the current state of a migration.
    function status(bytes32 migration) external returns (StatusOkResult memory) {
        require(_migrationExists[migration], "Migration not found");
        MigrationEntry storage m = _migrations[migration];

        string memory phaseName;
        if (m.phase == MigrationPhase.Planned) phaseName = "planned";
        else if (m.phase == MigrationPhase.Expanded) phaseName = "expanded";
        else if (m.phase == MigrationPhase.Migrating) phaseName = "migrating";
        else if (m.phase == MigrationPhase.Migrated) phaseName = "migrated";
        else if (m.phase == MigrationPhase.Contracted) phaseName = "contracted";
        else phaseName = "failed";

        emit StatusCompleted("ok", migration, m.progress);

        return StatusOkResult({
            success: true,
            migration: migration,
            phase: phaseName,
            progress: m.progress
        });
    }

    // --- Internal helpers ---

    function _int256ToString(int256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        bool negative = value < 0;
        uint256 absValue = negative ? uint256(-value) : uint256(value);
        uint256 temp = absValue;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(negative ? digits + 1 : digits);
        if (negative) buffer[0] = "-";
        uint256 offset = negative ? 1 : 0;
        while (absValue != 0) {
            digits--;
            buffer[offset + digits] = bytes1(uint8(48 + absValue % 10));
            absValue /= 10;
        }
        return string(buffer);
    }
}
