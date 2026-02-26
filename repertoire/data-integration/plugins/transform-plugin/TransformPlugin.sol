// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Transform Plugin — on-chain transform registry and provider implementations
// for the Transform concept in the COPF Data Integration Kit.
//
// On-chain transforms are limited to operations feasible within EVM constraints:
// string manipulation, type casting, lookup table resolution, and truncation.
// Complex transforms (HTML/Markdown conversion, date parsing, expression eval)
// are performed off-chain and their results attested on-chain via the registry.
//
// See Data Integration Kit transform.concept for the parent Transform concept definition.

// ---------------------------------------------------------------------------
// Core types and interfaces
// ---------------------------------------------------------------------------

/// @title ITransformPlugin — interface for all transform provider contracts.
interface ITransformPlugin {
    /// @notice Metadata about a transform operation recorded on-chain.
    struct TransformRecord {
        bytes32 inputHash;         // SHA-256 of input value
        bytes32 outputHash;        // SHA-256 of output value
        string  providerId;        // e.g., "type_cast", "slugify"
        string  inputType;         // TypeSpec kind of input
        string  outputType;        // TypeSpec kind of output
        uint256 transformedAt;     // Block timestamp
        address transformedBy;     // Address that initiated the transform
        bytes   configData;        // ABI-encoded provider-specific config
    }

    /// @notice Execute a transform and record it on-chain.
    /// @param inputHash    SHA-256 hash of the input value.
    /// @param outputHash   SHA-256 hash of the output value.
    /// @param inputType    Type description of the input.
    /// @param outputType   Type description of the output.
    /// @param configData   ABI-encoded provider-specific configuration.
    /// @return recordId    Unique identifier for the transform record.
    function transform(
        bytes32 inputHash,
        bytes32 outputHash,
        string calldata inputType,
        string calldata outputType,
        bytes calldata configData
    ) external returns (uint256 recordId);

    /// @notice Get the provider's unique identifier.
    function providerId() external pure returns (string memory);

    /// @notice Retrieve a transform record by its ID.
    function getRecord(uint256 recordId) external view returns (TransformRecord memory);

    /// @notice Emitted when a transform is recorded.
    event TransformRecorded(
        uint256 indexed recordId,
        address indexed transformedBy,
        string  providerId,
        bytes32 inputHash,
        bytes32 outputHash,
        uint256 transformedAt
    );
}

// ---------------------------------------------------------------------------
// Transform Plugin Registry — central dispatch for provider contracts
// ---------------------------------------------------------------------------

/// @title TransformPluginRegistry — registry and router for transform provider contracts.
/// @notice Manages registration, lookup, and dispatch to provider implementations.
///         Maintains a global transform log and provides batch transform capabilities.
contract TransformPluginRegistry {
    // -- State ---------------------------------------------------------------

    address public owner;
    uint256 public nextRecordId;

    /// @notice Registered providers: providerId => contract address.
    mapping(string => address) public providers;

    /// @notice List of all registered provider IDs.
    string[] public providerIds;

    /// @notice Global transform record store.
    mapping(uint256 => ITransformPlugin.TransformRecord) public records;

    /// @notice Transform records by address.
    mapping(address => uint256[]) public recordsByAddress;

    /// @notice Input hash to record IDs (for dedup / lineage tracking).
    mapping(bytes32 => uint256[]) public inputHashIndex;

    // -- Events --------------------------------------------------------------

    event ProviderRegistered(string indexed providerId, address providerAddress);
    event ProviderUpdated(string indexed providerId, address oldAddress, address newAddress);
    event ProviderRemoved(string indexed providerId);
    event TransformRecorded(
        uint256 indexed recordId,
        address indexed transformedBy,
        string  providerId,
        bytes32 inputHash,
        bytes32 outputHash,
        uint256 transformedAt
    );

    // -- Modifiers -----------------------------------------------------------

    modifier onlyOwner() {
        require(msg.sender == owner, "TransformPluginRegistry: caller is not the owner");
        _;
    }

    // -- Constructor ----------------------------------------------------------

    constructor() {
        owner = msg.sender;
        nextRecordId = 1;
    }

    // -- Provider management -------------------------------------------------

    /// @notice Register a new transform provider.
    function registerProvider(string calldata _providerId, address providerAddr) external onlyOwner {
        require(providerAddr != address(0), "TransformPluginRegistry: zero address");
        require(providers[_providerId] == address(0), "TransformPluginRegistry: provider already registered");

        providers[_providerId] = providerAddr;
        providerIds.push(_providerId);

        emit ProviderRegistered(_providerId, providerAddr);
    }

    /// @notice Update an existing provider's contract address.
    function updateProvider(string calldata _providerId, address newAddr) external onlyOwner {
        require(newAddr != address(0), "TransformPluginRegistry: zero address");
        address oldAddr = providers[_providerId];
        require(oldAddr != address(0), "TransformPluginRegistry: provider not registered");

        providers[_providerId] = newAddr;

        emit ProviderUpdated(_providerId, oldAddr, newAddr);
    }

    /// @notice Remove a registered provider.
    function removeProvider(string calldata _providerId) external onlyOwner {
        require(providers[_providerId] != address(0), "TransformPluginRegistry: provider not registered");
        delete providers[_providerId];

        for (uint256 i = 0; i < providerIds.length; i++) {
            if (keccak256(bytes(providerIds[i])) == keccak256(bytes(_providerId))) {
                providerIds[i] = providerIds[providerIds.length - 1];
                providerIds.pop();
                break;
            }
        }

        emit ProviderRemoved(_providerId);
    }

    /// @notice Get the number of registered providers.
    function providerCount() external view returns (uint256) {
        return providerIds.length;
    }

    // -- Transform operations ------------------------------------------------

    /// @notice Execute a transform through a specific provider and record it.
    function transformWith(
        string calldata _providerId,
        bytes32 inputHash,
        bytes32 outputHash,
        string calldata inputType,
        string calldata outputType,
        bytes calldata configData
    ) external returns (uint256 recordId) {
        address providerAddr = providers[_providerId];
        require(providerAddr != address(0), "TransformPluginRegistry: unknown provider");

        recordId = nextRecordId++;

        records[recordId] = ITransformPlugin.TransformRecord({
            inputHash: inputHash,
            outputHash: outputHash,
            providerId: _providerId,
            inputType: inputType,
            outputType: outputType,
            transformedAt: block.timestamp,
            transformedBy: msg.sender,
            configData: configData
        });

        recordsByAddress[msg.sender].push(recordId);
        inputHashIndex[inputHash].push(recordId);

        // Delegate to provider contract for provider-specific validation/recording
        ITransformPlugin(providerAddr).transform(
            inputHash, outputHash, inputType, outputType, configData
        );

        emit TransformRecorded(recordId, msg.sender, _providerId, inputHash, outputHash, block.timestamp);
    }

    /// @notice Batch transform: record multiple transforms in a single transaction.
    function batchTransform(
        string[] calldata _providerIds,
        bytes32[] calldata inputHashes,
        bytes32[] calldata outputHashes,
        string[] calldata inputTypes,
        string[] calldata outputTypes,
        bytes[] calldata configDatas
    ) external returns (uint256[] memory recordIds) {
        uint256 count = _providerIds.length;
        require(
            count == inputHashes.length &&
            count == outputHashes.length &&
            count == inputTypes.length &&
            count == outputTypes.length &&
            count == configDatas.length,
            "TransformPluginRegistry: array length mismatch"
        );

        recordIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            recordIds[i] = this.transformWith(
                _providerIds[i], inputHashes[i], outputHashes[i],
                inputTypes[i], outputTypes[i], configDatas[i]
            );
        }
    }

    // -- Query operations ----------------------------------------------------

    /// @notice Retrieve a transform record by ID.
    function getRecord(uint256 recordId) external view returns (ITransformPlugin.TransformRecord memory) {
        require(recordId > 0 && recordId < nextRecordId, "TransformPluginRegistry: invalid record ID");
        return records[recordId];
    }

    /// @notice Get all record IDs for an address.
    function getRecordsByAddress(address addr) external view returns (uint256[] memory) {
        return recordsByAddress[addr];
    }

    /// @notice Get all records that transformed a specific input hash.
    function getRecordsByInputHash(bytes32 inputHash) external view returns (uint256[] memory) {
        return inputHashIndex[inputHash];
    }

    /// @notice Transfer ownership of the registry.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "TransformPluginRegistry: zero address");
        owner = newOwner;
    }
}

// ---------------------------------------------------------------------------
// Base contract for shared provider logic
// ---------------------------------------------------------------------------

/// @title BaseTransformProvider — shared implementation for transform providers.
abstract contract BaseTransformProvider is ITransformPlugin {
    address public registry;
    address public owner;
    uint256 public recordCount;

    mapping(uint256 => TransformRecord) internal _records;

    modifier onlyRegistry() {
        require(msg.sender == registry, "BaseTransformProvider: caller is not the registry");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "BaseTransformProvider: caller is not the owner");
        _;
    }

    constructor(address _registry) {
        registry = _registry;
        owner = msg.sender;
    }

    function getRecord(uint256 recordId) external view override returns (TransformRecord memory) {
        return _records[recordId];
    }

    function _recordTransform(
        bytes32 inputHash,
        bytes32 outputHash,
        string calldata inputType,
        string calldata outputType,
        bytes calldata configData
    ) internal returns (uint256 recordId) {
        recordId = ++recordCount;

        _records[recordId] = TransformRecord({
            inputHash: inputHash,
            outputHash: outputHash,
            providerId: providerId(),
            inputType: inputType,
            outputType: outputType,
            transformedAt: block.timestamp,
            transformedBy: tx.origin,
            configData: configData
        });

        emit TransformRecorded(recordId, tx.origin, providerId(), inputHash, outputHash, block.timestamp);
    }
}

// ---------------------------------------------------------------------------
// Provider: TypeCastTransform
// ---------------------------------------------------------------------------

/// @title TypeCastTransform — on-chain attestation for type cast operations.
/// @notice Records type conversions (string->number, date->timestamp, etc.)
///         performed off-chain. On-chain, provides a lookup table for common
///         string-to-uint and string-to-bool conversions for use in other contracts.
contract TypeCastTransform is BaseTransformProvider {
    /// @notice Type cast specific metadata.
    struct CastMetadata {
        string fromType;         // Source type (e.g., "string")
        string toType;           // Target type (e.g., "number")
        bool   strict;           // Whether strict mode was used
        bool   success;          // Whether the cast succeeded without fallback
    }

    mapping(uint256 => CastMetadata) public castMetadata;

    /// @notice On-chain string-to-uint lookup for common conversions.
    mapping(string => uint256) public stringToUint;

    /// @notice On-chain string-to-bool lookup for common conversions.
    mapping(string => bool) public stringToBoolMap;
    mapping(string => bool) public stringToBoolDefined;

    constructor(address _registry) BaseTransformProvider(_registry) {
        // Pre-populate common boolean mappings
        _setBoolMapping("true", true);
        _setBoolMapping("false", false);
        _setBoolMapping("yes", true);
        _setBoolMapping("no", false);
        _setBoolMapping("1", true);
        _setBoolMapping("0", false);
        _setBoolMapping("on", true);
        _setBoolMapping("off", false);
        _setBoolMapping("t", true);
        _setBoolMapping("f", false);
        _setBoolMapping("y", true);
        _setBoolMapping("n", false);
    }

    function providerId() external pure override returns (string memory) {
        return "type_cast";
    }

    function transform(
        bytes32 inputHash,
        bytes32 outputHash,
        string calldata inputType,
        string calldata outputType,
        bytes calldata configData
    ) external override onlyRegistry returns (uint256 recordId) {
        recordId = _recordTransform(inputHash, outputHash, inputType, outputType, configData);

        if (configData.length > 0) {
            (
                string memory fromType,
                string memory toType,
                bool strict,
                bool success
            ) = abi.decode(configData, (string, string, bool, bool));

            castMetadata[recordId] = CastMetadata({
                fromType: fromType,
                toType: toType,
                strict: strict,
                success: success
            });
        }
    }

    /// @notice On-chain string to boolean conversion.
    function castStringToBool(string calldata input) external view returns (bool result, bool found) {
        string memory lower = _toLower(input);
        if (stringToBoolDefined[lower]) {
            return (stringToBoolMap[lower], true);
        }
        return (false, false);
    }

    /// @notice On-chain string to uint conversion (base 10).
    function castStringToUint(string calldata input) external pure returns (uint256 result, bool success) {
        bytes memory b = bytes(input);
        uint256 num = 0;
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c < 48 || c > 57) return (0, false); // Not a digit
            num = num * 10 + (c - 48);
        }
        return (num, true);
    }

    /// @notice Register additional string-to-uint mapping.
    function registerUintMapping(string calldata key, uint256 value) external onlyOwner {
        stringToUint[key] = value;
    }

    function _setBoolMapping(string memory key, bool value) internal {
        stringToBoolMap[key] = value;
        stringToBoolDefined[key] = true;
    }

    function _toLower(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        for (uint256 i = 0; i < bStr.length; i++) {
            if (uint8(bStr[i]) >= 65 && uint8(bStr[i]) <= 90) {
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }
        return string(bLower);
    }

    function getCastMetadata(uint256 recordId) external view returns (CastMetadata memory) {
        return castMetadata[recordId];
    }
}

// ---------------------------------------------------------------------------
// Provider: SlugifyTransform
// ---------------------------------------------------------------------------

/// @title SlugifyTransform — on-chain URL-safe slug generation.
/// @notice Generates URL-safe slugs from input strings entirely on-chain.
///         Supports ASCII alphanumeric characters, hyphen separator,
///         lowercase conversion, and max length enforcement.
///         Unicode normalization and diacritic removal are limited to a
///         pre-populated on-chain transliteration table.
contract SlugifyTransform is BaseTransformProvider {
    struct SlugMetadata {
        string originalText;      // Original input text (first 256 chars)
        string generatedSlug;     // The generated slug
        uint32 originalLength;    // Length of original input
        uint32 slugLength;        // Length of generated slug
        bool   wasTruncated;      // Whether max length was applied
    }

    mapping(uint256 => SlugMetadata) public slugMetadata;

    /// @notice Character transliteration table for on-chain slug generation.
    mapping(bytes1 => bytes1) public charMap;

    /// @notice Multi-char transliteration (e.g., ae for a-umlaut).
    mapping(bytes1 => string) public multiCharMap;

    constructor(address _registry) BaseTransformProvider(_registry) {
        // Populate basic ASCII transliteration for common Latin chars
        // Multi-char mappings for special characters
        multiCharMap[bytes1(0xC6)] = "ae";  // AE ligature
        multiCharMap[bytes1(0xE6)] = "ae";  // ae ligature
        multiCharMap[bytes1(0xD8)] = "o";   // O with stroke
        multiCharMap[bytes1(0xF8)] = "o";   // o with stroke
        multiCharMap[bytes1(0xDF)] = "ss";  // sharp s
    }

    function providerId() external pure override returns (string memory) {
        return "slugify";
    }

    function transform(
        bytes32 inputHash,
        bytes32 outputHash,
        string calldata inputType,
        string calldata outputType,
        bytes calldata configData
    ) external override onlyRegistry returns (uint256 recordId) {
        recordId = _recordTransform(inputHash, outputHash, inputType, outputType, configData);

        if (configData.length > 0) {
            (
                string memory originalText,
                string memory generatedSlug,
                uint32 originalLength,
                uint32 slugLength,
                bool wasTruncated
            ) = abi.decode(configData, (string, string, uint32, uint32, bool));

            slugMetadata[recordId] = SlugMetadata({
                originalText: originalText,
                generatedSlug: generatedSlug,
                originalLength: originalLength,
                slugLength: slugLength,
                wasTruncated: wasTruncated
            });
        }
    }

    /// @notice Generate a URL-safe slug on-chain from an ASCII input string.
    /// @param input       The input string to slugify (ASCII recommended).
    /// @param maxLength   Maximum slug length (0 = no limit).
    /// @return slug       The generated URL-safe slug.
    function slugify(string calldata input, uint32 maxLength) external pure returns (string memory slug) {
        bytes memory b = bytes(input);
        bytes memory result = new bytes(b.length);
        uint256 writeIdx = 0;
        bool lastWasHyphen = false;

        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);

            // Lowercase letters: pass through
            if (c >= 97 && c <= 122) {
                result[writeIdx++] = b[i];
                lastWasHyphen = false;
            }
            // Uppercase letters: convert to lowercase
            else if (c >= 65 && c <= 90) {
                result[writeIdx++] = bytes1(c + 32);
                lastWasHyphen = false;
            }
            // Digits: pass through
            else if (c >= 48 && c <= 57) {
                result[writeIdx++] = b[i];
                lastWasHyphen = false;
            }
            // Everything else: replace with hyphen (collapse consecutive)
            else {
                if (!lastWasHyphen && writeIdx > 0) {
                    result[writeIdx++] = bytes1(0x2D); // hyphen
                    lastWasHyphen = true;
                }
            }
        }

        // Trim trailing hyphen
        if (writeIdx > 0 && result[writeIdx - 1] == bytes1(0x2D)) {
            writeIdx--;
        }

        // Apply max length
        uint256 finalLen = writeIdx;
        if (maxLength > 0 && finalLen > maxLength) {
            finalLen = maxLength;
            // Try to break at last hyphen for clean word boundary
            for (uint256 i = finalLen; i > (finalLen * 7) / 10; i--) {
                if (result[i - 1] == bytes1(0x2D)) {
                    finalLen = i - 1;
                    break;
                }
            }
        }

        // Build final string
        bytes memory finalResult = new bytes(finalLen);
        for (uint256 i = 0; i < finalLen; i++) {
            finalResult[i] = result[i];
        }
        return string(finalResult);
    }

    function getSlugMetadata(uint256 recordId) external view returns (SlugMetadata memory) {
        return slugMetadata[recordId];
    }
}

// ---------------------------------------------------------------------------
// Provider: StripTagsTransform
// ---------------------------------------------------------------------------

/// @title StripTagsTransform — on-chain HTML tag removal.
/// @notice Strips HTML tags from input strings on-chain using a simple
///         state machine parser. Supports an allowlist of tag names to preserve.
///         Useful for sanitizing user-provided content stored on-chain.
contract StripTagsTransform is BaseTransformProvider {
    struct StripMetadata {
        uint32 tagsRemoved;       // Number of tags stripped
        uint32 inputLength;       // Original input length
        uint32 outputLength;      // Output length after stripping
    }

    mapping(uint256 => StripMetadata) public stripMetadata;

    constructor(address _registry) BaseTransformProvider(_registry) {}

    function providerId() external pure override returns (string memory) {
        return "strip_tags";
    }

    function transform(
        bytes32 inputHash,
        bytes32 outputHash,
        string calldata inputType,
        string calldata outputType,
        bytes calldata configData
    ) external override onlyRegistry returns (uint256 recordId) {
        recordId = _recordTransform(inputHash, outputHash, inputType, outputType, configData);

        if (configData.length > 0) {
            (
                uint32 tagsRemoved,
                uint32 inputLength,
                uint32 outputLength
            ) = abi.decode(configData, (uint32, uint32, uint32));

            stripMetadata[recordId] = StripMetadata({
                tagsRemoved: tagsRemoved,
                inputLength: inputLength,
                outputLength: outputLength
            });
        }
    }

    /// @notice Strip all HTML tags from an input string on-chain.
    /// @param input  The HTML string to strip.
    /// @return result  The plain text with all tags removed.
    /// @return tagsRemoved  Number of tags that were removed.
    function stripAllTags(string calldata input) external pure returns (string memory result, uint32 tagsRemoved) {
        bytes memory b = bytes(input);
        bytes memory output = new bytes(b.length);
        uint256 writeIdx = 0;
        bool inTag = false;
        uint32 tagCount = 0;

        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == bytes1("<")) {
                inTag = true;
                tagCount++;
            } else if (b[i] == bytes1(">")) {
                inTag = false;
            } else if (!inTag) {
                output[writeIdx++] = b[i];
            }
        }

        // Build trimmed result
        bytes memory trimmed = new bytes(writeIdx);
        for (uint256 i = 0; i < writeIdx; i++) {
            trimmed[i] = output[i];
        }

        return (string(trimmed), tagCount);
    }

    /// @notice Strip HTML tags except those in the allowlist.
    /// @param input         The HTML string to strip.
    /// @param allowedTag    A single tag name to preserve (e.g., "b", "a").
    ///                      For multiple tags, call this function iteratively
    ///                      or use the off-chain implementation.
    /// @return result       The filtered HTML string.
    function stripTagsExcept(string calldata input, string calldata allowedTag) external pure returns (string memory result) {
        bytes memory b = bytes(input);
        bytes memory output = new bytes(b.length * 2); // Extra space for preserved tags
        uint256 writeIdx = 0;
        bytes memory allowedBytes = bytes(allowedTag);

        uint256 i = 0;
        while (i < b.length) {
            if (b[i] == bytes1("<")) {
                // Find end of tag
                uint256 tagStart = i;
                uint256 tagEnd = i;
                for (uint256 j = i + 1; j < b.length; j++) {
                    if (b[j] == bytes1(">")) {
                        tagEnd = j;
                        break;
                    }
                }

                if (tagEnd > tagStart) {
                    // Extract tag name (skip < and optional /)
                    uint256 nameStart = tagStart + 1;
                    if (nameStart < tagEnd && b[nameStart] == bytes1("/")) {
                        nameStart++;
                    }
                    uint256 nameEnd = nameStart;
                    for (uint256 j = nameStart; j < tagEnd; j++) {
                        if (b[j] == bytes1(" ") || b[j] == bytes1(">") || b[j] == bytes1("/")) {
                            nameEnd = j;
                            break;
                        }
                        nameEnd = j + 1;
                    }

                    // Check if tag name matches allowed tag
                    bool isAllowed = false;
                    uint256 nameLen = nameEnd - nameStart;
                    if (nameLen == allowedBytes.length) {
                        isAllowed = true;
                        for (uint256 j = 0; j < nameLen; j++) {
                            uint8 c1 = uint8(b[nameStart + j]);
                            uint8 c2 = uint8(allowedBytes[j]);
                            // Case-insensitive comparison
                            if (c1 >= 65 && c1 <= 90) c1 += 32;
                            if (c2 >= 65 && c2 <= 90) c2 += 32;
                            if (c1 != c2) { isAllowed = false; break; }
                        }
                    }

                    if (isAllowed) {
                        // Preserve the tag
                        for (uint256 j = tagStart; j <= tagEnd; j++) {
                            output[writeIdx++] = b[j];
                        }
                    }
                    // Skip the tag
                    i = tagEnd + 1;
                } else {
                    output[writeIdx++] = b[i];
                    i++;
                }
            } else {
                output[writeIdx++] = b[i];
                i++;
            }
        }

        bytes memory trimmed = new bytes(writeIdx);
        for (uint256 j = 0; j < writeIdx; j++) {
            trimmed[j] = output[j];
        }
        return string(trimmed);
    }

    function getStripMetadata(uint256 recordId) external view returns (StripMetadata memory) {
        return stripMetadata[recordId];
    }
}

// ---------------------------------------------------------------------------
// Provider: TruncateTransform
// ---------------------------------------------------------------------------

/// @title TruncateTransform — on-chain string truncation with ellipsis.
/// @notice Truncates strings to a maximum byte length on-chain with configurable
///         ellipsis. Supports end-truncation with optional word boundary awareness.
contract TruncateTransform is BaseTransformProvider {
    struct TruncateMetadata {
        uint32 originalLength;     // Original string byte length
        uint32 truncatedLength;    // Output byte length
        uint32 maxLength;          // Configured max length
        bool   wasTruncated;       // Whether truncation was applied
    }

    mapping(uint256 => TruncateMetadata) public truncateMetadata;

    constructor(address _registry) BaseTransformProvider(_registry) {}

    function providerId() external pure override returns (string memory) {
        return "truncate";
    }

    function transform(
        bytes32 inputHash,
        bytes32 outputHash,
        string calldata inputType,
        string calldata outputType,
        bytes calldata configData
    ) external override onlyRegistry returns (uint256 recordId) {
        recordId = _recordTransform(inputHash, outputHash, inputType, outputType, configData);

        if (configData.length > 0) {
            (
                uint32 originalLength,
                uint32 truncatedLength,
                uint32 maxLen,
                bool wasTruncated
            ) = abi.decode(configData, (uint32, uint32, uint32, bool));

            truncateMetadata[recordId] = TruncateMetadata({
                originalLength: originalLength,
                truncatedLength: truncatedLength,
                maxLength: maxLen,
                wasTruncated: wasTruncated
            });
        }
    }

    /// @notice Truncate a string to maxLength bytes with "..." ellipsis.
    /// @param input      The string to truncate.
    /// @param maxLength  Maximum output length in bytes (including ellipsis).
    /// @return result    The truncated string.
    /// @return wasTruncated  Whether truncation was applied.
    function truncate(string calldata input, uint32 maxLength) external pure returns (string memory result, bool wasTruncated) {
        bytes memory b = bytes(input);
        if (b.length <= maxLength) {
            return (input, false);
        }

        // Reserve 3 bytes for "..."
        uint32 truncLen = maxLength > 3 ? maxLength - 3 : 0;

        // Find last space within truncLen for word boundary
        uint32 breakPoint = truncLen;
        for (uint32 i = truncLen; i > (truncLen * 5) / 10; i--) {
            if (b[i - 1] == bytes1(0x20)) { // space
                breakPoint = i - 1;
                break;
            }
        }

        // Build result: truncated portion + "..."
        bytes memory truncated = new bytes(breakPoint + 3);
        for (uint32 i = 0; i < breakPoint; i++) {
            truncated[i] = b[i];
        }
        truncated[breakPoint] = bytes1(0x2E);     // "."
        truncated[breakPoint + 1] = bytes1(0x2E); // "."
        truncated[breakPoint + 2] = bytes1(0x2E); // "."

        return (string(truncated), true);
    }

    /// @notice Truncate with a custom ellipsis string.
    /// @param input      The string to truncate.
    /// @param maxLength  Maximum output length in bytes.
    /// @param ellipsis   The ellipsis string to append.
    /// @return result    The truncated string.
    function truncateWithEllipsis(
        string calldata input,
        uint32 maxLength,
        string calldata ellipsis
    ) external pure returns (string memory result) {
        bytes memory b = bytes(input);
        bytes memory e = bytes(ellipsis);

        if (b.length <= maxLength) {
            return input;
        }

        uint32 truncLen = maxLength > uint32(e.length) ? maxLength - uint32(e.length) : 0;

        bytes memory output = new bytes(truncLen + e.length);
        for (uint32 i = 0; i < truncLen; i++) {
            output[i] = b[i];
        }
        for (uint32 i = 0; i < e.length; i++) {
            output[truncLen + i] = e[i];
        }

        return string(output);
    }

    function getTruncateMetadata(uint256 recordId) external view returns (TruncateMetadata memory) {
        return truncateMetadata[recordId];
    }
}

// ---------------------------------------------------------------------------
// Provider: LookupTransform
// ---------------------------------------------------------------------------

/// @title LookupTransform — on-chain key-value lookup table for value mapping.
/// @notice Maintains a string-to-string lookup table on-chain that can be used
///         to map values during data transformation (e.g., country codes to names,
///         status codes to labels). Supports multiple named lookup tables.
contract LookupTransform is BaseTransformProvider {
    struct LookupMetadata {
        string tableName;         // Name of the lookup table used
        string lookupKey;         // The key that was looked up
        bool   found;             // Whether the key was found
        bool   usedFallback;      // Whether a fallback value was used
    }

    mapping(uint256 => LookupMetadata) public lookupMetadata;

    /// @notice Named lookup tables: tableName => (key => value).
    mapping(string => mapping(string => string)) public tables;

    /// @notice Track which keys exist in a table (since empty string is valid).
    mapping(string => mapping(string => bool)) public tableKeyExists;

    /// @notice Table names list.
    string[] public tableNames;

    /// @notice Key count per table.
    mapping(string => uint256) public tableKeyCount;

    constructor(address _registry) BaseTransformProvider(_registry) {}

    function providerId() external pure override returns (string memory) {
        return "lookup";
    }

    function transform(
        bytes32 inputHash,
        bytes32 outputHash,
        string calldata inputType,
        string calldata outputType,
        bytes calldata configData
    ) external override onlyRegistry returns (uint256 recordId) {
        recordId = _recordTransform(inputHash, outputHash, inputType, outputType, configData);

        if (configData.length > 0) {
            (
                string memory tableName,
                string memory lookupKey,
                bool found,
                bool usedFallback
            ) = abi.decode(configData, (string, string, bool, bool));

            lookupMetadata[recordId] = LookupMetadata({
                tableName: tableName,
                lookupKey: lookupKey,
                found: found,
                usedFallback: usedFallback
            });
        }
    }

    /// @notice Create a new lookup table.
    function createTable(string calldata tableName) external onlyOwner {
        tableNames.push(tableName);
    }

    /// @notice Add or update an entry in a lookup table.
    function setEntry(string calldata tableName, string calldata key, string calldata value) external onlyOwner {
        if (!tableKeyExists[tableName][key]) {
            tableKeyCount[tableName]++;
        }
        tables[tableName][key] = value;
        tableKeyExists[tableName][key] = true;
    }

    /// @notice Batch set entries in a lookup table.
    function batchSetEntries(
        string calldata tableName,
        string[] calldata keys,
        string[] calldata values
    ) external onlyOwner {
        require(keys.length == values.length, "LookupTransform: array length mismatch");
        for (uint256 i = 0; i < keys.length; i++) {
            if (!tableKeyExists[tableName][keys[i]]) {
                tableKeyCount[tableName]++;
            }
            tables[tableName][keys[i]] = values[i];
            tableKeyExists[tableName][keys[i]] = true;
        }
    }

    /// @notice Remove an entry from a lookup table.
    function removeEntry(string calldata tableName, string calldata key) external onlyOwner {
        if (tableKeyExists[tableName][key]) {
            delete tables[tableName][key];
            delete tableKeyExists[tableName][key];
            tableKeyCount[tableName]--;
        }
    }

    /// @notice Look up a value in a named table.
    function lookup(string calldata tableName, string calldata key) external view returns (string memory value, bool found) {
        if (tableKeyExists[tableName][key]) {
            return (tables[tableName][key], true);
        }
        return ("", false);
    }

    /// @notice Look up with a fallback value if key is not found.
    function lookupWithFallback(
        string calldata tableName,
        string calldata key,
        string calldata fallback
    ) external view returns (string memory value) {
        if (tableKeyExists[tableName][key]) {
            return tables[tableName][key];
        }
        return fallback;
    }

    /// @notice Get the number of named lookup tables.
    function tableCount() external view returns (uint256) {
        return tableNames.length;
    }

    function getLookupMetadata(uint256 recordId) external view returns (LookupMetadata memory) {
        return lookupMetadata[recordId];
    }
}

// ---------------------------------------------------------------------------
// Provider: MigrationLookupTransform
// ---------------------------------------------------------------------------

/// @title MigrationLookupTransform — on-chain provenance ID resolution.
/// @notice Maintains a mapping from old (source system) IDs to new (target system)
///         IDs, enabling ID resolution during data migration. Each mapping is
///         scoped by entity type (e.g., "author", "post") and import batch.
contract MigrationLookupTransform is BaseTransformProvider {
    struct MigrationMetadata {
        string entityType;        // Entity type (e.g., "author", "post")
        string oldId;             // Original ID from source system
        string newId;             // Resolved ID in target system
        bool   resolved;          // Whether the ID was successfully resolved
        uint256 importBatchId;    // Which import batch created this mapping
    }

    mapping(uint256 => MigrationMetadata) public migrationMetadata;

    /// @notice Provenance map: entityType => oldId => newId.
    mapping(string => mapping(string => string)) public provenanceMap;

    /// @notice Track which mappings exist.
    mapping(string => mapping(string => bool)) public mappingExists;

    /// @notice Import batch counter.
    uint256 public nextBatchId;

    /// @notice Batch metadata.
    mapping(uint256 => uint256) public batchMappingCount;
    mapping(uint256 => uint256) public batchCreatedAt;

    constructor(address _registry) BaseTransformProvider(_registry) {
        nextBatchId = 1;
    }

    function providerId() external pure override returns (string memory) {
        return "migration_lookup";
    }

    function transform(
        bytes32 inputHash,
        bytes32 outputHash,
        string calldata inputType,
        string calldata outputType,
        bytes calldata configData
    ) external override onlyRegistry returns (uint256 recordId) {
        recordId = _recordTransform(inputHash, outputHash, inputType, outputType, configData);

        if (configData.length > 0) {
            (
                string memory entityType,
                string memory oldId,
                string memory newId,
                bool resolved,
                uint256 importBatchId
            ) = abi.decode(configData, (string, string, string, bool, uint256));

            migrationMetadata[recordId] = MigrationMetadata({
                entityType: entityType,
                oldId: oldId,
                newId: newId,
                resolved: resolved,
                importBatchId: importBatchId
            });
        }
    }

    /// @notice Start a new import batch.
    function startBatch() external onlyOwner returns (uint256 batchId) {
        batchId = nextBatchId++;
        batchCreatedAt[batchId] = block.timestamp;
    }

    /// @notice Register a single ID mapping in the provenance map.
    function registerMapping(
        string calldata entityType,
        string calldata oldId,
        string calldata newId,
        uint256 batchId
    ) external onlyOwner {
        provenanceMap[entityType][oldId] = newId;
        mappingExists[entityType][oldId] = true;
        batchMappingCount[batchId]++;
    }

    /// @notice Batch register ID mappings.
    function batchRegisterMappings(
        string calldata entityType,
        string[] calldata oldIds,
        string[] calldata newIds,
        uint256 batchId
    ) external onlyOwner {
        require(oldIds.length == newIds.length, "MigrationLookupTransform: array length mismatch");
        for (uint256 i = 0; i < oldIds.length; i++) {
            provenanceMap[entityType][oldIds[i]] = newIds[i];
            mappingExists[entityType][oldIds[i]] = true;
        }
        batchMappingCount[batchId] += oldIds.length;
    }

    /// @notice Resolve an old ID to a new ID.
    function resolve(string calldata entityType, string calldata oldId) external view returns (string memory newId, bool found) {
        if (mappingExists[entityType][oldId]) {
            return (provenanceMap[entityType][oldId], true);
        }
        return ("", false);
    }

    function getMigrationMetadata(uint256 recordId) external view returns (MigrationMetadata memory) {
        return migrationMetadata[recordId];
    }
}
