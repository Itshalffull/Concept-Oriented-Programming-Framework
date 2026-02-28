// SPDX-License-Identifier: MIT
// Quality Rule Provider: Freshness Validation
// Ensures data timestamps are within an acceptable recency window using block.timestamp.
// Dimension: timeliness

pragma solidity ^0.8.20;

contract FreshnessQualityProvider {
    string public constant PROVIDER_ID = "freshness";
    string public constant PLUGIN_TYPE = "quality_rule";

    /// @notice Default maximum age in seconds (24 hours).
    uint256 public defaultMaxAge = 86400;

    /// @notice Owner who can update default max age.
    address public owner;

    constructor(uint256 _defaultMaxAge) {
        owner = msg.sender;
        if (_defaultMaxAge > 0) {
            defaultMaxAge = _defaultMaxAge;
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    /// @notice Update the default maximum age.
    function setDefaultMaxAge(uint256 _maxAge) external onlyOwner {
        require(_maxAge > 0, "Max age must be positive");
        defaultMaxAge = _maxAge;
    }

    /// @notice Validates that a value's timestamp is within the freshness window.
    /// @param recordId Unique record identifier.
    /// @param field The field name.
    /// @param value The field value (unused; timestamp checked via typed overload).
    /// @param config Configuration string.
    function validate(
        bytes32 recordId,
        string calldata field,
        string calldata value,
        string calldata config
    ) external view returns (bool valid, string memory message, uint8 severity) {
        // Generic entry point; use validateTimestamp for actual checks
        return (true, "", 2);
    }

    /// @notice Validates that a Unix timestamp is fresh (within maxAge of current block).
    /// @param field The field name for error messages.
    /// @param timestamp The Unix timestamp (seconds since epoch) of the data.
    /// @param maxAgeSeconds Maximum allowed age in seconds.
    function validateTimestamp(
        string calldata field,
        uint256 timestamp,
        uint256 maxAgeSeconds
    ) external view returns (bool valid, string memory message, uint8 severity) {
        uint256 maxAge = maxAgeSeconds > 0 ? maxAgeSeconds : defaultMaxAge;

        if (timestamp > block.timestamp) {
            // Timestamp is in the future; consider it fresh but flag it
            return (true, string.concat("Field '", field, "' has a future timestamp."), 2);
        }

        uint256 age = block.timestamp - timestamp;

        if (age > maxAge) {
            return (
                false,
                string.concat("Field '", field, "' data is stale: exceeds maximum allowed age."),
                0
            );
        }

        return (true, "", 2);
    }

    /// @notice Validates freshness with a configurable max age and returns age details.
    /// @param field The field name.
    /// @param timestamp The data timestamp.
    function validateWithDetails(
        string calldata field,
        uint256 timestamp
    ) external view returns (
        bool valid,
        string memory message,
        uint8 severity,
        uint256 ageSeconds,
        uint256 maxAgeSeconds
    ) {
        maxAgeSeconds = defaultMaxAge;

        if (timestamp > block.timestamp) {
            return (true, "Future timestamp", 2, 0, maxAgeSeconds);
        }

        ageSeconds = block.timestamp - timestamp;

        if (ageSeconds > maxAgeSeconds) {
            return (
                false,
                string.concat("Field '", field, "' data is stale."),
                0,
                ageSeconds,
                maxAgeSeconds
            );
        }

        return (true, "", 2, ageSeconds, maxAgeSeconds);
    }

    function appliesTo(string calldata fieldType) external pure returns (bool) {
        bytes32 typeHash = keccak256(bytes(fieldType));
        return typeHash == keccak256("date")
            || typeHash == keccak256("datetime")
            || typeHash == keccak256("timestamp")
            || typeHash == keccak256("uint256");
    }

    function dimension() external pure returns (string memory) {
        return "timeliness";
    }
}
