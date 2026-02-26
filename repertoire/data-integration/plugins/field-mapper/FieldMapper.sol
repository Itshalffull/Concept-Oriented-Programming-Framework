// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Field Mapper Plugin — on-chain field mapping registry and provider implementations
// for the FieldMapping concept in the Clef Data Integration Kit.
//
// On-chain field mappers handle path resolution for data stored in contract storage
// and mapping-table lookups. Full JSONPath/XPath processing happens off-chain; the
// on-chain contracts provide verifiable mapping records, registry management, and
// key path-resolution primitives (direct key mapping, template interpolation).
//
// See Data Integration Kit field-mapping.concept for the parent FieldMapping concept definition.

// ---------------------------------------------------------------------------
// Core types and interfaces
// ---------------------------------------------------------------------------

/// @title IFieldMapper — interface for all field-mapper provider contracts.
interface IFieldMapper {
    /// @notice Metadata about a field mapping operation recorded on-chain.
    struct MappingRecord {
        bytes32 recordHash;         // Hash of the source record
        string  providerId;         // e.g., "direct", "jsonpath"
        string  sourcePath;         // The path expression used
        string  resolvedValue;      // The resolved value (string representation)
        uint256 resolvedAt;         // Block timestamp of resolution
        address resolvedBy;         // Address that performed the resolution
        bytes   extraData;          // ABI-encoded provider-specific metadata
    }

    /// @notice Resolve a source path against a record stored on-chain.
    /// @param recordHash   Hash identifying the source record.
    /// @param sourcePath   The path expression to resolve.
    /// @param extraData    ABI-encoded provider-specific parameters.
    /// @return resolvedValue  The resolved value as a string.
    /// @return resolutionId   Unique identifier for this resolution record.
    function resolve(
        bytes32 recordHash,
        string calldata sourcePath,
        bytes calldata extraData
    ) external returns (string memory resolvedValue, uint256 resolutionId);

    /// @notice Check whether this provider supports the given path syntax.
    /// @param pathSyntax   A path expression string.
    /// @return supported   True if this provider can interpret the syntax.
    function supports(string calldata pathSyntax) external view returns (bool supported);

    /// @notice Retrieve a mapping resolution record by its ID.
    /// @param resolutionId  The unique resolution identifier.
    /// @return record       The mapping record.
    function getResolution(uint256 resolutionId) external view returns (MappingRecord memory record);

    /// @notice Emitted when a field mapping resolution is recorded.
    event FieldResolved(
        uint256 indexed resolutionId,
        address indexed resolvedBy,
        string  providerId,
        bytes32 recordHash,
        string  sourcePath,
        string  resolvedValue,
        uint256 resolvedAt
    );
}

// ---------------------------------------------------------------------------
// Field Mapper Registry — central dispatch for provider contracts
// ---------------------------------------------------------------------------

/// @title FieldMapperRegistry — registry and router for field-mapper provider contracts.
/// @notice Manages registration, lookup, and dispatch to provider implementations.
///         Maintains a global resolution log and key-value record store for on-chain
///         field mapping operations.
contract FieldMapperRegistry {
    // -- State ---------------------------------------------------------------

    address public owner;
    uint256 public nextResolutionId;

    /// @notice Registered providers: providerId => contract address.
    mapping(string => address) public providers;

    /// @notice List of all registered provider IDs.
    string[] public providerIds;

    /// @notice Global resolution record store.
    mapping(uint256 => IFieldMapper.MappingRecord) public resolutions;

    /// @notice On-chain key-value record store: recordHash => (key => value).
    mapping(bytes32 => mapping(string => string)) public recordStore;

    /// @notice Record field listing: recordHash => field keys.
    mapping(bytes32 => string[]) public recordFields;

    /// @notice Resolutions by address.
    mapping(address => uint256[]) public resolutionsByAddress;

    /// @notice Resolution count per provider.
    mapping(string => uint256) public resolutionCountByProvider;

    // -- Events --------------------------------------------------------------

    event ProviderRegistered(string indexed providerId, address providerAddress);
    event ProviderUpdated(string indexed providerId, address oldAddress, address newAddress);
    event ProviderRemoved(string indexed providerId);
    event RecordStored(bytes32 indexed recordHash, address indexed storedBy, uint256 fieldCount);
    event RecordFieldUpdated(bytes32 indexed recordHash, string key);
    event FieldResolved(
        uint256 indexed resolutionId,
        address indexed resolvedBy,
        string  providerId,
        bytes32 recordHash,
        string  sourcePath,
        string  resolvedValue,
        uint256 resolvedAt
    );

    // -- Modifiers -----------------------------------------------------------

    modifier onlyOwner() {
        require(msg.sender == owner, "FieldMapperRegistry: caller is not the owner");
        _;
    }

    // -- Constructor ----------------------------------------------------------

    constructor() {
        owner = msg.sender;
        nextResolutionId = 1;
    }

    // -- Provider management -------------------------------------------------

    /// @notice Register a new field-mapper provider.
    /// @param providerId   Unique identifier (e.g., "direct", "template").
    /// @param providerAddr Address of the provider contract implementing IFieldMapper.
    function registerProvider(string calldata providerId, address providerAddr) external onlyOwner {
        require(providerAddr != address(0), "FieldMapperRegistry: zero address");
        require(providers[providerId] == address(0), "FieldMapperRegistry: provider already registered");

        providers[providerId] = providerAddr;
        providerIds.push(providerId);

        emit ProviderRegistered(providerId, providerAddr);
    }

    /// @notice Update an existing provider's contract address.
    function updateProvider(string calldata providerId, address newAddr) external onlyOwner {
        require(newAddr != address(0), "FieldMapperRegistry: zero address");
        address oldAddr = providers[providerId];
        require(oldAddr != address(0), "FieldMapperRegistry: provider not registered");

        providers[providerId] = newAddr;
        emit ProviderUpdated(providerId, oldAddr, newAddr);
    }

    /// @notice Remove a registered provider.
    function removeProvider(string calldata providerId) external onlyOwner {
        require(providers[providerId] != address(0), "FieldMapperRegistry: provider not registered");
        delete providers[providerId];

        for (uint256 i = 0; i < providerIds.length; i++) {
            if (keccak256(bytes(providerIds[i])) == keccak256(bytes(providerId))) {
                providerIds[i] = providerIds[providerIds.length - 1];
                providerIds.pop();
                break;
            }
        }

        emit ProviderRemoved(providerId);
    }

    /// @notice Get the number of registered providers.
    function providerCount() external view returns (uint256) {
        return providerIds.length;
    }

    /// @notice Check if a provider supports a given path syntax.
    function providerSupports(string calldata providerId, string calldata pathSyntax) external view returns (bool) {
        address providerAddr = providers[providerId];
        if (providerAddr == address(0)) return false;
        return IFieldMapper(providerAddr).supports(pathSyntax);
    }

    // -- Record store operations ---------------------------------------------

    /// @notice Store a key-value record on-chain for field mapping.
    /// @param recordHash  Unique identifier for the record.
    /// @param keys        Array of field keys.
    /// @param values      Array of field values (parallel to keys).
    function storeRecord(
        bytes32 recordHash,
        string[] calldata keys,
        string[] calldata values
    ) external {
        require(keys.length == values.length, "FieldMapperRegistry: keys/values length mismatch");

        for (uint256 i = 0; i < keys.length; i++) {
            recordStore[recordHash][keys[i]] = values[i];
        }
        recordFields[recordHash] = keys;

        emit RecordStored(recordHash, msg.sender, keys.length);
    }

    /// @notice Update a single field in an on-chain record.
    function updateRecordField(bytes32 recordHash, string calldata key, string calldata value) external {
        recordStore[recordHash][key] = value;
        emit RecordFieldUpdated(recordHash, key);
    }

    /// @notice Read a field value from the on-chain record store.
    function readField(bytes32 recordHash, string calldata key) external view returns (string memory) {
        return recordStore[recordHash][key];
    }

    /// @notice Read multiple fields from an on-chain record.
    function readFields(bytes32 recordHash, string[] calldata keys) external view returns (string[] memory) {
        string[] memory values = new string[](keys.length);
        for (uint256 i = 0; i < keys.length; i++) {
            values[i] = recordStore[recordHash][keys[i]];
        }
        return values;
    }

    /// @notice Get all field keys for a record.
    function getRecordKeys(bytes32 recordHash) external view returns (string[] memory) {
        return recordFields[recordHash];
    }

    // -- Resolution operations -----------------------------------------------

    /// @notice Resolve a field using a specific provider.
    function resolveWith(
        string calldata providerId,
        bytes32 recordHash,
        string calldata sourcePath,
        bytes calldata extraData
    ) external returns (string memory resolvedValue, uint256 resolutionId) {
        address providerAddr = providers[providerId];
        require(providerAddr != address(0), "FieldMapperRegistry: unknown provider");

        // Delegate to the provider contract
        (resolvedValue, resolutionId) = IFieldMapper(providerAddr).resolve(recordHash, sourcePath, extraData);

        // Store resolution record in the registry
        uint256 registryId = nextResolutionId++;
        resolutions[registryId] = IFieldMapper.MappingRecord({
            recordHash: recordHash,
            providerId: providerId,
            sourcePath: sourcePath,
            resolvedValue: resolvedValue,
            resolvedAt: block.timestamp,
            resolvedBy: msg.sender,
            extraData: extraData
        });

        resolutionsByAddress[msg.sender].push(registryId);
        resolutionCountByProvider[providerId]++;

        emit FieldResolved(registryId, msg.sender, providerId, recordHash, sourcePath, resolvedValue, block.timestamp);

        return (resolvedValue, registryId);
    }

    /// @notice Auto-resolve using the first provider that supports the path syntax.
    function resolveAuto(
        bytes32 recordHash,
        string calldata sourcePath,
        bytes calldata extraData
    ) external returns (string memory resolvedValue, uint256 resolutionId) {
        for (uint256 i = 0; i < providerIds.length; i++) {
            address providerAddr = providers[providerIds[i]];
            if (providerAddr != address(0) && IFieldMapper(providerAddr).supports(sourcePath)) {
                return this.resolveWith(providerIds[i], recordHash, sourcePath, extraData);
            }
        }
        revert("FieldMapperRegistry: no provider supports this path syntax");
    }

    /// @notice Batch resolve multiple paths against the same record.
    function batchResolve(
        string calldata providerId,
        bytes32 recordHash,
        string[] calldata sourcePaths,
        bytes calldata extraData
    ) external returns (string[] memory resolvedValues, uint256[] memory resolutionIds) {
        resolvedValues = new string[](sourcePaths.length);
        resolutionIds = new uint256[](sourcePaths.length);

        for (uint256 i = 0; i < sourcePaths.length; i++) {
            (resolvedValues[i], resolutionIds[i]) = this.resolveWith(
                providerId, recordHash, sourcePaths[i], extraData
            );
        }
    }

    // -- Query operations ----------------------------------------------------

    /// @notice Retrieve a resolution record by ID.
    function getResolution(uint256 resolutionId) external view returns (IFieldMapper.MappingRecord memory) {
        require(resolutionId > 0 && resolutionId < nextResolutionId, "FieldMapperRegistry: invalid resolution ID");
        return resolutions[resolutionId];
    }

    /// @notice Get all resolution IDs for an address.
    function getResolutionsByAddress(address addr) external view returns (uint256[] memory) {
        return resolutionsByAddress[addr];
    }

    /// @notice Transfer ownership of the registry.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FieldMapperRegistry: zero address");
        owner = newOwner;
    }
}

// ---------------------------------------------------------------------------
// Base contract for shared provider logic
// ---------------------------------------------------------------------------

/// @title BaseFieldMapper — shared implementation for field-mapper providers.
/// @notice Provides common record storage, access control, and event emission.
abstract contract BaseFieldMapper is IFieldMapper {
    address public registry;
    address public owner;
    uint256 public resolutionCount;

    mapping(uint256 => MappingRecord) internal _resolutions;

    modifier onlyRegistry() {
        require(msg.sender == registry, "BaseFieldMapper: caller is not the registry");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "BaseFieldMapper: caller is not the owner");
        _;
    }

    constructor(address _registry) {
        registry = _registry;
        owner = msg.sender;
    }

    function getResolution(uint256 resolutionId) external view override returns (MappingRecord memory) {
        return _resolutions[resolutionId];
    }

    function _recordResolution(
        bytes32 recordHash,
        string calldata sourcePath,
        string memory resolvedValue,
        bytes calldata extraData
    ) internal returns (uint256 resolutionId) {
        resolutionId = ++resolutionCount;

        _resolutions[resolutionId] = MappingRecord({
            recordHash: recordHash,
            providerId: _providerId(),
            sourcePath: sourcePath,
            resolvedValue: resolvedValue,
            resolvedAt: block.timestamp,
            resolvedBy: tx.origin,
            extraData: extraData
        });

        emit FieldResolved(resolutionId, tx.origin, _providerId(), recordHash, sourcePath, resolvedValue, block.timestamp);
    }

    /// @dev Override in each provider to return its unique ID.
    function _providerId() internal pure virtual returns (string memory);
}

// ---------------------------------------------------------------------------
// Provider: DirectFieldMapper — dot-notation key-value lookup
// ---------------------------------------------------------------------------

/// @title DirectFieldMapper — on-chain direct key-to-key field mapping.
/// @notice Resolves field values using simple key lookups against the registry's
///         on-chain record store. Supports single-level key access and basic
///         dot-notation for structured records stored as flat key-value pairs.
///
///         For nested paths like "address.city", the record store should contain
///         the flattened key "address.city" as a key in the record.
///
///         This provider also maintains a mapping table for key aliasing:
///         source key "fname" can be mapped to destination key "first_name".
contract DirectFieldMapper is BaseFieldMapper {
    /// @notice Key alias mappings: sourceKey => destinationKey.
    mapping(bytes32 => mapping(string => string)) public keyAliases;

    /// @notice Default values for keys.
    mapping(bytes32 => mapping(string => string)) public defaultValues;

    /// @notice Reference to the registry for record store access.
    FieldMapperRegistry public registryContract;

    constructor(address _registry) BaseFieldMapper(_registry) {
        registryContract = FieldMapperRegistry(_registry);
    }

    function _providerId() internal pure override returns (string memory) {
        return "direct";
    }

    function supports(string calldata pathSyntax) external pure override returns (bool) {
        bytes memory b = bytes(pathSyntax);
        if (b.length == 0) return false;

        // Must not start with $. (JSONPath), // (XPath), or { (template)
        if (b[0] == 0x24 && b.length > 1 && b[1] == 0x2E) return false; // $.
        if (b[0] == 0x2F && b.length > 1 && b[1] == 0x2F) return false; // //
        if (b[0] == 0x7B) return false; // {

        // Must start with a letter or underscore
        return (b[0] >= 0x41 && b[0] <= 0x5A) || // A-Z
               (b[0] >= 0x61 && b[0] <= 0x7A) || // a-z
               b[0] == 0x5F;                       // _
    }

    function resolve(
        bytes32 recordHash,
        string calldata sourcePath,
        bytes calldata extraData
    ) external override onlyRegistry returns (string memory resolvedValue, uint256 resolutionId) {
        // Check for key alias first
        string memory aliasedKey = keyAliases[recordHash][sourcePath];
        string memory lookupKey;

        if (bytes(aliasedKey).length > 0) {
            lookupKey = aliasedKey;
        } else {
            lookupKey = sourcePath;
        }

        // Look up the value from the registry's record store
        resolvedValue = registryContract.readField(recordHash, lookupKey);

        // If empty, try dot-notation segments as separate lookups
        if (bytes(resolvedValue).length == 0) {
            resolvedValue = _tryNestedLookup(recordHash, lookupKey);
        }

        // If still empty, use default value
        if (bytes(resolvedValue).length == 0) {
            string memory defaultVal = defaultValues[recordHash][sourcePath];
            if (bytes(defaultVal).length > 0) {
                resolvedValue = defaultVal;
            }
        }

        resolutionId = _recordResolution(recordHash, sourcePath, resolvedValue, extraData);
    }

    /// @notice Set a key alias for a specific record.
    function setKeyAlias(bytes32 recordHash, string calldata sourceKey, string calldata destKey) external onlyOwner {
        keyAliases[recordHash][sourceKey] = destKey;
    }

    /// @notice Set a batch of key aliases.
    function setKeyAliases(
        bytes32 recordHash,
        string[] calldata sourceKeys,
        string[] calldata destKeys
    ) external onlyOwner {
        require(sourceKeys.length == destKeys.length, "DirectFieldMapper: length mismatch");
        for (uint256 i = 0; i < sourceKeys.length; i++) {
            keyAliases[recordHash][sourceKeys[i]] = destKeys[i];
        }
    }

    /// @notice Set a default value for a key on a specific record.
    function setDefaultValue(bytes32 recordHash, string calldata key, string calldata value) external onlyOwner {
        defaultValues[recordHash][key] = value;
    }

    /// @notice Set a global key alias (using zero hash as a global namespace).
    function setGlobalKeyAlias(string calldata sourceKey, string calldata destKey) external onlyOwner {
        keyAliases[bytes32(0)][sourceKey] = destKey;
    }

    /// @notice Internal: try looking up dot-separated segments.
    function _tryNestedLookup(bytes32 recordHash, string memory key) internal view returns (string memory) {
        // For paths like "address.city", also try the full key as-is
        // (the record store flattens nested structures into dotted keys)
        return registryContract.readField(recordHash, key);
    }
}

// ---------------------------------------------------------------------------
// Provider: TemplateFieldMapper — string interpolation with field references
// ---------------------------------------------------------------------------

/// @title TemplateFieldMapper — on-chain template-based field resolution.
/// @notice Resolves field values by interpolating templates with multiple field
///         references from the record store. Templates use `{field}` syntax.
///
///         Example: "{first_name} {last_name}" resolves by looking up both
///         "first_name" and "last_name" from the record store and concatenating.
///
///         On-chain string manipulation is gas-intensive; this provider is
///         designed for simple concatenation patterns. Complex templates should
///         be resolved off-chain and recorded on-chain for verification.
contract TemplateFieldMapper is BaseFieldMapper {
    /// @notice Pre-compiled template definitions: templateId => template string.
    mapping(bytes32 => string) public templates;

    /// @notice Template field lists: templateId => list of field names in the template.
    mapping(bytes32 => string[]) public templateFields;

    /// @notice Reference to the registry for record store access.
    FieldMapperRegistry public registryContract;

    constructor(address _registry) BaseFieldMapper(_registry) {
        registryContract = FieldMapperRegistry(_registry);
    }

    function _providerId() internal pure override returns (string memory) {
        return "template";
    }

    function supports(string calldata pathSyntax) external pure override returns (bool) {
        bytes memory b = bytes(pathSyntax);
        // Must contain { and }
        bool hasOpen = false;
        bool hasClose = false;
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == 0x7B) hasOpen = true;  // {
            if (b[i] == 0x7D) hasClose = true;  // }
        }
        // Must not start with $ (JSONPath) or / (XPath/regex)
        if (b.length > 0 && (b[0] == 0x24 || b[0] == 0x2F)) return false;
        return hasOpen && hasClose;
    }

    function resolve(
        bytes32 recordHash,
        string calldata sourcePath,
        bytes calldata extraData
    ) external override onlyRegistry returns (string memory resolvedValue, uint256 resolutionId) {
        // Parse the template and extract field references
        string[] memory fields = _extractFields(sourcePath);
        string[] memory values = new string[](fields.length);

        // Resolve each field from the record store
        for (uint256 i = 0; i < fields.length; i++) {
            values[i] = registryContract.readField(recordHash, fields[i]);
        }

        // Interpolate the template
        resolvedValue = _interpolate(sourcePath, fields, values);

        resolutionId = _recordResolution(recordHash, sourcePath, resolvedValue, extraData);
    }

    /// @notice Register a pre-compiled template for efficient resolution.
    /// @param templateId   Unique identifier for the template.
    /// @param template     Template string with {field} placeholders.
    /// @param fields       Ordered list of field names referenced in the template.
    function registerTemplate(
        bytes32 templateId,
        string calldata template,
        string[] calldata fields
    ) external onlyOwner {
        templates[templateId] = template;
        templateFields[templateId] = fields;
    }

    /// @notice Resolve a pre-compiled template.
    function resolveTemplate(
        bytes32 templateId,
        bytes32 recordHash
    ) external view returns (string memory) {
        string memory template = templates[templateId];
        require(bytes(template).length > 0, "TemplateFieldMapper: template not found");

        string[] memory fields = templateFields[templateId];
        string[] memory values = new string[](fields.length);

        for (uint256 i = 0; i < fields.length; i++) {
            values[i] = registryContract.readField(recordHash, fields[i]);
        }

        return _interpolate(template, fields, values);
    }

    /// @notice Extract field names from a template string.
    /// @dev Looks for {field_name} patterns and returns field names in order.
    function _extractFields(string calldata template) internal pure returns (string[] memory) {
        bytes memory b = bytes(template);

        // First pass: count fields
        uint256 fieldCount = 0;
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == 0x7B) fieldCount++;
        }

        string[] memory fields = new string[](fieldCount);
        uint256 fieldIdx = 0;

        // Second pass: extract field names
        uint256 i = 0;
        while (i < b.length) {
            if (b[i] == 0x7B) {
                uint256 start = i + 1;
                // Find closing brace
                while (i < b.length && b[i] != 0x7D) { i++; }
                if (i < b.length) {
                    // Extract field name
                    bytes memory fieldBytes = new bytes(i - start);
                    for (uint256 j = 0; j < i - start; j++) {
                        fieldBytes[j] = b[start + j];
                    }
                    fields[fieldIdx++] = string(fieldBytes);
                }
            }
            i++;
        }

        // Trim array to actual count
        string[] memory trimmed = new string[](fieldIdx);
        for (uint256 j = 0; j < fieldIdx; j++) {
            trimmed[j] = fields[j];
        }
        return trimmed;
    }

    /// @notice Interpolate a template by replacing {field} with values.
    /// @dev Performs sequential string replacement.
    function _interpolate(
        string memory template,
        string[] memory fields,
        string[] memory values
    ) internal pure returns (string memory) {
        bytes memory templateBytes = bytes(template);
        // Build result by iterating through template bytes
        bytes memory result;
        uint256 i = 0;

        while (i < templateBytes.length) {
            if (templateBytes[i] == 0x7B) { // {
                // Find the closing brace
                uint256 start = i + 1;
                while (i < templateBytes.length && templateBytes[i] != 0x7D) { i++; }

                // Extract the field name
                bytes memory fieldName = new bytes(i - start);
                for (uint256 j = 0; j < i - start; j++) {
                    fieldName[j] = templateBytes[start + j];
                }

                // Find the matching value
                bool found = false;
                for (uint256 k = 0; k < fields.length; k++) {
                    if (keccak256(bytes(fields[k])) == keccak256(fieldName)) {
                        result = abi.encodePacked(result, values[k]);
                        found = true;
                        break;
                    }
                }

                // If field not found, keep the original placeholder
                if (!found) {
                    result = abi.encodePacked(result, "{", fieldName, "}");
                }

                i++; // Skip closing brace
            } else {
                result = abi.encodePacked(result, templateBytes[i]);
                i++;
            }
        }

        return string(result);
    }
}

// ---------------------------------------------------------------------------
// Provider: ComputedFieldMapper — on-chain expression evaluation
// ---------------------------------------------------------------------------

/// @title ComputedFieldMapper — on-chain computed field resolution.
/// @notice Provides basic arithmetic operations on numeric field values stored
///         in the record store. Supports pre-registered computation recipes
///         that define the operation, operand fields, and result formatting.
///
///         Full expression evaluation is gas-prohibitive on-chain. This contract
///         provides verifiable computation primitives:
///         - Binary operations: add, sub, mul, div, mod
///         - Comparison operations: eq, neq, lt, lte, gt, gte
///         - Aggregation: sum, avg, min, max over a set of fields
///
///         Complex expressions should be computed off-chain and submitted with
///         a proof for on-chain verification.
contract ComputedFieldMapper is BaseFieldMapper {
    /// @notice Enumeration of supported operations.
    enum Operation { Add, Sub, Mul, Div, Mod, Eq, Neq, Lt, Lte, Gt, Gte }

    /// @notice A computation recipe: defines how to compute a derived value.
    struct Recipe {
        Operation op;
        string[] operandFields;   // Field names to read from the record store
        uint8    decimals;         // Fixed-point decimal places for the result
        string   resultFormat;     // "number", "bool", "string"
    }

    /// @notice Registered recipes: recipeId => Recipe.
    mapping(bytes32 => Recipe) public recipes;

    /// @notice Recipe existence check.
    mapping(bytes32 => bool) public recipeExists;

    /// @notice Reference to the registry for record store access.
    FieldMapperRegistry public registryContract;

    constructor(address _registry) BaseFieldMapper(_registry) {
        registryContract = FieldMapperRegistry(_registry);
    }

    function _providerId() internal pure override returns (string memory) {
        return "computed";
    }

    function supports(string calldata pathSyntax) external pure override returns (bool) {
        bytes memory b = bytes(pathSyntax);
        if (b.length == 0) return false;
        // Must not start with $ / { @
        if (b[0] == 0x24 || b[0] == 0x2F || b[0] == 0x7B || b[0] == 0x40) return false;
        // Must contain an operator character
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == 0x2B || b[i] == 0x2D || b[i] == 0x2A || // + - *
                b[i] == 0x25 || b[i] == 0x3C || b[i] == 0x3E || // % < >
                b[i] == 0x3D || b[i] == 0x21 || b[i] == 0x28) { // = ! (
                return true;
            }
        }
        return false;
    }

    function resolve(
        bytes32 recordHash,
        string calldata sourcePath,
        bytes calldata extraData
    ) external override onlyRegistry returns (string memory resolvedValue, uint256 resolutionId) {
        // Check if there's a registered recipe for this expression
        bytes32 recipeId = keccak256(bytes(sourcePath));

        if (recipeExists[recipeId]) {
            resolvedValue = _executeRecipe(recordHash, recipeId);
        } else if (extraData.length > 0) {
            // Extra data contains: (string[] operandValues, uint8 operation)
            (string[] memory operandValues, uint8 opCode) = abi.decode(extraData, (string[], uint8));
            resolvedValue = _computeFromValues(operandValues, Operation(opCode));
        } else {
            resolvedValue = "";
        }

        resolutionId = _recordResolution(recordHash, sourcePath, resolvedValue, extraData);
    }

    /// @notice Register a computation recipe.
    function registerRecipe(
        bytes32 recipeId,
        uint8 operation,
        string[] calldata operandFields,
        uint8 decimals,
        string calldata resultFormat
    ) external onlyOwner {
        recipes[recipeId] = Recipe({
            op: Operation(operation),
            operandFields: operandFields,
            decimals: decimals,
            resultFormat: resultFormat
        });
        recipeExists[recipeId] = true;
    }

    /// @notice Execute a registered recipe against a record.
    function _executeRecipe(bytes32 recordHash, bytes32 recipeId) internal view returns (string memory) {
        Recipe storage recipe = recipes[recipeId];
        string[] memory values = new string[](recipe.operandFields.length);

        for (uint256 i = 0; i < recipe.operandFields.length; i++) {
            values[i] = registryContract.readField(recordHash, recipe.operandFields[i]);
        }

        return _computeFromValues(values, recipe.op);
    }

    /// @notice Compute a result from operand values and an operation.
    function _computeFromValues(string[] memory values, Operation op) internal pure returns (string memory) {
        require(values.length >= 2, "ComputedFieldMapper: need at least 2 operands");

        int256 a = _parseInt(values[0]);
        int256 b = _parseInt(values[1]);

        if (op == Operation.Add) return _intToString(a + b);
        if (op == Operation.Sub) return _intToString(a - b);
        if (op == Operation.Mul) return _intToString(a * b);
        if (op == Operation.Div) {
            require(b != 0, "ComputedFieldMapper: division by zero");
            return _intToString(a / b);
        }
        if (op == Operation.Mod) {
            require(b != 0, "ComputedFieldMapper: modulo by zero");
            return _intToString(a % b);
        }
        if (op == Operation.Eq) return a == b ? "true" : "false";
        if (op == Operation.Neq) return a != b ? "true" : "false";
        if (op == Operation.Lt) return a < b ? "true" : "false";
        if (op == Operation.Lte) return a <= b ? "true" : "false";
        if (op == Operation.Gt) return a > b ? "true" : "false";
        if (op == Operation.Gte) return a >= b ? "true" : "false";

        return "";
    }

    /// @notice Parse a string to int256.
    function _parseInt(string memory s) internal pure returns (int256) {
        bytes memory b = bytes(s);
        if (b.length == 0) return 0;

        bool negative = false;
        uint256 start = 0;

        if (b[0] == 0x2D) { // '-'
            negative = true;
            start = 1;
        }

        int256 result = 0;
        for (uint256 i = start; i < b.length; i++) {
            if (b[i] >= 0x30 && b[i] <= 0x39) {
                result = result * 10 + int256(uint256(uint8(b[i]) - 48));
            } else if (b[i] == 0x2E) { // '.' — stop at decimal point for integer parsing
                break;
            }
        }

        return negative ? -result : result;
    }

    /// @notice Convert int256 to string.
    function _intToString(int256 value) internal pure returns (string memory) {
        if (value == 0) return "0";

        bool negative = value < 0;
        uint256 absValue = negative ? uint256(-value) : uint256(value);

        // Count digits
        uint256 digits = 0;
        uint256 temp = absValue;
        while (temp > 0) { digits++; temp /= 10; }

        uint256 totalLen = negative ? digits + 1 : digits;
        bytes memory result = new bytes(totalLen);

        uint256 idx = totalLen;
        temp = absValue;
        while (temp > 0) {
            idx--;
            result[idx] = bytes1(uint8(48 + temp % 10));
            temp /= 10;
        }

        if (negative) {
            result[0] = 0x2D; // '-'
        }

        return string(result);
    }
}

// ---------------------------------------------------------------------------
// Provider: RegexFieldMapper — on-chain regex pattern registry
// ---------------------------------------------------------------------------

/// @title RegexFieldMapper — on-chain registry for regex-based field extraction patterns.
/// @notice Actual regex evaluation happens off-chain due to EVM limitations.
///         This contract stores pattern definitions and records extraction results
///         for verification. Patterns are registered with their expected capture
///         group structure and validation constraints.
contract RegexFieldMapper is BaseFieldMapper {
    /// @notice A registered regex pattern.
    struct PatternDef {
        string  pattern;            // The regex pattern string
        string  flags;              // Regex flags (e.g., "gi")
        uint8   captureGroupCount;  // Number of capture groups in the pattern
        string  description;        // Human-readable description
        bool    active;             // Whether the pattern is currently active
    }

    /// @notice Registered patterns: patternId => PatternDef.
    mapping(bytes32 => PatternDef) public patterns;

    /// @notice Pattern existence check.
    mapping(bytes32 => bool) public patternExists;

    /// @notice All registered pattern IDs.
    bytes32[] public patternIds;

    constructor(address _registry) BaseFieldMapper(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "regex";
    }

    function supports(string calldata pathSyntax) external pure override returns (bool) {
        bytes memory b = bytes(pathSyntax);
        if (b.length < 3) return false;
        // Must start and end with / (with optional flags after closing /)
        return b[0] == 0x2F; // starts with /
    }

    function resolve(
        bytes32 recordHash,
        string calldata sourcePath,
        bytes calldata extraData
    ) external override onlyRegistry returns (string memory resolvedValue, uint256 resolutionId) {
        // Regex evaluation happens off-chain. The caller provides the result
        // in extraData for on-chain recording and verification.
        if (extraData.length > 0) {
            (resolvedValue) = abi.decode(extraData, (string));
        }

        resolutionId = _recordResolution(recordHash, sourcePath, resolvedValue, extraData);
    }

    /// @notice Register a regex pattern for use in field extraction.
    function registerPattern(
        bytes32 patternId,
        string calldata pattern,
        string calldata flags,
        uint8 captureGroupCount,
        string calldata description
    ) external onlyOwner {
        patterns[patternId] = PatternDef({
            pattern: pattern,
            flags: flags,
            captureGroupCount: captureGroupCount,
            description: description,
            active: true
        });
        if (!patternExists[patternId]) {
            patternExists[patternId] = true;
            patternIds.push(patternId);
        }
    }

    /// @notice Deactivate a pattern.
    function deactivatePattern(bytes32 patternId) external onlyOwner {
        require(patternExists[patternId], "RegexFieldMapper: pattern not found");
        patterns[patternId].active = false;
    }

    /// @notice Get a pattern definition.
    function getPattern(bytes32 patternId) external view returns (PatternDef memory) {
        require(patternExists[patternId], "RegexFieldMapper: pattern not found");
        return patterns[patternId];
    }

    /// @notice Get the count of registered patterns.
    function patternCount() external view returns (uint256) {
        return patternIds.length;
    }
}

// ---------------------------------------------------------------------------
// Provider: JsonPathFieldMapper — on-chain JSONPath expression registry
// ---------------------------------------------------------------------------

/// @title JsonPathFieldMapper — on-chain registry for JSONPath-based field extraction.
/// @notice Full JSONPath evaluation happens off-chain. This contract stores expression
///         definitions and records extraction results for verification. Expressions
///         can be pre-registered with expected result types for validation.
contract JsonPathFieldMapper is BaseFieldMapper {
    /// @notice A registered JSONPath expression.
    struct ExpressionDef {
        string  expression;         // The JSONPath expression
        string  expectedType;       // Expected result type: "string", "number", "array", "object"
        bool    required;           // Whether the expression must resolve to a non-empty value
        string  description;        // Human-readable description
    }

    mapping(bytes32 => ExpressionDef) public expressions;
    mapping(bytes32 => bool) public expressionExists;

    constructor(address _registry) BaseFieldMapper(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "jsonpath";
    }

    function supports(string calldata pathSyntax) external pure override returns (bool) {
        bytes memory b = bytes(pathSyntax);
        if (b.length < 2) return false;
        return b[0] == 0x24; // starts with $
    }

    function resolve(
        bytes32 recordHash,
        string calldata sourcePath,
        bytes calldata extraData
    ) external override onlyRegistry returns (string memory resolvedValue, uint256 resolutionId) {
        // JSONPath evaluation happens off-chain. The caller provides the result.
        if (extraData.length > 0) {
            (resolvedValue) = abi.decode(extraData, (string));
        }

        // Validate against registered expression constraints
        bytes32 exprId = keccak256(bytes(sourcePath));
        if (expressionExists[exprId]) {
            ExpressionDef storage expr = expressions[exprId];
            if (expr.required) {
                require(bytes(resolvedValue).length > 0, "JsonPathFieldMapper: required expression resolved to empty");
            }
        }

        resolutionId = _recordResolution(recordHash, sourcePath, resolvedValue, extraData);
    }

    /// @notice Register a JSONPath expression definition.
    function registerExpression(
        bytes32 exprId,
        string calldata expression,
        string calldata expectedType,
        bool required,
        string calldata description
    ) external onlyOwner {
        expressions[exprId] = ExpressionDef({
            expression: expression,
            expectedType: expectedType,
            required: required,
            description: description
        });
        expressionExists[exprId] = true;
    }

    /// @notice Get an expression definition.
    function getExpression(bytes32 exprId) external view returns (ExpressionDef memory) {
        require(expressionExists[exprId], "JsonPathFieldMapper: expression not found");
        return expressions[exprId];
    }
}

// ---------------------------------------------------------------------------
// Provider: XPathFieldMapper — on-chain XPath expression registry
// ---------------------------------------------------------------------------

/// @title XPathFieldMapper — on-chain registry for XPath-based field extraction.
/// @notice Mirrors JsonPathFieldMapper for XML source records. Full XPath evaluation
///         happens off-chain with results recorded on-chain for verification.
contract XPathFieldMapper is BaseFieldMapper {
    struct XPathExprDef {
        string  expression;
        string  expectedType;       // "text", "attribute", "element", "nodeset"
        bool    required;
        string  description;
        string[] namespaces;        // Namespace declarations: ["prefix=uri", ...]
    }

    mapping(bytes32 => XPathExprDef) public expressions;
    mapping(bytes32 => bool) public expressionExists;

    constructor(address _registry) BaseFieldMapper(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "xpath";
    }

    function supports(string calldata pathSyntax) external pure override returns (bool) {
        bytes memory b = bytes(pathSyntax);
        if (b.length < 2) return false;
        return b[0] == 0x2F; // starts with /
    }

    function resolve(
        bytes32 recordHash,
        string calldata sourcePath,
        bytes calldata extraData
    ) external override onlyRegistry returns (string memory resolvedValue, uint256 resolutionId) {
        if (extraData.length > 0) {
            (resolvedValue) = abi.decode(extraData, (string));
        }

        bytes32 exprId = keccak256(bytes(sourcePath));
        if (expressionExists[exprId]) {
            XPathExprDef storage expr = expressions[exprId];
            if (expr.required) {
                require(bytes(resolvedValue).length > 0, "XPathFieldMapper: required expression resolved to empty");
            }
        }

        resolutionId = _recordResolution(recordHash, sourcePath, resolvedValue, extraData);
    }

    /// @notice Register an XPath expression definition.
    function registerExpression(
        bytes32 exprId,
        string calldata expression,
        string calldata expectedType,
        bool required,
        string calldata description,
        string[] calldata namespaces
    ) external onlyOwner {
        expressions[exprId] = XPathExprDef({
            expression: expression,
            expectedType: expectedType,
            required: required,
            description: description,
            namespaces: namespaces
        });
        expressionExists[exprId] = true;
    }

    function getExpression(bytes32 exprId) external view returns (XPathExprDef memory) {
        require(expressionExists[exprId], "XPathFieldMapper: expression not found");
        return expressions[exprId];
    }
}
