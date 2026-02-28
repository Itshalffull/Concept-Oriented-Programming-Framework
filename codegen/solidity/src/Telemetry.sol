// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Telemetry
/// @notice Telemetry and metrics management with configuration, deploy markers, and analysis.
/// @dev Tracks observability configurations, deploy events, and provides health analysis.

contract Telemetry {

    // --- Storage ---

    struct ConfigEntry {
        string concept;
        string endpoint;
        uint256 samplingRate;
        uint256 createdAt;
        bool exists;
    }

    mapping(bytes32 => ConfigEntry) private _configs;
    bytes32[] private _configIds;
    mapping(bytes32 => bool) private _configExists;

    struct MarkerEntry {
        string kit;
        string version;
        string environment;
        string status;
        uint256 createdAt;
        bool exists;
    }

    mapping(bytes32 => MarkerEntry) private _markers;
    bytes32[] private _markerIds;
    mapping(bytes32 => bool) private _markerExists;

    // --- Types ---

    struct ConfigureInput {
        string concept;
        string endpoint;
        uint256 samplingRate;
    }

    struct ConfigureOkResult {
        bool success;
        bytes32 config;
    }

    struct DeployMarkerInput {
        string kit;
        string version;
        string environment;
        string status;
    }

    struct DeployMarkerOkResult {
        bool success;
        bytes32 marker;
    }

    struct DeployMarkerBackendUnavailableResult {
        bool success;
        string endpoint;
    }

    struct AnalyzeInput {
        string concept;
        int256 window;
        string criteria;
    }

    struct AnalyzeOkResult {
        bool success;
        bool healthy;
        uint256 errorRate;
        int256 latencyP99;
        int256 sampleSize;
    }

    struct AnalyzeInsufficientDataResult {
        bool success;
        string concept;
        int256 samplesFound;
        int256 samplesNeeded;
    }

    struct AnalyzeBackendUnavailableResult {
        bool success;
        string endpoint;
    }

    // --- Events ---

    event ConfigureCompleted(string variant, bytes32 config);
    event DeployMarkerCompleted(string variant, bytes32 marker);
    event AnalyzeCompleted(string variant, bool healthy, uint256 errorRate, int256 latencyP99, int256 sampleSize, int256 samplesFound, int256 samplesNeeded);

    // --- Actions ---

    /// @notice configure - Configures telemetry collection for a concept.
    function configure(string memory concept, string memory endpoint, uint256 samplingRate) external returns (ConfigureOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(endpoint).length > 0, "Endpoint must not be empty");
        require(samplingRate > 0 && samplingRate <= 100, "Sampling rate must be between 1 and 100");

        bytes32 configId = keccak256(abi.encodePacked("config:", concept));

        _configs[configId] = ConfigEntry({
            concept: concept,
            endpoint: endpoint,
            samplingRate: samplingRate,
            createdAt: block.timestamp,
            exists: true
        });

        if (!_configExists[configId]) {
            _configExists[configId] = true;
            _configIds.push(configId);
        }

        emit ConfigureCompleted("ok", configId);

        return ConfigureOkResult({
            success: true,
            config: configId
        });
    }

    /// @notice deployMarker - Records a deployment event marker for observability correlation.
    function deployMarker(string memory kit, string memory version, string memory environment, string memory status) external returns (DeployMarkerOkResult memory) {
        require(bytes(kit).length > 0, "Kit must not be empty");

        bytes32 markerId = keccak256(abi.encodePacked(kit, version, environment, block.timestamp));

        _markers[markerId] = MarkerEntry({
            kit: kit,
            version: version,
            environment: environment,
            status: status,
            createdAt: block.timestamp,
            exists: true
        });
        _markerExists[markerId] = true;
        _markerIds.push(markerId);

        emit DeployMarkerCompleted("ok", markerId);

        return DeployMarkerOkResult({
            success: true,
            marker: markerId
        });
    }

    /// @notice analyze - Analyzes telemetry data for a concept within a time window.
    function analyze(string memory concept, int256 window, string memory criteria) external returns (AnalyzeOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(window > 0, "Window must be positive");

        // Check if concept has telemetry configured
        bytes32 configId = keccak256(abi.encodePacked("config:", concept));
        require(_configExists[configId], "Telemetry not configured for concept");

        // Simulate analysis results based on marker data
        int256 sampleSize = 0;
        for (uint256 i = 0; i < _markerIds.length; i++) {
            if (_markerExists[_markerIds[i]]) {
                sampleSize++;
            }
        }

        bool healthy = true;
        uint256 errorRate = 0;
        int256 latencyP99 = int256(uint256(keccak256(abi.encodePacked(concept, window))) % 200) + 10;

        emit AnalyzeCompleted("ok", healthy, errorRate, latencyP99, sampleSize, 0, 0);

        return AnalyzeOkResult({
            success: true,
            healthy: healthy,
            errorRate: errorRate,
            latencyP99: latencyP99,
            sampleSize: sampleSize
        });
    }
}
