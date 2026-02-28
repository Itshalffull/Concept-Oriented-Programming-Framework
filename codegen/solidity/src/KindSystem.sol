// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title KindSystem
/// @notice Kind taxonomy management with definition, connections, routing, and graph queries.
/// @dev Manages a directed graph of kind types with transform-based edges and path finding.

contract KindSystem {

    // --- Storage ---

    struct KindEntry {
        string name;
        string category;
        uint256 createdAt;
        bool exists;
    }

    struct Edge {
        bytes32 from;
        bytes32 to;
        string relation;
        string transformName;
        bool exists;
    }

    mapping(bytes32 => KindEntry) private _kinds;
    bytes32[] private _kindIds;
    mapping(bytes32 => bool) private _kindExists;

    mapping(bytes32 => Edge) private _edges;
    bytes32[] private _edgeIds;
    mapping(bytes32 => bool) private _edgeExists;

    // Adjacency list: kind -> outgoing edge IDs
    mapping(bytes32 => bytes32[]) private _outEdges;
    // Reverse adjacency: kind -> incoming edge IDs
    mapping(bytes32 => bytes32[]) private _inEdges;

    // --- Types ---

    struct DefineInput {
        string name;
        string category;
    }

    struct DefineOkResult {
        bool success;
        bytes32 kind;
    }

    struct DefineExistsResult {
        bool success;
        bytes32 kind;
    }

    struct ConnectInput {
        bytes32 from;
        bytes32 to;
        string relation;
        string transformName;
    }

    struct ConnectInvalidResult {
        bool success;
        string message;
    }

    struct RouteInput {
        bytes32 from;
        bytes32 to;
    }

    struct RouteOkResult {
        bool success;
        bytes[] path;
    }

    struct RouteUnreachableResult {
        bool success;
        string message;
    }

    struct ValidateInput {
        bytes32 from;
        bytes32 to;
    }

    struct ValidateInvalidResult {
        bool success;
        string message;
    }

    struct DependentsOkResult {
        bool success;
        bytes32[] downstream;
    }

    struct ProducersOkResult {
        bool success;
        bytes[] transforms;
    }

    struct ConsumersOkResult {
        bool success;
        bytes[] transforms;
    }

    struct GraphOkResult {
        bool success;
        bytes[] kinds;
        bytes[] edges;
    }

    // --- Events ---

    event DefineCompleted(string variant, bytes32 kind);
    event ConnectCompleted(string variant);
    event RouteCompleted(string variant, bytes[] path);
    event ValidateCompleted(string variant);
    event DependentsCompleted(string variant, bytes32[] downstream);
    event ProducersCompleted(string variant, bytes[] transforms);
    event ConsumersCompleted(string variant, bytes[] transforms);
    event GraphCompleted(string variant, bytes[] kinds, bytes[] edges);

    // --- Actions ---

    /// @notice define - Registers a new kind in the taxonomy.
    function defineKind(string memory name, string memory category) external returns (DefineOkResult memory) {
        require(bytes(name).length > 0, "Name must not be empty");

        bytes32 kindId = keccak256(abi.encodePacked("kind:", name));

        if (_kindExists[kindId]) {
            emit DefineCompleted("exists", kindId);
            return DefineOkResult({
                success: true,
                kind: kindId
            });
        }

        _kinds[kindId] = KindEntry({
            name: name,
            category: category,
            createdAt: block.timestamp,
            exists: true
        });
        _kindExists[kindId] = true;
        _kindIds.push(kindId);

        emit DefineCompleted("ok", kindId);

        return DefineOkResult({
            success: true,
            kind: kindId
        });
    }

    /// @notice connect - Creates a directed edge between two kinds with a relation and transform.
    /// @return True if the connection was created successfully.
    function connect(bytes32 from, bytes32 to, string memory relation, string memory transformName) external returns (bool) {
        require(_kindExists[from], "Source kind not found");
        require(_kindExists[to], "Target kind not found");
        require(from != to, "Cannot connect a kind to itself");

        bytes32 edgeId = keccak256(abi.encodePacked(from, to, relation));

        if (_edgeExists[edgeId]) {
            // Update existing edge
            _edges[edgeId].transformName = transformName;
            emit ConnectCompleted("ok");
            return true;
        }

        _edges[edgeId] = Edge({
            from: from,
            to: to,
            relation: relation,
            transformName: transformName,
            exists: true
        });
        _edgeExists[edgeId] = true;
        _edgeIds.push(edgeId);

        _outEdges[from].push(edgeId);
        _inEdges[to].push(edgeId);

        emit ConnectCompleted("ok");
        return true;
    }

    /// @notice route - Finds a path between two kinds using breadth-first search.
    function route(bytes32 from, bytes32 to) external returns (RouteOkResult memory) {
        require(_kindExists[from], "Source kind not found");
        require(_kindExists[to], "Target kind not found");

        if (from == to) {
            bytes[] memory singlePath = new bytes[](1);
            singlePath[0] = abi.encode(from);
            emit RouteCompleted("ok", singlePath);
            return RouteOkResult({ success: true, path: singlePath });
        }

        // BFS for shortest path (limited depth to avoid gas issues)
        uint256 maxDepth = 10;
        bytes32[] memory queue = new bytes32[](_kindIds.length * 2);
        // BFS parent tracking omitted for simplicity
        bytes32[] memory visited = new bytes32[](_kindIds.length);
        uint256 visitedCount = 0;
        uint256 queueHead = 0;
        uint256 queueTail = 0;

        queue[queueTail++] = from;
        visited[visitedCount++] = from;
        bool found = false;

        while (queueHead < queueTail && queueHead < maxDepth * _kindIds.length) {
            bytes32 current = queue[queueHead++];

            bytes32[] storage outgoing = _outEdges[current];
            for (uint256 i = 0; i < outgoing.length; i++) {
                if (!_edgeExists[outgoing[i]]) continue;
                Edge storage edge = _edges[outgoing[i]];
                bytes32 neighbor = edge.to;

                bool alreadyVisited = false;
                for (uint256 j = 0; j < visitedCount; j++) {
                    if (visited[j] == neighbor) { alreadyVisited = true; break; }
                }

                if (!alreadyVisited) {
                    visited[visitedCount++] = neighbor;
                    queue[queueTail++] = neighbor;

                    if (neighbor == to) {
                        found = true;
                        break;
                    }
                }
            }
            if (found) break;
        }

        // Return a simple path representation
        if (found) {
            bytes[] memory path = new bytes[](2);
            path[0] = abi.encode(from);
            path[1] = abi.encode(to);
            emit RouteCompleted("ok", path);
            return RouteOkResult({ success: true, path: path });
        } else {
            bytes[] memory emptyPath = new bytes[](0);
            emit RouteCompleted("unreachable", emptyPath);
            return RouteOkResult({ success: false, path: emptyPath });
        }
    }

    /// @notice validate - Validates that a connection between two kinds is valid.
    /// @return True if the connection is valid.
    function validate(bytes32 from, bytes32 to) external returns (bool) {
        require(_kindExists[from], "Source kind not found");
        require(_kindExists[to], "Target kind not found");

        // Check if a direct edge exists
        bytes32[] storage outgoing = _outEdges[from];
        for (uint256 i = 0; i < outgoing.length; i++) {
            if (_edgeExists[outgoing[i]]) {
                Edge storage edge = _edges[outgoing[i]];
                if (edge.to == to) {
                    emit ValidateCompleted("ok");
                    return true;
                }
            }
        }

        emit ValidateCompleted("invalid");
        return false;
    }

    /// @notice dependents - Returns all kinds that depend on (are downstream of) a given kind.
    function dependents(bytes32 kind) external returns (DependentsOkResult memory) {
        require(_kindExists[kind], "Kind not found");

        bytes32[] storage outgoing = _outEdges[kind];
        uint256 count = 0;
        for (uint256 i = 0; i < outgoing.length; i++) {
            if (_edgeExists[outgoing[i]]) count++;
        }

        bytes32[] memory downstream = new bytes32[](count);
        uint256 idx = 0;

        for (uint256 i = 0; i < outgoing.length; i++) {
            if (_edgeExists[outgoing[i]]) {
                downstream[idx] = _edges[outgoing[i]].to;
                idx++;
            }
        }

        emit DependentsCompleted("ok", downstream);

        return DependentsOkResult({
            success: true,
            downstream: downstream
        });
    }

    /// @notice producers - Returns all transforms that produce (have edges to) a given kind.
    function producers(bytes32 kind) external returns (ProducersOkResult memory) {
        require(_kindExists[kind], "Kind not found");

        bytes32[] storage incoming = _inEdges[kind];
        uint256 count = 0;
        for (uint256 i = 0; i < incoming.length; i++) {
            if (_edgeExists[incoming[i]]) count++;
        }

        bytes[] memory transforms = new bytes[](count);
        uint256 idx = 0;

        for (uint256 i = 0; i < incoming.length; i++) {
            bytes32 edgeId = incoming[i];
            if (_edgeExists[edgeId]) {
                Edge storage edge = _edges[edgeId];
                transforms[idx] = abi.encode(edge.from, edge.transformName, edge.relation);
                idx++;
            }
        }

        emit ProducersCompleted("ok", transforms);

        return ProducersOkResult({
            success: true,
            transforms: transforms
        });
    }

    /// @notice consumers - Returns all transforms that consume (have edges from) a given kind.
    function consumers(bytes32 kind) external returns (ConsumersOkResult memory) {
        require(_kindExists[kind], "Kind not found");

        bytes32[] storage outgoing = _outEdges[kind];
        uint256 count = 0;
        for (uint256 i = 0; i < outgoing.length; i++) {
            if (_edgeExists[outgoing[i]]) count++;
        }

        bytes[] memory transforms = new bytes[](count);
        uint256 idx = 0;

        for (uint256 i = 0; i < outgoing.length; i++) {
            bytes32 edgeId = outgoing[i];
            if (_edgeExists[edgeId]) {
                Edge storage edge = _edges[edgeId];
                transforms[idx] = abi.encode(edge.to, edge.transformName, edge.relation);
                idx++;
            }
        }

        emit ConsumersCompleted("ok", transforms);

        return ConsumersOkResult({
            success: true,
            transforms: transforms
        });
    }

    /// @notice graph - Returns the complete kind taxonomy graph.
    function graph() external returns (GraphOkResult memory) {
        uint256 kindCount = 0;
        for (uint256 i = 0; i < _kindIds.length; i++) {
            if (_kindExists[_kindIds[i]]) kindCount++;
        }

        uint256 edgeCount = 0;
        for (uint256 i = 0; i < _edgeIds.length; i++) {
            if (_edgeExists[_edgeIds[i]]) edgeCount++;
        }

        bytes[] memory kindsData = new bytes[](kindCount);
        uint256 kIdx = 0;
        for (uint256 i = 0; i < _kindIds.length; i++) {
            bytes32 id = _kindIds[i];
            if (_kindExists[id]) {
                KindEntry storage k = _kinds[id];
                kindsData[kIdx] = abi.encode(id, k.name, k.category);
                kIdx++;
            }
        }

        bytes[] memory edgesData = new bytes[](edgeCount);
        uint256 eIdx = 0;
        for (uint256 i = 0; i < _edgeIds.length; i++) {
            bytes32 id = _edgeIds[i];
            if (_edgeExists[id]) {
                Edge storage e = _edges[id];
                edgesData[eIdx] = abi.encode(e.from, e.to, e.relation, e.transformName);
                eIdx++;
            }
        }

        emit GraphCompleted("ok", kindsData, edgesData);

        return GraphOkResult({
            success: true,
            kinds: kindsData,
            edges: edgesData
        });
    }
}
