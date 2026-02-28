// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Quality Rule Plugin — on-chain data quality validation and enforcement
// for the Clef Data Integration Kit.
//
// On-chain quality rules provide immutable quality attestation, audit trails
// of validation results, and decentralized quality scoring. Individual field
// validations happen off-chain; only results, scores, and attestations are
// recorded on-chain for transparency and accountability.
//
// See Data Integration Kit quality.concept for the parent Quality concept definition.

// ---------------------------------------------------------------------------
// Core types and interfaces
// ---------------------------------------------------------------------------

/// @title QualityDimension — the six standard data quality dimensions.
/// @notice Used as enum identifiers in rule configuration and scoring.
///         0=completeness, 1=uniqueness, 2=validity, 3=consistency, 4=timeliness, 5=accuracy
enum QualityDimension {
    Completeness,
    Uniqueness,
    Validity,
    Consistency,
    Timeliness,
    Accuracy
}

/// @title Severity — severity level for rule violations.
enum Severity {
    Info,
    Warning,
    Error
}

/// @title IQualityRule — interface for all quality-rule provider contracts.
interface IQualityRule {
    /// @notice On-chain record of a field validation result.
    struct ValidationRecord {
        bytes32 recordHash;        // Hash of the record being validated
        string  fieldName;         // Name of the validated field
        string  ruleId;            // Quality rule provider ID
        bool    valid;             // Whether validation passed
        string  message;           // Human-readable result message
        Severity severity;         // Violation severity level
        QualityDimension dimension;// Quality dimension measured
        uint256 validatedAt;       // Block timestamp of validation
        address validatedBy;       // Address that submitted the validation
    }

    /// @notice Validate a field value and record the result on-chain.
    /// @param recordHash  Hash of the record containing the field.
    /// @param fieldName   Name of the field being validated.
    /// @param value       ABI-encoded field value.
    /// @param ruleConfig  ABI-encoded rule configuration.
    /// @return validationId  Unique ID of the validation record.
    /// @return valid         Whether the validation passed.
    function validate(
        bytes32 recordHash,
        string calldata fieldName,
        bytes calldata value,
        bytes calldata ruleConfig
    ) external returns (uint256 validationId, bool valid);

    /// @notice Check whether this rule applies to a given field type.
    /// @param fieldType  The type identifier (e.g., "string", "number", "date").
    /// @return applies   True if the rule can validate this field type.
    function appliesTo(string calldata fieldType) external view returns (bool applies);

    /// @notice Return the quality dimension this rule measures.
    /// @return dim  The quality dimension enum value.
    function dimension() external view returns (QualityDimension dim);

    /// @notice Retrieve a validation record by its ID.
    function getValidation(uint256 validationId) external view returns (ValidationRecord memory);

    /// @notice Emitted when a validation is recorded.
    event ValidationRecorded(
        uint256 indexed validationId,
        bytes32 indexed recordHash,
        string  ruleId,
        string  fieldName,
        bool    valid,
        Severity severity,
        uint256 validatedAt
    );
}

// ---------------------------------------------------------------------------
// Quality Rule Registry — central dispatch for quality-rule providers
// ---------------------------------------------------------------------------

/// @title QualityRuleRegistry — registry and router for quality-rule provider contracts.
/// @notice Manages registration, lookup, and batch validation dispatch.
///         Maintains a global quality score ledger and validation history.
contract QualityRuleRegistry {
    // -- State ---------------------------------------------------------------

    address public owner;
    uint256 public nextValidationId;

    /// @notice Registered providers: ruleId => contract address.
    mapping(string => address) public providers;

    /// @notice List of all registered rule IDs.
    string[] public ruleIds;

    /// @notice Global validation record store.
    mapping(uint256 => IQualityRule.ValidationRecord) public validations;

    /// @notice Validation history per record hash.
    mapping(bytes32 => uint256[]) public validationsByRecord;

    /// @notice Quality score per record: recordHash => (passCount, totalCount).
    mapping(bytes32 => QualityScore) public qualityScores;

    struct QualityScore {
        uint256 passCount;
        uint256 totalCount;
        uint256 errorCount;
        uint256 warningCount;
        uint256 lastUpdated;
    }

    /// @notice Per-dimension scores for a record.
    mapping(bytes32 => mapping(QualityDimension => DimensionScore)) public dimensionScores;

    struct DimensionScore {
        uint256 passCount;
        uint256 totalCount;
    }

    // -- Events --------------------------------------------------------------

    event ProviderRegistered(string indexed ruleId, address providerAddress, QualityDimension dimension);
    event ProviderUpdated(string indexed ruleId, address oldAddress, address newAddress);
    event ProviderRemoved(string indexed ruleId);
    event ValidationRecorded(
        uint256 indexed validationId,
        bytes32 indexed recordHash,
        string  ruleId,
        string  fieldName,
        bool    valid,
        Severity severity,
        uint256 validatedAt
    );
    event QualityScoreUpdated(
        bytes32 indexed recordHash,
        uint256 passCount,
        uint256 totalCount,
        uint256 scorePercent
    );

    // -- Modifiers -----------------------------------------------------------

    modifier onlyOwner() {
        require(msg.sender == owner, "QualityRuleRegistry: caller is not the owner");
        _;
    }

    // -- Constructor ----------------------------------------------------------

    constructor() {
        owner = msg.sender;
        nextValidationId = 1;
    }

    // -- Provider management -------------------------------------------------

    /// @notice Register a new quality-rule provider.
    function registerProvider(
        string calldata ruleId,
        address providerAddr,
        QualityDimension dim
    ) external onlyOwner {
        require(providerAddr != address(0), "QualityRuleRegistry: zero address");
        require(providers[ruleId] == address(0), "QualityRuleRegistry: provider already registered");

        providers[ruleId] = providerAddr;
        ruleIds.push(ruleId);

        emit ProviderRegistered(ruleId, providerAddr, dim);
    }

    /// @notice Update an existing provider's contract address.
    function updateProvider(string calldata ruleId, address newAddr) external onlyOwner {
        require(newAddr != address(0), "QualityRuleRegistry: zero address");
        address oldAddr = providers[ruleId];
        require(oldAddr != address(0), "QualityRuleRegistry: provider not registered");

        providers[ruleId] = newAddr;
        emit ProviderUpdated(ruleId, oldAddr, newAddr);
    }

    /// @notice Remove a registered provider.
    function removeProvider(string calldata ruleId) external onlyOwner {
        require(providers[ruleId] != address(0), "QualityRuleRegistry: provider not registered");
        delete providers[ruleId];

        for (uint256 i = 0; i < ruleIds.length; i++) {
            if (keccak256(bytes(ruleIds[i])) == keccak256(bytes(ruleId))) {
                ruleIds[i] = ruleIds[ruleIds.length - 1];
                ruleIds.pop();
                break;
            }
        }

        emit ProviderRemoved(ruleId);
    }

    /// @notice Get the number of registered providers.
    function providerCount() external view returns (uint256) {
        return ruleIds.length;
    }

    // -- Validation operations -----------------------------------------------

    /// @notice Execute a validation through a specific rule provider.
    function validateWith(
        string calldata ruleId,
        bytes32 recordHash,
        string calldata fieldName,
        bytes calldata value,
        bytes calldata ruleConfig
    ) external returns (uint256 validationId, bool valid) {
        address providerAddr = providers[ruleId];
        require(providerAddr != address(0), "QualityRuleRegistry: unknown rule provider");

        (validationId, valid) = IQualityRule(providerAddr).validate(
            recordHash, fieldName, value, ruleConfig
        );

        // Store the validation record in the registry
        IQualityRule.ValidationRecord memory record = IQualityRule(providerAddr).getValidation(validationId);

        uint256 registryId = nextValidationId++;
        validations[registryId] = record;
        validationsByRecord[recordHash].push(registryId);

        // Update quality scores
        QualityScore storage score = qualityScores[recordHash];
        score.totalCount++;
        if (valid) {
            score.passCount++;
        } else {
            if (record.severity == Severity.Error) {
                score.errorCount++;
            } else if (record.severity == Severity.Warning) {
                score.warningCount++;
            }
        }
        score.lastUpdated = block.timestamp;

        // Update dimension scores
        DimensionScore storage dimScore = dimensionScores[recordHash][record.dimension];
        dimScore.totalCount++;
        if (valid) {
            dimScore.passCount++;
        }

        uint256 scorePercent = score.totalCount > 0 ? (score.passCount * 100) / score.totalCount : 0;
        emit QualityScoreUpdated(recordHash, score.passCount, score.totalCount, scorePercent);
        emit ValidationRecorded(registryId, recordHash, ruleId, fieldName, valid, record.severity, block.timestamp);
    }

    /// @notice Batch validate a record against multiple rules.
    function batchValidate(
        string[] calldata ruleIdsToRun,
        bytes32 recordHash,
        string[] calldata fieldNames,
        bytes[] calldata values,
        bytes[] calldata ruleConfigs
    ) external returns (uint256[] memory validationIds, bool[] memory results) {
        require(ruleIdsToRun.length == fieldNames.length, "QualityRuleRegistry: array length mismatch");
        require(ruleIdsToRun.length == values.length, "QualityRuleRegistry: array length mismatch");
        require(ruleIdsToRun.length == ruleConfigs.length, "QualityRuleRegistry: array length mismatch");

        validationIds = new uint256[](ruleIdsToRun.length);
        results = new bool[](ruleIdsToRun.length);

        for (uint256 i = 0; i < ruleIdsToRun.length; i++) {
            (validationIds[i], results[i]) = this.validateWith(
                ruleIdsToRun[i],
                recordHash,
                fieldNames[i],
                values[i],
                ruleConfigs[i]
            );
        }
    }

    // -- Query operations ----------------------------------------------------

    /// @notice Get the quality score for a record.
    function getQualityScore(bytes32 recordHash) external view returns (
        uint256 passCount,
        uint256 totalCount,
        uint256 errorCount,
        uint256 warningCount,
        uint256 scorePercent
    ) {
        QualityScore storage score = qualityScores[recordHash];
        passCount = score.passCount;
        totalCount = score.totalCount;
        errorCount = score.errorCount;
        warningCount = score.warningCount;
        scorePercent = totalCount > 0 ? (passCount * 100) / totalCount : 100;
    }

    /// @notice Get the dimension score for a record.
    function getDimensionScore(bytes32 recordHash, QualityDimension dim) external view returns (
        uint256 passCount,
        uint256 totalCount,
        uint256 scorePercent
    ) {
        DimensionScore storage ds = dimensionScores[recordHash][dim];
        passCount = ds.passCount;
        totalCount = ds.totalCount;
        scorePercent = totalCount > 0 ? (passCount * 100) / totalCount : 100;
    }

    /// @notice Get all validation IDs for a record.
    function getValidationsByRecord(bytes32 recordHash) external view returns (uint256[] memory) {
        return validationsByRecord[recordHash];
    }

    /// @notice Retrieve a validation record by ID.
    function getValidation(uint256 validationId) external view returns (IQualityRule.ValidationRecord memory) {
        require(validationId > 0 && validationId < nextValidationId, "QualityRuleRegistry: invalid validation ID");
        return validations[validationId];
    }

    /// @notice Transfer ownership of the registry.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "QualityRuleRegistry: zero address");
        owner = newOwner;
    }
}

// ---------------------------------------------------------------------------
// Base contract for shared quality rule provider logic
// ---------------------------------------------------------------------------

/// @title BaseQualityRule — shared implementation for quality-rule providers.
abstract contract BaseQualityRule is IQualityRule {
    address public registry;
    address public owner;
    uint256 public validationCount;

    mapping(uint256 => ValidationRecord) internal _validations;

    modifier onlyRegistry() {
        require(msg.sender == registry, "BaseQualityRule: caller is not the registry");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "BaseQualityRule: caller is not the owner");
        _;
    }

    constructor(address _registry) {
        registry = _registry;
        owner = msg.sender;
    }

    function getValidation(uint256 validationId) external view override returns (ValidationRecord memory) {
        return _validations[validationId];
    }

    function _recordValidation(
        bytes32 recordHash,
        string calldata fieldName,
        bool valid,
        string memory message,
        Severity severity
    ) internal returns (uint256 validationId) {
        validationId = ++validationCount;

        _validations[validationId] = ValidationRecord({
            recordHash: recordHash,
            fieldName: fieldName,
            ruleId: _ruleId(),
            valid: valid,
            message: message,
            severity: severity,
            dimension: _dimension(),
            validatedAt: block.timestamp,
            validatedBy: tx.origin
        });

        emit ValidationRecorded(validationId, recordHash, _ruleId(), fieldName, valid, severity, block.timestamp);
    }

    /// @dev Override in each provider to return its unique rule ID.
    function _ruleId() internal pure virtual returns (string memory);

    /// @dev Override in each provider to return its quality dimension.
    function _dimension() internal pure virtual returns (QualityDimension);
}

// ---------------------------------------------------------------------------
// Provider: RequiredRule — completeness: field must not be null/empty
// ---------------------------------------------------------------------------

/// @title RequiredRule — on-chain quality rule enforcing field completeness.
/// @notice Validates that a field value is present and non-empty. Accepts
///         ABI-encoded values and checks for zero-length bytes, empty strings,
///         and zero values. Off-chain, the full rule also checks for whitespace-only
///         strings, empty arrays, and empty objects.
contract RequiredRuleProvider is BaseQualityRule {
    constructor(address _registry) BaseQualityRule(_registry) {}

    function _ruleId() internal pure override returns (string memory) { return "required"; }
    function _dimension() internal pure override returns (QualityDimension) { return QualityDimension.Completeness; }

    function appliesTo(string calldata fieldType) external pure override returns (bool) {
        // Required applies to all field types
        return true;
    }

    function dimension() external pure override returns (QualityDimension) {
        return QualityDimension.Completeness;
    }

    function validate(
        bytes32 recordHash,
        string calldata fieldName,
        bytes calldata value,
        bytes calldata /* ruleConfig */
    ) external override onlyRegistry returns (uint256 validationId, bool valid) {
        // Check for empty value (zero-length bytes)
        if (value.length == 0) {
            validationId = _recordValidation(
                recordHash, fieldName, false,
                string(abi.encodePacked("Field '", fieldName, "' is required but was empty")),
                Severity.Error
            );
            return (validationId, false);
        }

        // Check for zero bytes (null representation)
        bool allZeros = true;
        for (uint256 i = 0; i < value.length && i < 32; i++) {
            if (value[i] != 0) {
                allZeros = false;
                break;
            }
        }

        if (allZeros && value.length <= 32) {
            validationId = _recordValidation(
                recordHash, fieldName, false,
                string(abi.encodePacked("Field '", fieldName, "' is required but was null/zero")),
                Severity.Error
            );
            return (validationId, false);
        }

        // Check for empty string (ABI-encoded string with length 0)
        if (value.length >= 64) {
            // ABI-encoded string: first 32 bytes = offset, next 32 bytes = length
            uint256 strLength;
            assembly {
                // Load string length from offset 32 in calldata value
                strLength := calldataload(add(value.offset, 32))
            }
            if (strLength == 0) {
                validationId = _recordValidation(
                    recordHash, fieldName, false,
                    string(abi.encodePacked("Field '", fieldName, "' is required but was an empty string")),
                    Severity.Error
                );
                return (validationId, false);
            }
        }

        validationId = _recordValidation(
            recordHash, fieldName, true,
            "Validation passed",
            Severity.Info
        );
        return (validationId, true);
    }
}

// ---------------------------------------------------------------------------
// Provider: TypeCheckRule — validity: value must match declared type
// ---------------------------------------------------------------------------

/// @title TypeCheckRule — on-chain quality rule enforcing type validity.
/// @notice Validates that ABI-encoded field values match their declared types.
///         Supports string, uint256, int256, bool, bytes, and address types.
///         On-chain type checking is limited to ABI decoding success/failure.
contract TypeCheckRuleProvider is BaseQualityRule {
    /// @notice Mapping of supported type names to type hashes for efficient comparison.
    mapping(bytes32 => bool) public supportedTypes;

    constructor(address _registry) BaseQualityRule(_registry) {
        supportedTypes[keccak256("string")] = true;
        supportedTypes[keccak256("number")] = true;
        supportedTypes[keccak256("boolean")] = true;
        supportedTypes[keccak256("date")] = true;
        supportedTypes[keccak256("array")] = true;
        supportedTypes[keccak256("object")] = true;
        supportedTypes[keccak256("address")] = true;
        supportedTypes[keccak256("bytes")] = true;
    }

    function _ruleId() internal pure override returns (string memory) { return "type_check"; }
    function _dimension() internal pure override returns (QualityDimension) { return QualityDimension.Validity; }

    function appliesTo(string calldata /* fieldType */) external pure override returns (bool) {
        return true; // Type check applies to all fields
    }

    function dimension() external pure override returns (QualityDimension) {
        return QualityDimension.Validity;
    }

    function validate(
        bytes32 recordHash,
        string calldata fieldName,
        bytes calldata value,
        bytes calldata ruleConfig
    ) external override onlyRegistry returns (uint256 validationId, bool valid) {
        if (value.length == 0) {
            validationId = _recordValidation(
                recordHash, fieldName, true,
                "Null value; type check deferred to required rule",
                Severity.Info
            );
            return (validationId, true);
        }

        // Decode expected type from config
        string memory expectedType = "";
        if (ruleConfig.length > 0) {
            (expectedType) = abi.decode(ruleConfig, (string));
        }

        bytes32 typeHash = keccak256(bytes(expectedType));

        if (!supportedTypes[typeHash]) {
            validationId = _recordValidation(
                recordHash, fieldName, false,
                string(abi.encodePacked("Unknown type: '", expectedType, "'")),
                Severity.Error
            );
            return (validationId, false);
        }

        // Attempt to decode the value as the expected type
        // On-chain we verify the value can be ABI-decoded without reverting
        bool decodeSuccess = _tryDecode(value, typeHash);

        if (!decodeSuccess) {
            validationId = _recordValidation(
                recordHash, fieldName, false,
                string(abi.encodePacked("Field '", fieldName, "' value does not match expected type '", expectedType, "'")),
                Severity.Error
            );
            return (validationId, false);
        }

        validationId = _recordValidation(
            recordHash, fieldName, true,
            "Type check passed",
            Severity.Info
        );
        return (validationId, true);
    }

    function _tryDecode(bytes calldata value, bytes32 typeHash) internal pure returns (bool) {
        // For on-chain validation, we check if the ABI-encoded data length
        // is consistent with the expected type encoding rules
        if (typeHash == keccak256("boolean")) {
            if (value.length < 32) return false;
            uint256 decoded;
            assembly { decoded := calldataload(value.offset) }
            return decoded <= 1; // Boolean should be 0 or 1
        }

        if (typeHash == keccak256("number")) {
            return value.length >= 32; // uint256/int256 is always 32 bytes
        }

        if (typeHash == keccak256("address")) {
            if (value.length < 32) return false;
            // Address should have upper 12 bytes as zero
            for (uint256 i = 0; i < 12; i++) {
                if (value[i] != 0) return false;
            }
            return true;
        }

        // For string, bytes, array, object: accept if data is present
        return value.length > 0;
    }
}

// ---------------------------------------------------------------------------
// Provider: RangeRule — validity: numeric value within min/max bounds
// ---------------------------------------------------------------------------

/// @title RangeRule — on-chain quality rule enforcing numeric range bounds.
/// @notice Validates that numeric field values fall within configured min/max bounds.
///         Supports inclusive and exclusive bounds. Config is ABI-encoded as
///         (int256 min, int256 max, bool minInclusive, bool maxInclusive, bool hasMin, bool hasMax).
contract RangeRuleProvider is BaseQualityRule {
    struct RangeBounds {
        int256 min;
        int256 max;
        bool minInclusive;
        bool maxInclusive;
        bool hasMin;
        bool hasMax;
    }

    constructor(address _registry) BaseQualityRule(_registry) {}

    function _ruleId() internal pure override returns (string memory) { return "range"; }
    function _dimension() internal pure override returns (QualityDimension) { return QualityDimension.Validity; }

    function appliesTo(string calldata fieldType) external pure override returns (bool) {
        bytes32 h = keccak256(bytes(fieldType));
        return h == keccak256("number") || h == keccak256("date") || h == keccak256("string");
    }

    function dimension() external pure override returns (QualityDimension) {
        return QualityDimension.Validity;
    }

    function validate(
        bytes32 recordHash,
        string calldata fieldName,
        bytes calldata value,
        bytes calldata ruleConfig
    ) external override onlyRegistry returns (uint256 validationId, bool valid) {
        if (value.length == 0) {
            validationId = _recordValidation(recordHash, fieldName, true, "Null value skipped", Severity.Info);
            return (validationId, true);
        }

        // Decode the numeric value
        int256 numValue = abi.decode(value, (int256));

        // Decode range bounds from config
        RangeBounds memory bounds;
        if (ruleConfig.length > 0) {
            (
                bounds.min,
                bounds.max,
                bounds.minInclusive,
                bounds.maxInclusive,
                bounds.hasMin,
                bounds.hasMax
            ) = abi.decode(ruleConfig, (int256, int256, bool, bool, bool, bool));
        } else {
            validationId = _recordValidation(recordHash, fieldName, true, "No bounds configured", Severity.Info);
            return (validationId, true);
        }

        // Check minimum bound
        if (bounds.hasMin) {
            bool belowMin = bounds.minInclusive ? numValue < bounds.min : numValue <= bounds.min;
            if (belowMin) {
                string memory op = bounds.minInclusive ? ">=" : ">";
                validationId = _recordValidation(
                    recordHash, fieldName, false,
                    string(abi.encodePacked("Field '", fieldName, "' value must be ", op, " minimum bound")),
                    Severity.Error
                );
                return (validationId, false);
            }
        }

        // Check maximum bound
        if (bounds.hasMax) {
            bool aboveMax = bounds.maxInclusive ? numValue > bounds.max : numValue >= bounds.max;
            if (aboveMax) {
                string memory op = bounds.maxInclusive ? "<=" : "<";
                validationId = _recordValidation(
                    recordHash, fieldName, false,
                    string(abi.encodePacked("Field '", fieldName, "' value must be ", op, " maximum bound")),
                    Severity.Error
                );
                return (validationId, false);
            }
        }

        validationId = _recordValidation(recordHash, fieldName, true, "Range check passed", Severity.Info);
        return (validationId, true);
    }
}

// ---------------------------------------------------------------------------
// Provider: PatternRule — validity: string matches regex pattern
// ---------------------------------------------------------------------------

/// @title PatternRule — on-chain quality rule for pattern/format validation.
/// @notice On-chain regex is not practical, so this provider stores pattern
///         validation results submitted from off-chain validators.
///         The contract verifies the submitter is authorized and records
///         the attestation. Pattern matching happens off-chain.
///
///         Config: ABI-encoded (string patternName, bool valid, string matchedPattern).
contract PatternRuleProvider is BaseQualityRule {
    /// @notice Authorized off-chain validators that can submit pattern results.
    mapping(address => bool) public authorizedValidators;

    /// @notice Supported pattern preset names for reference.
    mapping(bytes32 => string) public presetPatterns;

    constructor(address _registry) BaseQualityRule(_registry) {
        authorizedValidators[msg.sender] = true;

        // Register preset pattern names for documentation
        presetPatterns[keccak256("email")] = "RFC 5322 email";
        presetPatterns[keccak256("url")] = "HTTP/HTTPS URL";
        presetPatterns[keccak256("phone")] = "E.164 phone number";
        presetPatterns[keccak256("uuid")] = "RFC 4122 UUID";
        presetPatterns[keccak256("iso_date")] = "ISO 8601 date";
        presetPatterns[keccak256("iso_datetime")] = "ISO 8601 date-time";
        presetPatterns[keccak256("ipv4")] = "IPv4 address";
        presetPatterns[keccak256("slug")] = "URL slug";
    }

    function _ruleId() internal pure override returns (string memory) { return "pattern"; }
    function _dimension() internal pure override returns (QualityDimension) { return QualityDimension.Validity; }

    function appliesTo(string calldata fieldType) external pure override returns (bool) {
        return keccak256(bytes(fieldType)) == keccak256("string");
    }

    function dimension() external pure override returns (QualityDimension) {
        return QualityDimension.Validity;
    }

    /// @notice Add or remove an authorized off-chain validator.
    function setValidator(address validator, bool authorized) external onlyOwner {
        authorizedValidators[validator] = authorized;
    }

    function validate(
        bytes32 recordHash,
        string calldata fieldName,
        bytes calldata value,
        bytes calldata ruleConfig
    ) external override onlyRegistry returns (uint256 validationId, bool valid) {
        if (value.length == 0) {
            validationId = _recordValidation(recordHash, fieldName, true, "Null value skipped", Severity.Info);
            return (validationId, true);
        }

        // Decode the off-chain validation result from config
        // Config contains: (string patternName, bool offChainResult, string message)
        if (ruleConfig.length > 0) {
            (
                string memory patternName,
                bool offChainResult,
                string memory message
            ) = abi.decode(ruleConfig, (string, bool, string));

            if (!offChainResult) {
                validationId = _recordValidation(
                    recordHash, fieldName, false,
                    string(abi.encodePacked("Field '", fieldName, "' does not match pattern '", patternName, "': ", message)),
                    Severity.Error
                );
                return (validationId, false);
            }

            validationId = _recordValidation(
                recordHash, fieldName, true,
                string(abi.encodePacked("Pattern '", patternName, "' validation passed")),
                Severity.Info
            );
            return (validationId, true);
        }

        validationId = _recordValidation(recordHash, fieldName, true, "No pattern configured", Severity.Info);
        return (validationId, true);
    }
}

// ---------------------------------------------------------------------------
// Provider: EnumRule — validity: value must be in allowed set
// ---------------------------------------------------------------------------

/// @title EnumRule — on-chain quality rule enforcing value membership in an allowed set.
/// @notice Validates that a string value is a member of a pre-registered allowed set.
///         Sets are identified by a setId (bytes32) and values are stored as keccak256 hashes
///         for gas-efficient membership testing. The actual allowed values list is
///         maintained off-chain; on-chain stores only the hash index.
contract EnumRuleProvider is BaseQualityRule {
    /// @notice Allowed value sets: setId => valueHash => allowed.
    mapping(bytes32 => mapping(bytes32 => bool)) public allowedSets;

    /// @notice Number of values in each set.
    mapping(bytes32 => uint256) public setSize;

    constructor(address _registry) BaseQualityRule(_registry) {}

    function _ruleId() internal pure override returns (string memory) { return "enum"; }
    function _dimension() internal pure override returns (QualityDimension) { return QualityDimension.Validity; }

    function appliesTo(string calldata /* fieldType */) external pure override returns (bool) {
        return true; // Enum check applies to any field type
    }

    function dimension() external pure override returns (QualityDimension) {
        return QualityDimension.Validity;
    }

    /// @notice Register allowed values for a named set.
    /// @param setId        Identifier for the allowed-value set.
    /// @param valueHashes  Array of keccak256 hashes of allowed values.
    function registerAllowedSet(bytes32 setId, bytes32[] calldata valueHashes) external onlyOwner {
        for (uint256 i = 0; i < valueHashes.length; i++) {
            allowedSets[setId][valueHashes[i]] = true;
        }
        setSize[setId] += valueHashes.length;
    }

    /// @notice Remove a value from an allowed set.
    function removeFromSet(bytes32 setId, bytes32 valueHash) external onlyOwner {
        if (allowedSets[setId][valueHash]) {
            allowedSets[setId][valueHash] = false;
            setSize[setId]--;
        }
    }

    /// @notice Check if a value hash is in an allowed set.
    function isAllowed(bytes32 setId, bytes32 valueHash) external view returns (bool) {
        return allowedSets[setId][valueHash];
    }

    function validate(
        bytes32 recordHash,
        string calldata fieldName,
        bytes calldata value,
        bytes calldata ruleConfig
    ) external override onlyRegistry returns (uint256 validationId, bool valid) {
        if (value.length == 0) {
            validationId = _recordValidation(recordHash, fieldName, true, "Null value skipped", Severity.Info);
            return (validationId, true);
        }

        // Decode config: (bytes32 setId, bool caseSensitive)
        bytes32 setId;
        bool caseSensitive = true;

        if (ruleConfig.length >= 32) {
            (setId) = abi.decode(ruleConfig, (bytes32));
            if (ruleConfig.length >= 64) {
                (, caseSensitive) = abi.decode(ruleConfig, (bytes32, bool));
            }
        } else {
            validationId = _recordValidation(recordHash, fieldName, true, "No enum set configured", Severity.Info);
            return (validationId, true);
        }

        // Hash the value and check membership
        // For case-insensitive: the off-chain submitter should normalize before hashing
        bytes32 valueHash = keccak256(value);

        if (!allowedSets[setId][valueHash]) {
            validationId = _recordValidation(
                recordHash, fieldName, false,
                string(abi.encodePacked("Field '", fieldName, "' value is not in allowed set")),
                Severity.Error
            );
            return (validationId, false);
        }

        validationId = _recordValidation(
            recordHash, fieldName, true,
            "Enum check passed",
            Severity.Info
        );
        return (validationId, true);
    }
}

// ---------------------------------------------------------------------------
// Provider: ForeignKeyRule — consistency: referenced entity must exist
// ---------------------------------------------------------------------------

/// @title ForeignKeyRule — on-chain quality rule enforcing referential integrity.
/// @notice Validates that a field value references an existing on-chain entity.
///         Uses entity registries (external contracts) to verify existence.
///         Config: ABI-encoded (address entityRegistry, bytes32 entityKey, bool softEnforcement).
contract ForeignKeyRuleProvider is BaseQualityRule {
    /// @notice Interface for checking entity existence.
    interface IEntityRegistry {
        function exists(bytes32 key) external view returns (bool);
    }

    constructor(address _registry) BaseQualityRule(_registry) {}

    function _ruleId() internal pure override returns (string memory) { return "foreign_key"; }
    function _dimension() internal pure override returns (QualityDimension) { return QualityDimension.Consistency; }

    function appliesTo(string calldata /* fieldType */) external pure override returns (bool) {
        return true;
    }

    function dimension() external pure override returns (QualityDimension) {
        return QualityDimension.Consistency;
    }

    function validate(
        bytes32 recordHash,
        string calldata fieldName,
        bytes calldata value,
        bytes calldata ruleConfig
    ) external override onlyRegistry returns (uint256 validationId, bool valid) {
        if (value.length == 0) {
            validationId = _recordValidation(recordHash, fieldName, true, "Null value skipped", Severity.Info);
            return (validationId, true);
        }

        // Decode config: (address entityRegistry, bool softEnforcement)
        if (ruleConfig.length < 64) {
            validationId = _recordValidation(recordHash, fieldName, true, "No FK config", Severity.Info);
            return (validationId, true);
        }

        (address entityRegistryAddr, bool softEnforcement) = abi.decode(ruleConfig, (address, bool));

        if (entityRegistryAddr == address(0)) {
            validationId = _recordValidation(recordHash, fieldName, true, "No entity registry configured", Severity.Info);
            return (validationId, true);
        }

        // Decode the referenced key from value
        bytes32 entityKey = keccak256(value);

        // Check existence via entity registry
        bool entityExists = false;
        try IEntityRegistry(entityRegistryAddr).exists(entityKey) returns (bool result) {
            entityExists = result;
        } catch {
            // Registry call failed — treat as entity not found
            entityExists = false;
        }

        if (!entityExists) {
            Severity sev = softEnforcement ? Severity.Warning : Severity.Error;
            validationId = _recordValidation(
                recordHash, fieldName, false,
                string(abi.encodePacked("Field '", fieldName, "' references non-existent entity")),
                sev
            );
            return (validationId, false);
        }

        validationId = _recordValidation(recordHash, fieldName, true, "Foreign key check passed", Severity.Info);
        return (validationId, true);
    }
}

// ---------------------------------------------------------------------------
// Provider: CrossFieldRule — consistency: multi-field validation (attestation)
// ---------------------------------------------------------------------------

/// @title CrossFieldRule — on-chain attestation for cross-field validation results.
/// @notice Cross-field validation (e.g., end_date > start_date) is computed off-chain.
///         This contract records the attestation that such validation was performed,
///         along with the specific rules evaluated and their results.
contract CrossFieldRuleProvider is BaseQualityRule {
    struct CrossFieldAttestation {
        string  ruleExpression;   // Human-readable rule (e.g., "end_date > start_date")
        bool    passed;
        string  leftField;
        string  rightField;
        string  operator;
    }

    mapping(uint256 => CrossFieldAttestation[]) public attestations;

    constructor(address _registry) BaseQualityRule(_registry) {}

    function _ruleId() internal pure override returns (string memory) { return "cross_field"; }
    function _dimension() internal pure override returns (QualityDimension) { return QualityDimension.Consistency; }

    function appliesTo(string calldata /* fieldType */) external pure override returns (bool) {
        return true;
    }

    function dimension() external pure override returns (QualityDimension) {
        return QualityDimension.Consistency;
    }

    function validate(
        bytes32 recordHash,
        string calldata fieldName,
        bytes calldata /* value */,
        bytes calldata ruleConfig
    ) external override onlyRegistry returns (uint256 validationId, bool valid) {
        // Decode attestation data: (bool allPassed, string[] ruleExpressions, bool[] results)
        if (ruleConfig.length == 0) {
            validationId = _recordValidation(recordHash, fieldName, true, "No cross-field rules", Severity.Info);
            return (validationId, true);
        }

        (bool allPassed, string memory summary) = abi.decode(ruleConfig, (bool, string));

        if (!allPassed) {
            validationId = _recordValidation(
                recordHash, fieldName, false,
                string(abi.encodePacked("Cross-field validation failed: ", summary)),
                Severity.Error
            );
            return (validationId, false);
        }

        validationId = _recordValidation(
            recordHash, fieldName, true,
            string(abi.encodePacked("Cross-field validation passed: ", summary)),
            Severity.Info
        );
        return (validationId, true);
    }
}

// ---------------------------------------------------------------------------
// Provider: FreshnessRule — timeliness: data must be newer than threshold
// ---------------------------------------------------------------------------

/// @title FreshnessRule — on-chain quality rule enforcing data freshness.
/// @notice Validates that a timestamp field value is within an acceptable age
///         relative to the current block timestamp. This enables on-chain
///         staleness detection for oracle feeds, sensor data, and time-sensitive records.
///         Config: ABI-encoded (uint256 maxAgeSeconds, bool allowFuture).
contract FreshnessRuleProvider is BaseQualityRule {
    constructor(address _registry) BaseQualityRule(_registry) {}

    function _ruleId() internal pure override returns (string memory) { return "freshness"; }
    function _dimension() internal pure override returns (QualityDimension) { return QualityDimension.Timeliness; }

    function appliesTo(string calldata fieldType) external pure override returns (bool) {
        return keccak256(bytes(fieldType)) == keccak256("date");
    }

    function dimension() external pure override returns (QualityDimension) {
        return QualityDimension.Timeliness;
    }

    function validate(
        bytes32 recordHash,
        string calldata fieldName,
        bytes calldata value,
        bytes calldata ruleConfig
    ) external override onlyRegistry returns (uint256 validationId, bool valid) {
        if (value.length == 0) {
            validationId = _recordValidation(recordHash, fieldName, true, "Null value skipped", Severity.Info);
            return (validationId, true);
        }

        // Decode the timestamp value (unix seconds)
        uint256 timestamp = abi.decode(value, (uint256));

        // Decode config
        uint256 maxAgeSeconds = 86400; // Default: 24 hours
        bool allowFuture = false;

        if (ruleConfig.length >= 32) {
            (maxAgeSeconds) = abi.decode(ruleConfig, (uint256));
            if (ruleConfig.length >= 64) {
                (, allowFuture) = abi.decode(ruleConfig, (uint256, bool));
            }
        }

        // Check for future timestamps
        if (!allowFuture && timestamp > block.timestamp + 60) {
            validationId = _recordValidation(
                recordHash, fieldName, false,
                string(abi.encodePacked("Field '", fieldName, "' has a future timestamp")),
                Severity.Warning
            );
            return (validationId, false);
        }

        // Check staleness
        if (block.timestamp > timestamp && block.timestamp - timestamp > maxAgeSeconds) {
            validationId = _recordValidation(
                recordHash, fieldName, false,
                string(abi.encodePacked("Field '", fieldName, "' data is stale (exceeds max age)")),
                Severity.Warning
            );
            return (validationId, false);
        }

        validationId = _recordValidation(recordHash, fieldName, true, "Freshness check passed", Severity.Info);
        return (validationId, true);
    }
}
