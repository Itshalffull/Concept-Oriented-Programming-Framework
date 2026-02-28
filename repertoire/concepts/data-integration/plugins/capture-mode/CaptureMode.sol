// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Capture Mode Plugin — on-chain capture strategy registry and provider implementations
// for the Capture concept in the Clef Data Integration Kit.
//
// On-chain capture records provide an immutable audit trail of content provenance,
// timestamp attestation, and hash-based deduplication. Actual content is stored
// off-chain (IPFS, Arweave, or centralized storage); only metadata and content
// hashes live on-chain.
//
// See Data Integration Kit capture.concept for the parent Capture concept definition.

// ---------------------------------------------------------------------------
// Core types and interfaces
// ---------------------------------------------------------------------------

/// @title ICaptureMode — interface for all capture-mode provider contracts.
interface ICaptureMode {
    /// @notice Metadata about a captured item stored on-chain.
    struct CaptureRecord {
        bytes32 contentHash;       // SHA-256 of captured content
        string  providerId;        // e.g., "web_article", "file_upload"
        string  sourceUrl;         // Original URL or source identifier
        string  title;             // Title extracted from source
        string  mimeType;          // Detected MIME type
        string  contentUri;        // Off-chain content location (IPFS CID, Arweave txId, etc.)
        uint256 capturedAt;        // Block timestamp of capture
        address capturedBy;        // Address that initiated the capture
        bytes   extraData;         // ABI-encoded provider-specific metadata
    }

    /// @notice Execute a capture operation and record it on-chain.
    /// @param sourceUrl     The URL or identifier of the content source.
    /// @param contentHash   SHA-256 hash of the captured content.
    /// @param contentUri    Off-chain content storage URI.
    /// @param title         Extracted title.
    /// @param mimeType      Detected MIME type.
    /// @param extraData     ABI-encoded provider-specific metadata.
    /// @return captureId    Unique identifier for the capture record.
    function capture(
        string calldata sourceUrl,
        bytes32 contentHash,
        string calldata contentUri,
        string calldata title,
        string calldata mimeType,
        bytes calldata extraData
    ) external returns (uint256 captureId);

    /// @notice Check whether this provider supports a given source type.
    /// @param sourceType    The type identifier (e.g., "url", "file", "email").
    /// @return supported    True if the provider can handle this source type.
    function supports(string calldata sourceType) external view returns (bool supported);

    /// @notice Retrieve a capture record by its ID.
    /// @param captureId     The unique capture identifier.
    /// @return record       The capture record.
    function getCapture(uint256 captureId) external view returns (CaptureRecord memory record);

    /// @notice Emitted when a new capture is recorded.
    event CaptureRecorded(
        uint256 indexed captureId,
        address indexed capturedBy,
        string  providerId,
        bytes32 contentHash,
        string  sourceUrl,
        uint256 capturedAt
    );

    /// @notice Emitted when a duplicate content hash is detected.
    event DuplicateDetected(
        uint256 indexed captureId,
        uint256 indexed originalCaptureId,
        bytes32 contentHash
    );
}

// ---------------------------------------------------------------------------
// Capture Mode Registry — central dispatch for provider contracts
// ---------------------------------------------------------------------------

/// @title CaptureModeRegistry — registry and router for capture-mode provider contracts.
/// @notice Manages registration, lookup, and dispatch to provider implementations.
///         Maintains a global capture log and content-hash index for deduplication.
contract CaptureModeRegistry {
    // -- State ---------------------------------------------------------------

    address public owner;
    uint256 public nextCaptureId;

    /// @notice Registered providers: providerId => contract address.
    mapping(string => address) public providers;

    /// @notice List of all registered provider IDs.
    string[] public providerIds;

    /// @notice Global capture record store.
    mapping(uint256 => ICaptureMode.CaptureRecord) public captures;

    /// @notice Content hash to first capture ID (deduplication index).
    mapping(bytes32 => uint256) public contentHashIndex;

    /// @notice Captures by address.
    mapping(address => uint256[]) public capturesByAddress;

    // -- Events --------------------------------------------------------------

    event ProviderRegistered(string indexed providerId, address providerAddress);
    event ProviderUpdated(string indexed providerId, address oldAddress, address newAddress);
    event ProviderRemoved(string indexed providerId);
    event CaptureRecorded(
        uint256 indexed captureId,
        address indexed capturedBy,
        string  providerId,
        bytes32 contentHash,
        string  sourceUrl,
        uint256 capturedAt
    );
    event DuplicateDetected(
        uint256 indexed captureId,
        uint256 indexed originalCaptureId,
        bytes32 contentHash
    );

    // -- Modifiers -----------------------------------------------------------

    modifier onlyOwner() {
        require(msg.sender == owner, "CaptureModeRegistry: caller is not the owner");
        _;
    }

    // -- Constructor ----------------------------------------------------------

    constructor() {
        owner = msg.sender;
        nextCaptureId = 1;
    }

    // -- Provider management -------------------------------------------------

    /// @notice Register a new capture-mode provider.
    /// @param providerId   Unique identifier (e.g., "web_article").
    /// @param providerAddr Address of the provider contract implementing ICaptureMode.
    function registerProvider(string calldata providerId, address providerAddr) external onlyOwner {
        require(providerAddr != address(0), "CaptureModeRegistry: zero address");
        require(providers[providerId] == address(0), "CaptureModeRegistry: provider already registered");

        providers[providerId] = providerAddr;
        providerIds.push(providerId);

        emit ProviderRegistered(providerId, providerAddr);
    }

    /// @notice Update an existing provider's contract address.
    /// @param providerId   The provider to update.
    /// @param newAddr      New contract address.
    function updateProvider(string calldata providerId, address newAddr) external onlyOwner {
        require(newAddr != address(0), "CaptureModeRegistry: zero address");
        address oldAddr = providers[providerId];
        require(oldAddr != address(0), "CaptureModeRegistry: provider not registered");

        providers[providerId] = newAddr;

        emit ProviderUpdated(providerId, oldAddr, newAddr);
    }

    /// @notice Remove a registered provider.
    /// @param providerId   The provider to remove.
    function removeProvider(string calldata providerId) external onlyOwner {
        require(providers[providerId] != address(0), "CaptureModeRegistry: provider not registered");
        delete providers[providerId];

        // Remove from providerIds array
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

    /// @notice Check if a provider supports a given source type.
    function providerSupports(string calldata providerId, string calldata sourceType) external view returns (bool) {
        address providerAddr = providers[providerId];
        if (providerAddr == address(0)) return false;
        return ICaptureMode(providerAddr).supports(sourceType);
    }

    // -- Capture operations --------------------------------------------------

    /// @notice Execute a capture through a specific provider.
    /// @param providerId   The provider to use for capture.
    /// @param sourceUrl    The URL or source identifier.
    /// @param contentHash  SHA-256 hash of the captured content.
    /// @param contentUri   Off-chain storage URI for the content.
    /// @param title        Extracted title metadata.
    /// @param mimeType     Detected MIME type.
    /// @param extraData    ABI-encoded provider-specific data.
    /// @return captureId   Unique ID of the recorded capture.
    function captureWith(
        string calldata providerId,
        string calldata sourceUrl,
        bytes32 contentHash,
        string calldata contentUri,
        string calldata title,
        string calldata mimeType,
        bytes calldata extraData
    ) external returns (uint256 captureId) {
        address providerAddr = providers[providerId];
        require(providerAddr != address(0), "CaptureModeRegistry: unknown provider");

        captureId = nextCaptureId++;

        // Store the capture record
        captures[captureId] = ICaptureMode.CaptureRecord({
            contentHash: contentHash,
            providerId: providerId,
            sourceUrl: sourceUrl,
            title: title,
            mimeType: mimeType,
            contentUri: contentUri,
            capturedAt: block.timestamp,
            capturedBy: msg.sender,
            extraData: extraData
        });

        capturesByAddress[msg.sender].push(captureId);

        // Check for duplicate content
        uint256 existingId = contentHashIndex[contentHash];
        if (existingId != 0) {
            emit DuplicateDetected(captureId, existingId, contentHash);
        } else {
            contentHashIndex[contentHash] = captureId;
        }

        // Delegate to provider contract for provider-specific validation/recording
        ICaptureMode(providerAddr).capture(
            sourceUrl, contentHash, contentUri, title, mimeType, extraData
        );

        emit CaptureRecorded(captureId, msg.sender, providerId, contentHash, sourceUrl, block.timestamp);
    }

    /// @notice Auto-resolve the best provider for a source type and capture.
    /// @dev Iterates registered providers and uses the first that supports the source type.
    function captureAuto(
        string calldata sourceType,
        string calldata sourceUrl,
        bytes32 contentHash,
        string calldata contentUri,
        string calldata title,
        string calldata mimeType,
        bytes calldata extraData
    ) external returns (uint256 captureId) {
        for (uint256 i = 0; i < providerIds.length; i++) {
            address providerAddr = providers[providerIds[i]];
            if (providerAddr != address(0) && ICaptureMode(providerAddr).supports(sourceType)) {
                return this.captureWith(
                    providerIds[i], sourceUrl, contentHash, contentUri, title, mimeType, extraData
                );
            }
        }
        revert("CaptureModeRegistry: no provider supports this source type");
    }

    // -- Query operations ----------------------------------------------------

    /// @notice Retrieve a capture record by ID.
    function getCapture(uint256 captureId) external view returns (ICaptureMode.CaptureRecord memory) {
        require(captureId > 0 && captureId < nextCaptureId, "CaptureModeRegistry: invalid capture ID");
        return captures[captureId];
    }

    /// @notice Look up the first capture with a given content hash.
    function getCaptureByHash(bytes32 contentHash) external view returns (uint256) {
        return contentHashIndex[contentHash];
    }

    /// @notice Get all capture IDs for an address.
    function getCapturesByAddress(address addr) external view returns (uint256[] memory) {
        return capturesByAddress[addr];
    }

    /// @notice Transfer ownership of the registry.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "CaptureModeRegistry: zero address");
        owner = newOwner;
    }
}

// ---------------------------------------------------------------------------
// Base contract for shared provider logic
// ---------------------------------------------------------------------------

/// @title BaseCaptureProvider — shared implementation for capture-mode providers.
/// @notice Provides common record storage, access control, and event emission.
abstract contract BaseCaptureProvider is ICaptureMode {
    address public registry;
    address public owner;
    uint256 public captureCount;

    mapping(uint256 => CaptureRecord) internal _captures;

    modifier onlyRegistry() {
        require(msg.sender == registry, "BaseCaptureProvider: caller is not the registry");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "BaseCaptureProvider: caller is not the owner");
        _;
    }

    constructor(address _registry) {
        registry = _registry;
        owner = msg.sender;
    }

    function getCapture(uint256 captureId) external view override returns (CaptureRecord memory) {
        return _captures[captureId];
    }

    function _recordCapture(
        string calldata sourceUrl,
        bytes32 contentHash,
        string calldata contentUri,
        string calldata title,
        string calldata mimeType,
        bytes calldata extraData
    ) internal returns (uint256 captureId) {
        captureId = ++captureCount;

        _captures[captureId] = CaptureRecord({
            contentHash: contentHash,
            providerId: _providerId(),
            sourceUrl: sourceUrl,
            title: title,
            mimeType: mimeType,
            contentUri: contentUri,
            capturedAt: block.timestamp,
            capturedBy: tx.origin,
            extraData: extraData
        });

        emit CaptureRecorded(captureId, tx.origin, _providerId(), contentHash, sourceUrl, block.timestamp);
    }

    /// @dev Override in each provider to return its unique ID.
    function _providerId() internal pure virtual returns (string memory);
}

// ---------------------------------------------------------------------------
// Provider: WebArticleCapture
// ---------------------------------------------------------------------------

/// @title WebArticleCapture — on-chain record for Readability-extracted article captures.
/// @notice Records article captures with metadata about extraction quality:
///         word count, detected author, publish date, and Readability confidence score.
///         The actual article text is stored off-chain at the contentUri.
///
///         Extraction pipeline (off-chain):
///         1. Fetch page HTML
///         2. Remove unlikely candidates (scripts, styles, nav, sidebar, ads)
///         3. Score block elements by text density, link density, paragraph count
///         4. Select top-scoring node as article container
///         5. Clean article: remove forms, social widgets, related content
///         6. Extract title, author, date from Open Graph and meta tags
///         7. Convert to plain text, hash, and submit on-chain
contract WebArticleCapture is BaseCaptureProvider {
    /// @notice Article-specific metadata stored alongside the capture record.
    struct ArticleMetadata {
        uint32 wordCount;            // Word count of extracted article
        uint8  readabilityScore;     // 0-100 confidence in extraction quality
        string author;               // Detected article author
        string publishDate;          // ISO-8601 publish date if found
        string language;             // Detected language (e.g., "en")
        string siteName;             // Site name from og:site_name
    }

    mapping(uint256 => ArticleMetadata) public articleMetadata;

    constructor(address _registry) BaseCaptureProvider(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "web_article";
    }

    function supports(string calldata sourceType) external pure override returns (bool) {
        return keccak256(bytes(sourceType)) == keccak256(bytes("url"));
    }

    function capture(
        string calldata sourceUrl,
        bytes32 contentHash,
        string calldata contentUri,
        string calldata title,
        string calldata mimeType,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 captureId) {
        captureId = _recordCapture(sourceUrl, contentHash, contentUri, title, mimeType, extraData);

        // Decode article-specific metadata from extraData
        if (extraData.length > 0) {
            (
                uint32 wordCount,
                uint8 readabilityScore,
                string memory author,
                string memory publishDate,
                string memory language,
                string memory siteName
            ) = abi.decode(extraData, (uint32, uint8, string, string, string, string));

            articleMetadata[captureId] = ArticleMetadata({
                wordCount: wordCount,
                readabilityScore: readabilityScore,
                author: author,
                publishDate: publishDate,
                language: language,
                siteName: siteName
            });
        }
    }

    /// @notice Get article-specific metadata for a capture.
    function getArticleMetadata(uint256 captureId) external view returns (ArticleMetadata memory) {
        return articleMetadata[captureId];
    }
}

// ---------------------------------------------------------------------------
// Provider: WebBookmarkCapture
// ---------------------------------------------------------------------------

/// @title WebBookmarkCapture — on-chain record for metadata-only bookmark captures.
/// @notice Stores lightweight bookmark records: title, URL, description, favicon,
///         site name, Open Graph image, and theme color. No full content is captured;
///         this provider records only discoverable metadata from the page's <head>.
contract WebBookmarkCapture is BaseCaptureProvider {
    /// @notice Bookmark-specific metadata.
    struct BookmarkMetadata {
        string description;       // og:description or meta description
        string favicon;           // Favicon URL
        string ogImage;           // Open Graph image URL
        string siteName;          // og:site_name
        string themeColor;        // meta theme-color
        string canonicalUrl;      // <link rel="canonical">
    }

    mapping(uint256 => BookmarkMetadata) public bookmarkMetadata;

    constructor(address _registry) BaseCaptureProvider(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "web_bookmark";
    }

    function supports(string calldata sourceType) external pure override returns (bool) {
        return keccak256(bytes(sourceType)) == keccak256(bytes("url"));
    }

    function capture(
        string calldata sourceUrl,
        bytes32 contentHash,
        string calldata contentUri,
        string calldata title,
        string calldata mimeType,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 captureId) {
        captureId = _recordCapture(sourceUrl, contentHash, contentUri, title, mimeType, extraData);

        // Decode bookmark-specific metadata
        if (extraData.length > 0) {
            (
                string memory description,
                string memory favicon,
                string memory ogImage,
                string memory siteName,
                string memory themeColor,
                string memory canonicalUrl
            ) = abi.decode(extraData, (string, string, string, string, string, string));

            bookmarkMetadata[captureId] = BookmarkMetadata({
                description: description,
                favicon: favicon,
                ogImage: ogImage,
                siteName: siteName,
                themeColor: themeColor,
                canonicalUrl: canonicalUrl
            });
        }
    }

    /// @notice Get bookmark-specific metadata for a capture.
    function getBookmarkMetadata(uint256 captureId) external view returns (BookmarkMetadata memory) {
        return bookmarkMetadata[captureId];
    }
}

// ---------------------------------------------------------------------------
// Provider: FileUploadCapture
// ---------------------------------------------------------------------------

/// @title FileUploadCapture — on-chain record for file upload captures.
/// @notice Records file ingestion with MIME detection results, file metadata,
///         and content hash for deduplication. Supports tracking of:
///         - Magic-byte MIME detection vs extension-based detection
///         - Original filename and path
///         - File size for storage accounting
///         - SHA-256 content hash for dedup across captures
contract FileUploadCapture is BaseCaptureProvider {
    /// @notice File-specific metadata.
    struct FileMetadata {
        string  fileName;          // Original file name
        string  fileExtension;     // File extension (without dot)
        uint256 sizeBytes;         // File size in bytes
        string  detectedMime;      // MIME from magic bytes
        string  extensionMime;     // MIME from file extension
        bytes32 sha256Hash;        // Content hash for deduplication
    }

    mapping(uint256 => FileMetadata) public fileMetadata;

    /// @notice Total bytes captured through this provider.
    uint256 public totalBytesCaptured;

    /// @notice File hash to capture ID index for deduplication.
    mapping(bytes32 => uint256) public fileHashIndex;

    constructor(address _registry) BaseCaptureProvider(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "file_upload";
    }

    function supports(string calldata sourceType) external pure override returns (bool) {
        return keccak256(bytes(sourceType)) == keccak256(bytes("file"));
    }

    function capture(
        string calldata sourceUrl,
        bytes32 contentHash,
        string calldata contentUri,
        string calldata title,
        string calldata mimeType,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 captureId) {
        captureId = _recordCapture(sourceUrl, contentHash, contentUri, title, mimeType, extraData);

        // Decode file-specific metadata
        if (extraData.length > 0) {
            (
                string memory fileName,
                string memory fileExtension,
                uint256 sizeBytes,
                string memory detectedMime,
                string memory extensionMime,
                bytes32 sha256Hash
            ) = abi.decode(extraData, (string, string, uint256, string, string, bytes32));

            fileMetadata[captureId] = FileMetadata({
                fileName: fileName,
                fileExtension: fileExtension,
                sizeBytes: sizeBytes,
                detectedMime: detectedMime,
                extensionMime: extensionMime,
                sha256Hash: sha256Hash
            });

            totalBytesCaptured += sizeBytes;

            // Track file hash for deduplication
            if (fileHashIndex[sha256Hash] == 0) {
                fileHashIndex[sha256Hash] = captureId;
            }
        }
    }

    /// @notice Get file-specific metadata for a capture.
    function getFileMetadata(uint256 captureId) external view returns (FileMetadata memory) {
        return fileMetadata[captureId];
    }

    /// @notice Check if a file with the given SHA-256 hash has already been captured.
    function isFileDuplicate(bytes32 sha256Hash) external view returns (bool, uint256) {
        uint256 existing = fileHashIndex[sha256Hash];
        return (existing != 0, existing);
    }
}

// ---------------------------------------------------------------------------
// Provider: WebFullPageCapture
// ---------------------------------------------------------------------------

/// @title WebFullPageCapture — on-chain record for full HTML page snapshots.
/// @notice Records full page captures with metadata about inline resource counts,
///         snapshot size, and whether styles/images were inlined.
contract WebFullPageCapture is BaseCaptureProvider {
    struct FullPageMetadata {
        uint256 snapshotSizeBytes;    // Size of the full snapshot
        bool    stylesInlined;        // Whether CSS was inlined
        bool    imagesInlined;        // Whether images were base64-inlined
        uint32  resourceCount;        // Number of external resources resolved
    }

    mapping(uint256 => FullPageMetadata) public fullPageMetadata;

    constructor(address _registry) BaseCaptureProvider(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "web_full_page";
    }

    function supports(string calldata sourceType) external pure override returns (bool) {
        return keccak256(bytes(sourceType)) == keccak256(bytes("url"));
    }

    function capture(
        string calldata sourceUrl,
        bytes32 contentHash,
        string calldata contentUri,
        string calldata title,
        string calldata mimeType,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 captureId) {
        captureId = _recordCapture(sourceUrl, contentHash, contentUri, title, mimeType, extraData);

        if (extraData.length > 0) {
            (
                uint256 snapshotSize,
                bool stylesInlined,
                bool imagesInlined,
                uint32 resourceCount
            ) = abi.decode(extraData, (uint256, bool, bool, uint32));

            fullPageMetadata[captureId] = FullPageMetadata({
                snapshotSizeBytes: snapshotSize,
                stylesInlined: stylesInlined,
                imagesInlined: imagesInlined,
                resourceCount: resourceCount
            });
        }
    }

    function getFullPageMetadata(uint256 captureId) external view returns (FullPageMetadata memory) {
        return fullPageMetadata[captureId];
    }
}

// ---------------------------------------------------------------------------
// Provider: WebMarkdownCapture
// ---------------------------------------------------------------------------

/// @title WebMarkdownCapture — on-chain record for HTML-to-Markdown captures.
/// @notice Records conversions performed via Turndown-equivalent rules with
///         YAML frontmatter generation. Tracks conversion configuration and
///         source metadata extracted for the frontmatter.
contract WebMarkdownCapture is BaseCaptureProvider {
    struct MarkdownMetadata {
        string headingStyle;      // "atx" or "setext"
        string codeBlockStyle;    // "fenced" or "indented"
        string bulletListMarker;  // "-", "+", or "*"
        bool   hasFrontmatter;   // Whether YAML frontmatter was generated
        uint32 wordCount;         // Word count of the markdown output
    }

    mapping(uint256 => MarkdownMetadata) public markdownMetadata;

    constructor(address _registry) BaseCaptureProvider(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "web_markdown";
    }

    function supports(string calldata sourceType) external pure override returns (bool) {
        return keccak256(bytes(sourceType)) == keccak256(bytes("url"));
    }

    function capture(
        string calldata sourceUrl,
        bytes32 contentHash,
        string calldata contentUri,
        string calldata title,
        string calldata mimeType,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 captureId) {
        captureId = _recordCapture(sourceUrl, contentHash, contentUri, title, mimeType, extraData);

        if (extraData.length > 0) {
            (
                string memory headingStyle,
                string memory codeBlockStyle,
                string memory bulletListMarker,
                bool hasFrontmatter,
                uint32 wordCount
            ) = abi.decode(extraData, (string, string, string, bool, uint32));

            markdownMetadata[captureId] = MarkdownMetadata({
                headingStyle: headingStyle,
                codeBlockStyle: codeBlockStyle,
                bulletListMarker: bulletListMarker,
                hasFrontmatter: hasFrontmatter,
                wordCount: wordCount
            });
        }
    }

    function getMarkdownMetadata(uint256 captureId) external view returns (MarkdownMetadata memory) {
        return markdownMetadata[captureId];
    }
}

// ---------------------------------------------------------------------------
// Provider: EmailForwardCapture
// ---------------------------------------------------------------------------

/// @title EmailForwardCapture — on-chain record for forwarded email captures.
/// @notice Records parsed RFC 2822 email metadata. The full email body is stored
///         off-chain; on-chain records track the message envelope (from, to, subject,
///         date, message-id) and attachment count for audit and search purposes.
contract EmailForwardCapture is BaseCaptureProvider {
    struct EmailMetadata {
        string  fromAddress;        // Decoded sender
        string  toAddress;          // Decoded recipient
        string  subject;            // Decoded subject (RFC 2047)
        string  date;               // Original Date header
        string  messageId;          // Message-ID header
        uint32  attachmentCount;    // Number of attachments extracted
        bool    hasHtmlBody;        // Whether an HTML alternative was present
    }

    mapping(uint256 => EmailMetadata) public emailMetadata;

    constructor(address _registry) BaseCaptureProvider(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "email_forward";
    }

    function supports(string calldata sourceType) external pure override returns (bool) {
        return keccak256(bytes(sourceType)) == keccak256(bytes("email"));
    }

    function capture(
        string calldata sourceUrl,
        bytes32 contentHash,
        string calldata contentUri,
        string calldata title,
        string calldata mimeType,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 captureId) {
        captureId = _recordCapture(sourceUrl, contentHash, contentUri, title, mimeType, extraData);

        if (extraData.length > 0) {
            (
                string memory fromAddr,
                string memory toAddr,
                string memory subject,
                string memory date,
                string memory messageId,
                uint32 attachmentCount,
                bool hasHtml
            ) = abi.decode(extraData, (string, string, string, string, string, uint32, bool));

            emailMetadata[captureId] = EmailMetadata({
                fromAddress: fromAddr,
                toAddress: toAddr,
                subject: subject,
                date: date,
                messageId: messageId,
                attachmentCount: attachmentCount,
                hasHtmlBody: hasHtml
            });
        }
    }

    function getEmailMetadata(uint256 captureId) external view returns (EmailMetadata memory) {
        return emailMetadata[captureId];
    }
}

// ---------------------------------------------------------------------------
// Provider: ApiPollCapture
// ---------------------------------------------------------------------------

/// @title ApiPollCapture — on-chain record for API poll captures with delta detection.
/// @notice Records periodic API query results. Tracks pagination cursor/watermark
///         state for delta detection across polls. Each capture records the items
///         found, pages traversed, and cursor state for the next poll.
contract ApiPollCapture is BaseCaptureProvider {
    struct PollMetadata {
        string  endpointUrl;          // API endpoint that was polled
        string  deltaStrategy;        // "watermark", "etag", or "hash"
        string  paginationStrategy;   // "cursor", "offset", or "link"
        uint32  itemCount;            // Number of new items detected
        uint32  pagesCollected;       // Number of pages traversed
        string  lastCursor;           // Cursor for next poll
        bool    deltaDetected;        // Whether new data was found
    }

    mapping(uint256 => PollMetadata) public pollMetadata;

    /// @notice Track last cursor per endpoint for stateful polling.
    mapping(bytes32 => string) public endpointCursors;

    constructor(address _registry) BaseCaptureProvider(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "api_poll";
    }

    function supports(string calldata sourceType) external pure override returns (bool) {
        return keccak256(bytes(sourceType)) == keccak256(bytes("api_endpoint"));
    }

    function capture(
        string calldata sourceUrl,
        bytes32 contentHash,
        string calldata contentUri,
        string calldata title,
        string calldata mimeType,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 captureId) {
        captureId = _recordCapture(sourceUrl, contentHash, contentUri, title, mimeType, extraData);

        if (extraData.length > 0) {
            (
                string memory endpointUrl,
                string memory deltaStrategy,
                string memory paginationStrategy,
                uint32 itemCount,
                uint32 pagesCollected,
                string memory lastCursor,
                bool deltaDetected
            ) = abi.decode(extraData, (string, string, string, uint32, uint32, string, bool));

            pollMetadata[captureId] = PollMetadata({
                endpointUrl: endpointUrl,
                deltaStrategy: deltaStrategy,
                paginationStrategy: paginationStrategy,
                itemCount: itemCount,
                pagesCollected: pagesCollected,
                lastCursor: lastCursor,
                deltaDetected: deltaDetected
            });

            // Update endpoint cursor state for future polls
            bytes32 endpointKey = keccak256(bytes(endpointUrl));
            endpointCursors[endpointKey] = lastCursor;
        }
    }

    function getPollMetadata(uint256 captureId) external view returns (PollMetadata memory) {
        return pollMetadata[captureId];
    }

    /// @notice Get the stored cursor for an endpoint URL.
    function getEndpointCursor(string calldata endpointUrl) external view returns (string memory) {
        bytes32 key = keccak256(bytes(endpointUrl));
        return endpointCursors[key];
    }
}

// ---------------------------------------------------------------------------
// Provider: ShareIntentCapture
// ---------------------------------------------------------------------------

/// @title ShareIntentCapture — on-chain record for OS share sheet captures.
/// @notice Records content received via mobile/OS share intents. Tracks the
///         intent classification (url_only, text_only, files_with_text, etc.)
///         and shared file metadata.
contract ShareIntentCapture is BaseCaptureProvider {
    struct ShareMetadata {
        string intentType;        // Classification: url_only, text_only, files_only, etc.
        bool   hasText;
        bool   hasUrl;
        uint32 fileCount;
        string platform;          // "ios", "android", "macos", "windows", etc.
    }

    mapping(uint256 => ShareMetadata) public shareMetadata;

    constructor(address _registry) BaseCaptureProvider(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "share_intent";
    }

    function supports(string calldata sourceType) external pure override returns (bool) {
        return keccak256(bytes(sourceType)) == keccak256(bytes("share_intent"));
    }

    function capture(
        string calldata sourceUrl,
        bytes32 contentHash,
        string calldata contentUri,
        string calldata title,
        string calldata mimeType,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 captureId) {
        captureId = _recordCapture(sourceUrl, contentHash, contentUri, title, mimeType, extraData);

        if (extraData.length > 0) {
            (
                string memory intentType,
                bool hasText,
                bool hasUrl,
                uint32 fileCount,
                string memory platform
            ) = abi.decode(extraData, (string, bool, bool, uint32, string));

            shareMetadata[captureId] = ShareMetadata({
                intentType: intentType,
                hasText: hasText,
                hasUrl: hasUrl,
                fileCount: fileCount,
                platform: platform
            });
        }
    }

    function getShareMetadata(uint256 captureId) external view returns (ShareMetadata memory) {
        return shareMetadata[captureId];
    }
}

// ---------------------------------------------------------------------------
// Provider: WebScreenshotCapture
// ---------------------------------------------------------------------------

/// @title WebScreenshotCapture — on-chain record for visual screenshot captures.
/// @notice Records screenshot metadata including viewport dimensions, format,
///         device scale factor, and whether a full page or element was captured.
contract WebScreenshotCapture is BaseCaptureProvider {
    struct ScreenshotMetadata {
        string format;             // "png" or "jpeg"
        uint32 viewportWidth;
        uint32 viewportHeight;
        uint8  deviceScaleFactor;
        bool   fullPage;
        string selector;           // CSS selector if element capture, empty otherwise
        uint256 imageSizeBytes;
    }

    mapping(uint256 => ScreenshotMetadata) public screenshotMetadata;

    constructor(address _registry) BaseCaptureProvider(_registry) {}

    function _providerId() internal pure override returns (string memory) {
        return "web_screenshot";
    }

    function supports(string calldata sourceType) external pure override returns (bool) {
        return keccak256(bytes(sourceType)) == keccak256(bytes("url"));
    }

    function capture(
        string calldata sourceUrl,
        bytes32 contentHash,
        string calldata contentUri,
        string calldata title,
        string calldata mimeType,
        bytes calldata extraData
    ) external override onlyRegistry returns (uint256 captureId) {
        captureId = _recordCapture(sourceUrl, contentHash, contentUri, title, mimeType, extraData);

        if (extraData.length > 0) {
            (
                string memory format,
                uint32 vpWidth,
                uint32 vpHeight,
                uint8 scale,
                bool fullPage,
                string memory selector,
                uint256 imageSize
            ) = abi.decode(extraData, (string, uint32, uint32, uint8, bool, string, uint256));

            screenshotMetadata[captureId] = ScreenshotMetadata({
                format: format,
                viewportWidth: vpWidth,
                viewportHeight: vpHeight,
                deviceScaleFactor: scale,
                fullPage: fullPage,
                selector: selector,
                imageSizeBytes: imageSize
            });
        }
    }

    function getScreenshotMetadata(uint256 captureId) external view returns (ScreenshotMetadata memory) {
        return screenshotMetadata[captureId];
    }
}
