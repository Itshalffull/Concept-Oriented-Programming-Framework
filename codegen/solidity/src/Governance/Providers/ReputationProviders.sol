// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ReputationProviders
/// @notice Reputation algorithm contracts for governance scoring and ranking
/// @dev Implements SimpleAccumulator, EloRating, PeerAllocation, PageRankReputation,
///      and GlickoRating provider concepts from the Clef specification.
///      Uses fixed-point WAD arithmetic (1e18 = 1.0) for fractional calculations.
///      Complex algorithms (PageRank, Glicko-2) use simplified on-chain approximations
///      to keep gas costs manageable.

contract SimpleAccumulator {
    // --- Types ---

    struct Config {
        uint256 decayRateBps;   // decay rate per period in basis points (e.g., 500 = 5%)
        uint256 decayPeriod;    // seconds between decay applications
        uint256 maxScore;       // maximum score (0 = unlimited)
        bool exists;
    }

    struct ScoreRecord {
        uint256 score;
        uint256 lastDecayAt;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> account -> ScoreRecord
    mapping(bytes32 => mapping(bytes32 => ScoreRecord)) private _scores;

    // --- Events ---

    event AccumulatorConfigured(bytes32 indexed configId, uint256 decayRateBps, uint256 decayPeriod, uint256 maxScore);
    event ScoreAdded(bytes32 indexed configId, bytes32 indexed account, uint256 amount, uint256 newScore);
    event DecayApplied(bytes32 indexed configId, bytes32 indexed account, uint256 decayAmount, uint256 newScore, uint256 periodsDecayed);

    // --- Functions ---

    /// @notice Configure a simple accumulator reputation provider
    /// @param configId Unique configuration identifier
    /// @param decayRateBps Decay rate per period in basis points (e.g., 500 = 5%)
    /// @param decayPeriod Seconds between decay applications
    /// @param maxScore Maximum score cap (0 for unlimited)
    function configure(bytes32 configId, uint256 decayRateBps, uint256 decayPeriod, uint256 maxScore) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(decayRateBps <= 10000, "Decay rate cannot exceed 100%");
        require(decayPeriod > 0, "Decay period must be positive");

        _configs[configId] = Config({
            decayRateBps: decayRateBps,
            decayPeriod: decayPeriod,
            maxScore: maxScore,
            exists: true
        });

        emit AccumulatorConfigured(configId, decayRateBps, decayPeriod, maxScore);
    }

    /// @notice Add reputation score to an account
    /// @param configId The reputation configuration
    /// @param account The account to credit
    /// @param amount Amount of reputation to add
    function add(bytes32 configId, bytes32 account, uint256 amount) external {
        require(_configs[configId].exists, "Config not found");
        require(account != bytes32(0), "Account cannot be zero");
        require(amount > 0, "Amount must be positive");

        ScoreRecord storage rec = _scores[configId][account];
        if (!rec.exists) {
            _scores[configId][account] = ScoreRecord({
                score: amount,
                lastDecayAt: block.timestamp,
                exists: true
            });
        } else {
            rec.score += amount;
        }

        Config storage cfg = _configs[configId];
        if (cfg.maxScore > 0 && _scores[configId][account].score > cfg.maxScore) {
            _scores[configId][account].score = cfg.maxScore;
        }

        emit ScoreAdded(configId, account, amount, _scores[configId][account].score);
    }

    /// @notice Apply time-based decay to an account's score
    /// @param configId The reputation configuration
    /// @param account The account to decay
    function applyDecay(bytes32 configId, bytes32 account) external {
        require(_configs[configId].exists, "Config not found");
        ScoreRecord storage rec = _scores[configId][account];
        require(rec.exists, "Score not found");

        Config storage cfg = _configs[configId];
        uint256 elapsed = block.timestamp - rec.lastDecayAt;
        uint256 periods = elapsed / cfg.decayPeriod;

        if (periods == 0) return;

        // Apply multiplicative decay: score = score * ((10000 - decayRate) / 10000) ^ periods
        uint256 retainBps = 10000 - cfg.decayRateBps;
        uint256 scoreBefore = rec.score;

        for (uint256 i = 0; i < periods; i++) {
            rec.score = (rec.score * retainBps) / 10000;
            if (rec.score == 0) break;
        }

        rec.lastDecayAt += periods * cfg.decayPeriod;

        emit DecayApplied(configId, account, scoreBefore - rec.score, rec.score, periods);
    }

    /// @notice Get an account's current reputation score
    /// @param configId The reputation configuration
    /// @param account The account to query
    /// @return score The current score
    function getScore(bytes32 configId, bytes32 account) external view returns (uint256 score) {
        require(_configs[configId].exists, "Config not found");
        if (!_scores[configId][account].exists) return 0;
        return _scores[configId][account].score;
    }
}

contract EloRating {
    // --- Types ---

    struct Config {
        uint256 kFactor;        // K-factor (WAD-scaled, e.g., 32e18 = K=32)
        uint256 initialRating;  // starting rating (WAD-scaled, e.g., 1500e18)
        bool exists;
    }

    struct RatingRecord {
        uint256 rating;     // WAD-scaled
        uint256 matchCount;
        bool exists;
    }

    // --- Constants ---

    uint256 private constant WAD = 1e18;

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> playerId -> RatingRecord
    mapping(bytes32 => mapping(bytes32 => RatingRecord)) private _ratings;

    // --- Events ---

    event EloConfigured(bytes32 indexed configId, uint256 kFactor, uint256 initialRating);
    event OutcomeRecorded(
        bytes32 indexed configId,
        bytes32 indexed winnerId,
        bytes32 indexed loserId,
        uint256 winnerNewRating,
        uint256 loserNewRating
    );
    event DrawRecorded(
        bytes32 indexed configId,
        bytes32 indexed playerA,
        bytes32 indexed playerB,
        uint256 playerANewRating,
        uint256 playerBNewRating
    );

    // --- Functions ---

    /// @notice Configure an Elo rating provider
    /// @param configId Unique configuration identifier
    /// @param kFactor K-factor (WAD-scaled)
    /// @param initialRating Starting rating for new players (WAD-scaled)
    function configure(bytes32 configId, uint256 kFactor, uint256 initialRating) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(kFactor > 0, "K-factor must be positive");
        require(initialRating > 0, "Initial rating must be positive");

        _configs[configId] = Config({
            kFactor: kFactor,
            initialRating: initialRating,
            exists: true
        });

        emit EloConfigured(configId, kFactor, initialRating);
    }

    /// @notice Record a match outcome (winner/loser)
    /// @param configId The rating configuration
    /// @param winnerId The winner's identifier
    /// @param loserId The loser's identifier
    function recordOutcome(bytes32 configId, bytes32 winnerId, bytes32 loserId) external {
        require(_configs[configId].exists, "Config not found");
        require(winnerId != bytes32(0) && loserId != bytes32(0), "IDs cannot be zero");
        require(winnerId != loserId, "Cannot play against self");

        _ensurePlayer(configId, winnerId);
        _ensurePlayer(configId, loserId);

        RatingRecord storage winner = _ratings[configId][winnerId];
        RatingRecord storage loser = _ratings[configId][loserId];

        // Expected score: E = 1 / (1 + 10^((opponent - self) / 400))
        // Simplified: use linear approximation for on-chain efficiency
        // E_winner = 0.5 + (winner.rating - loser.rating) / (800 * WAD) clamped to [0.05, 0.95]
        int256 diff = int256(winner.rating) - int256(loser.rating);
        uint256 expectedWinner = _expectedScore(diff);
        uint256 expectedLoser = WAD - expectedWinner;

        // New rating = old + K * (actual - expected)
        // Winner actual = 1.0 (WAD), Loser actual = 0
        uint256 K = _configs[configId].kFactor;

        // Winner gains: K * (WAD - expectedWinner) / WAD
        uint256 winnerDelta = (K * (WAD - expectedWinner)) / WAD;
        winner.rating += winnerDelta;
        winner.matchCount++;

        // Loser loses: K * expectedLoser / WAD
        uint256 loserDelta = (K * expectedLoser) / WAD;
        if (loser.rating > loserDelta) {
            loser.rating -= loserDelta;
        } else {
            loser.rating = 1; // minimum rating
        }
        loser.matchCount++;

        emit OutcomeRecorded(configId, winnerId, loserId, winner.rating, loser.rating);
    }

    /// @notice Record a draw between two players
    /// @param configId The rating configuration
    /// @param playerA First player
    /// @param playerB Second player
    function recordDraw(bytes32 configId, bytes32 playerA, bytes32 playerB) external {
        require(_configs[configId].exists, "Config not found");
        require(playerA != bytes32(0) && playerB != bytes32(0), "IDs cannot be zero");
        require(playerA != playerB, "Cannot draw against self");

        _ensurePlayer(configId, playerA);
        _ensurePlayer(configId, playerB);

        RatingRecord storage recA = _ratings[configId][playerA];
        RatingRecord storage recB = _ratings[configId][playerB];

        int256 diff = int256(recA.rating) - int256(recB.rating);
        uint256 expectedA = _expectedScore(diff);

        uint256 K = _configs[configId].kFactor;
        // Draw actual = 0.5 (WAD/2)
        uint256 half = WAD / 2;

        if (expectedA > half) {
            // Player A expected to win -> loses rating
            uint256 deltaA = (K * (expectedA - half)) / WAD;
            if (recA.rating > deltaA) {
                recA.rating -= deltaA;
            }
            recB.rating += (K * (half - (WAD - expectedA))) / WAD;
        } else {
            // Player B expected to win -> loses rating
            uint256 deltaA = (K * (half - expectedA)) / WAD;
            recA.rating += deltaA;
            uint256 expectedB = WAD - expectedA;
            uint256 deltaB = (K * (expectedB - half)) / WAD;
            if (recB.rating > deltaB) {
                recB.rating -= deltaB;
            }
        }

        recA.matchCount++;
        recB.matchCount++;

        emit DrawRecorded(configId, playerA, playerB, recA.rating, recB.rating);
    }

    /// @notice Get a player's current Elo rating
    /// @param configId The rating configuration
    /// @param playerId The player's identifier
    /// @return rating The current rating (WAD-scaled)
    function getRating(bytes32 configId, bytes32 playerId) external view returns (uint256 rating) {
        require(_configs[configId].exists, "Config not found");
        if (!_ratings[configId][playerId].exists) return _configs[configId].initialRating;
        return _ratings[configId][playerId].rating;
    }

    /// @dev Initialize a player's rating if needed
    function _ensurePlayer(bytes32 configId, bytes32 playerId) internal {
        if (!_ratings[configId][playerId].exists) {
            _ratings[configId][playerId] = RatingRecord({
                rating: _configs[configId].initialRating,
                matchCount: 0,
                exists: true
            });
        }
    }

    /// @dev Linear approximation of expected score, clamped to [0.05, 0.95] in WAD
    /// @param ratingDiff (self - opponent) in WAD
    /// @return expected Expected score in WAD
    function _expectedScore(int256 ratingDiff) internal pure returns (uint256 expected) {
        // E ~= 0.5 + diff / (800 * WAD)
        // Working in WAD: 0.5 WAD + diff / 800
        int256 half = int256(WAD / 2);
        int256 result = half + (ratingDiff / 800);

        // Clamp to [0.05 WAD, 0.95 WAD]
        uint256 minE = WAD / 20;        // 0.05
        uint256 maxE = (WAD * 19) / 20; // 0.95

        if (result < int256(minE)) return minE;
        if (result > int256(maxE)) return maxE;
        return uint256(result);
    }
}

contract PeerAllocation {
    // --- Types ---

    struct Round {
        bytes32 poolId;
        uint256 totalBudget;        // total reputation to distribute
        uint256 participantCount;
        uint256 allocationCount;
        bool finalized;
        bool exists;
    }

    struct Allocation {
        bytes32 fromPeer;
        bytes32 toPeer;
        uint256 amount;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps roundId -> Round
    mapping(bytes32 => Round) private _rounds;

    /// @dev Maps roundId -> allocationIndex -> Allocation
    mapping(bytes32 => mapping(uint256 => Allocation)) private _allocations;

    /// @dev Maps roundId -> peer -> received amount
    mapping(bytes32 => mapping(bytes32 => uint256)) private _received;

    /// @dev Maps roundId -> peer -> total allocated out
    mapping(bytes32 => mapping(bytes32 => uint256)) private _allocated;

    // --- Events ---

    event AllocationRoundOpened(bytes32 indexed roundId, bytes32 indexed poolId, uint256 totalBudget, uint256 participantCount);
    event PeerAllocated(bytes32 indexed roundId, bytes32 indexed fromPeer, bytes32 indexed toPeer, uint256 amount);
    event AllocationFinalized(bytes32 indexed roundId);

    // --- Functions ---

    /// @notice Open a peer allocation round
    /// @param roundId Unique round identifier
    /// @param poolId The reputation pool being allocated from
    /// @param totalBudget Total reputation budget to distribute
    /// @param participantCount Number of participants
    function openRound(bytes32 roundId, bytes32 poolId, uint256 totalBudget, uint256 participantCount) external {
        require(roundId != bytes32(0), "Round ID cannot be zero");
        require(!_rounds[roundId].exists, "Round already exists");
        require(totalBudget > 0, "Budget must be positive");
        require(participantCount >= 2, "Need at least 2 participants");

        _rounds[roundId] = Round({
            poolId: poolId,
            totalBudget: totalBudget,
            participantCount: participantCount,
            allocationCount: 0,
            finalized: false,
            exists: true
        });

        emit AllocationRoundOpened(roundId, poolId, totalBudget, participantCount);
    }

    /// @notice Allocate reputation from one peer to another
    /// @param roundId The allocation round
    /// @param fromPeer The peer allocating reputation
    /// @param toPeer The peer receiving reputation
    /// @param amount Amount of reputation to allocate
    function allocate(bytes32 roundId, bytes32 fromPeer, bytes32 toPeer, uint256 amount) external {
        Round storage round = _rounds[roundId];
        require(round.exists, "Round not found");
        require(!round.finalized, "Round already finalized");
        require(fromPeer != bytes32(0) && toPeer != bytes32(0), "Peers cannot be zero");
        require(fromPeer != toPeer, "Cannot allocate to self");
        require(amount > 0, "Amount must be positive");

        // Each participant gets an equal share of the budget
        uint256 perPeerBudget = round.totalBudget / round.participantCount;
        require(
            _allocated[roundId][fromPeer] + amount <= perPeerBudget,
            "Exceeds per-peer allocation budget"
        );

        uint256 idx = round.allocationCount;
        _allocations[roundId][idx] = Allocation({
            fromPeer: fromPeer,
            toPeer: toPeer,
            amount: amount,
            exists: true
        });

        _allocated[roundId][fromPeer] += amount;
        _received[roundId][toPeer] += amount;
        round.allocationCount++;

        emit PeerAllocated(roundId, fromPeer, toPeer, amount);
    }

    /// @notice Finalize the allocation round
    /// @param roundId The round to finalize
    function finalize(bytes32 roundId) external {
        Round storage round = _rounds[roundId];
        require(round.exists, "Round not found");
        require(!round.finalized, "Already finalized");

        round.finalized = true;

        emit AllocationFinalized(roundId);
    }

    /// @notice Get the total reputation received by a peer in a round
    /// @param roundId The allocation round
    /// @param peer The peer to query
    /// @return amount Total reputation received
    function getReceived(bytes32 roundId, bytes32 peer) external view returns (uint256 amount) {
        require(_rounds[roundId].exists, "Round not found");
        return _received[roundId][peer];
    }
}

contract PageRankReputation {
    // --- Types ---

    struct Config {
        uint256 dampingBps;     // damping factor in basis points (e.g., 8500 = 0.85)
        uint256 maxIterations;  // maximum iterations for convergence
        uint256 nodeCount;      // total nodes in the graph (fixed at config time for gas)
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> fromNode -> toNode -> contribution weight (WAD)
    mapping(bytes32 => mapping(bytes32 => mapping(bytes32 => uint256))) private _contributions;

    /// @dev Maps configId -> node -> outgoing link count
    mapping(bytes32 => mapping(bytes32 => uint256)) private _outDegree;

    /// @dev Maps configId -> node -> PageRank score (WAD-scaled)
    mapping(bytes32 => mapping(bytes32 => uint256)) private _scores;

    // --- Constants ---

    uint256 private constant WAD = 1e18;

    // --- Events ---

    event PageRankConfigured(bytes32 indexed configId, uint256 dampingBps, uint256 maxIterations, uint256 nodeCount);
    event ContributionAdded(bytes32 indexed configId, bytes32 indexed fromNode, bytes32 indexed toNode, uint256 weight);
    event PageRankComputed(bytes32 indexed configId, uint256 iterations);

    // --- Functions ---

    /// @notice Configure a PageRank reputation provider
    /// @dev On-chain PageRank is simplified: the actual power iteration must be performed
    ///      off-chain or via a bounded number of iterations. This contract stores the graph
    ///      and accepts computed scores.
    /// @param configId Unique configuration identifier
    /// @param dampingBps Damping factor in basis points (typical: 8500 = 0.85)
    /// @param maxIterations Maximum iterations (gas-bounded, typically 5-20)
    /// @param nodeCount Number of nodes in the reputation graph
    function configure(bytes32 configId, uint256 dampingBps, uint256 maxIterations, uint256 nodeCount) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(dampingBps > 0 && dampingBps < 10000, "Damping must be 1-9999 bps");
        require(maxIterations > 0, "Need at least 1 iteration");
        require(nodeCount > 0, "Need at least 1 node");

        _configs[configId] = Config({
            dampingBps: dampingBps,
            maxIterations: maxIterations,
            nodeCount: nodeCount,
            exists: true
        });

        emit PageRankConfigured(configId, dampingBps, maxIterations, nodeCount);
    }

    /// @notice Add a contribution link in the reputation graph
    /// @param configId The PageRank configuration
    /// @param fromNode The contributing node
    /// @param toNode The receiving node
    /// @param weight Contribution weight (WAD-scaled)
    function addContribution(bytes32 configId, bytes32 fromNode, bytes32 toNode, uint256 weight) external {
        require(_configs[configId].exists, "Config not found");
        require(fromNode != bytes32(0) && toNode != bytes32(0), "Nodes cannot be zero");
        require(fromNode != toNode, "Cannot contribute to self");
        require(weight > 0, "Weight must be positive");

        _contributions[configId][fromNode][toNode] = weight;
        _outDegree[configId][fromNode]++;

        emit ContributionAdded(configId, fromNode, toNode, weight);
    }

    /// @notice Accept pre-computed PageRank scores from an off-chain computation
    /// @dev Due to gas constraints, full PageRank iteration is performed off-chain.
    ///      This function stores the verified results on-chain.
    /// @param configId The PageRank configuration
    /// @param nodes Array of node identifiers
    /// @param scores Array of corresponding PageRank scores (WAD-scaled)
    /// @param iterations Number of iterations the off-chain computation ran
    function compute(bytes32 configId, bytes32[] calldata nodes, uint256[] calldata scores, uint256 iterations) external {
        require(_configs[configId].exists, "Config not found");
        require(nodes.length == scores.length, "Array length mismatch");
        require(iterations > 0, "Iterations must be positive");
        require(iterations <= _configs[configId].maxIterations, "Exceeds max iterations");

        for (uint256 i = 0; i < nodes.length; i++) {
            _scores[configId][nodes[i]] = scores[i];
        }

        emit PageRankComputed(configId, iterations);
    }

    /// @notice Get a node's PageRank score
    /// @param configId The PageRank configuration
    /// @param node The node to query
    /// @return score The PageRank score (WAD-scaled)
    function getScore(bytes32 configId, bytes32 node) external view returns (uint256 score) {
        require(_configs[configId].exists, "Config not found");
        return _scores[configId][node];
    }
}

contract GlickoRating {
    // --- Types ---

    struct Config {
        uint256 initialRating;      // WAD-scaled (e.g., 1500e18)
        uint256 initialDeviation;   // WAD-scaled (e.g., 350e18)
        uint256 inactivityPeriod;   // seconds before deviation increases
        uint256 maxDeviation;       // maximum rating deviation (WAD-scaled)
        bool exists;
    }

    struct GlickoRecord {
        uint256 rating;         // WAD-scaled
        uint256 deviation;      // WAD-scaled (rating uncertainty)
        uint256 volatility;     // WAD-scaled (rate of change, simplified)
        uint256 matchCount;
        uint256 lastActiveAt;
        bool exists;
    }

    // --- Constants ---

    uint256 private constant WAD = 1e18;

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> playerId -> GlickoRecord
    mapping(bytes32 => mapping(bytes32 => GlickoRecord)) private _ratings;

    // --- Events ---

    event GlickoConfigured(bytes32 indexed configId, uint256 initialRating, uint256 initialDeviation, uint256 inactivityPeriod);
    event GlickoOutcomeRecorded(
        bytes32 indexed configId,
        bytes32 indexed playerId,
        bytes32 indexed opponentId,
        uint256 newRating,
        uint256 newDeviation
    );
    event InactivityDecayApplied(bytes32 indexed configId, bytes32 indexed playerId, uint256 newDeviation);

    // --- Functions ---

    /// @notice Configure a Glicko rating provider
    /// @dev Simplified Glicko-2 approximation for on-chain use. Full Glicko-2 requires
    ///      floating-point math; this implementation uses WAD fixed-point with bounded updates.
    /// @param configId Unique configuration identifier
    /// @param initialRating Starting rating (WAD-scaled)
    /// @param initialDeviation Starting rating deviation (WAD-scaled)
    /// @param inactivityPeriod Seconds of inactivity before deviation increases
    /// @param maxDeviation Maximum rating deviation (WAD-scaled)
    function configure(
        bytes32 configId,
        uint256 initialRating,
        uint256 initialDeviation,
        uint256 inactivityPeriod,
        uint256 maxDeviation
    ) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(initialRating > 0, "Initial rating must be positive");
        require(initialDeviation > 0, "Initial deviation must be positive");
        require(inactivityPeriod > 0, "Inactivity period must be positive");
        require(maxDeviation >= initialDeviation, "Max deviation must be >= initial");

        _configs[configId] = Config({
            initialRating: initialRating,
            initialDeviation: initialDeviation,
            inactivityPeriod: inactivityPeriod,
            maxDeviation: maxDeviation,
            exists: true
        });

        emit GlickoConfigured(configId, initialRating, initialDeviation, inactivityPeriod);
    }

    /// @notice Record a match outcome and update ratings
    /// @dev Simplified Glicko update: rating moves toward expected outcome weighted by
    ///      opponent's deviation (more uncertain opponents cause smaller updates).
    /// @param configId The rating configuration
    /// @param playerId The player being updated
    /// @param opponentId The opponent
    /// @param playerWon True if the player won, false if lost
    function recordOutcome(
        bytes32 configId,
        bytes32 playerId,
        bytes32 opponentId,
        bool playerWon
    ) external {
        require(_configs[configId].exists, "Config not found");
        require(playerId != bytes32(0) && opponentId != bytes32(0), "IDs cannot be zero");
        require(playerId != opponentId, "Cannot play against self");

        _ensurePlayer(configId, playerId);
        _ensurePlayer(configId, opponentId);

        GlickoRecord storage player = _ratings[configId][playerId];
        GlickoRecord storage opponent = _ratings[configId][opponentId];

        // g(RD) = 1 / sqrt(1 + 3 * RD^2 / pi^2) -- simplified to: g ~= WAD - RD/4
        // (linear approximation for gas efficiency)
        uint256 gOpp = _gFunction(opponent.deviation);

        // Expected score: E = 1 / (1 + 10^(-g * (R - Ropp) / 400))
        // Linear approximation similar to Elo
        int256 diff = int256(player.rating) - int256(opponent.rating);
        int256 scaledDiff = (diff * int256(gOpp)) / int256(WAD);
        uint256 expected = _expectedScore(scaledDiff);

        // Actual score
        uint256 actual = playerWon ? WAD : 0;

        // d^2 denominator: proportional to g^2 * E * (1-E)
        uint256 eComplement = WAD - expected;
        uint256 gSquared = (gOpp * gOpp) / WAD;
        uint256 d2Denom = (gSquared * expected) / WAD;
        d2Denom = (d2Denom * eComplement) / WAD;

        if (d2Denom == 0) d2Denom = 1;

        // New deviation: 1 / sqrt(1/RD^2 + 1/d^2) -- simplified
        // RD_new = RD * 0.9 if playing regularly (bounded decrease)
        uint256 newDeviation = (player.deviation * 9) / 10;
        if (newDeviation < WAD / 10) newDeviation = WAD / 10; // minimum deviation

        // Rating update: R_new = R + g * (S - E) * K
        // where K is proportional to deviation squared
        uint256 K = (player.deviation * player.deviation) / WAD;
        K = K / 100; // scale down for reasonable updates

        if (actual > expected) {
            uint256 delta = (gOpp * (actual - expected)) / WAD;
            delta = (delta * K) / WAD;
            player.rating += delta;
        } else if (expected > actual) {
            uint256 delta = (gOpp * (expected - actual)) / WAD;
            delta = (delta * K) / WAD;
            if (player.rating > delta) {
                player.rating -= delta;
            } else {
                player.rating = 1;
            }
        }

        player.deviation = newDeviation;
        player.matchCount++;
        player.lastActiveAt = block.timestamp;

        emit GlickoOutcomeRecorded(configId, playerId, opponentId, player.rating, player.deviation);
    }

    /// @notice Apply inactivity decay: increase rating deviation for inactive players
    /// @param configId The rating configuration
    /// @param playerId The player to decay
    function applyInactivityDecay(bytes32 configId, bytes32 playerId) external {
        require(_configs[configId].exists, "Config not found");
        GlickoRecord storage player = _ratings[configId][playerId];
        require(player.exists, "Player not found");

        Config storage cfg = _configs[configId];
        uint256 elapsed = block.timestamp - player.lastActiveAt;
        uint256 periods = elapsed / cfg.inactivityPeriod;

        if (periods == 0) return;

        // Increase deviation by 5% per inactivity period, capped at maxDeviation
        for (uint256 i = 0; i < periods; i++) {
            player.deviation = (player.deviation * 105) / 100;
            if (player.deviation >= cfg.maxDeviation) {
                player.deviation = cfg.maxDeviation;
                break;
            }
        }

        player.lastActiveAt += periods * cfg.inactivityPeriod;

        emit InactivityDecayApplied(configId, playerId, player.deviation);
    }

    /// @notice Get the reliable weight: rating scaled inversely by deviation uncertainty
    /// @dev weight = rating * (1 - deviation/maxDeviation) -- higher certainty = more weight
    /// @param configId The rating configuration
    /// @param playerId The player to query
    /// @return weight The reliability-weighted rating
    function getReliableWeight(bytes32 configId, bytes32 playerId) external view returns (uint256 weight) {
        require(_configs[configId].exists, "Config not found");
        if (!_ratings[configId][playerId].exists) return 0;

        GlickoRecord storage player = _ratings[configId][playerId];
        Config storage cfg = _configs[configId];

        // reliability = 1 - (deviation / maxDeviation), in WAD
        uint256 reliabilityBps = 10000;
        if (cfg.maxDeviation > 0 && player.deviation < cfg.maxDeviation) {
            reliabilityBps = 10000 - ((player.deviation * 10000) / cfg.maxDeviation);
        } else if (player.deviation >= cfg.maxDeviation) {
            reliabilityBps = 0;
        }

        weight = (player.rating * reliabilityBps) / 10000;
        return weight;
    }

    /// @dev Initialize a player's Glicko record if needed
    function _ensurePlayer(bytes32 configId, bytes32 playerId) internal {
        if (!_ratings[configId][playerId].exists) {
            Config storage cfg = _configs[configId];
            _ratings[configId][playerId] = GlickoRecord({
                rating: cfg.initialRating,
                deviation: cfg.initialDeviation,
                volatility: WAD / 10, // default volatility 0.1
                matchCount: 0,
                lastActiveAt: block.timestamp,
                exists: true
            });
        }
    }

    /// @dev Simplified g function: g(RD) ~= WAD - RD/4 (linear approximation)
    function _gFunction(uint256 rd) internal pure returns (uint256) {
        uint256 reduction = rd / 4;
        if (reduction >= WAD) return WAD / 10; // floor
        return WAD - reduction;
    }

    /// @dev Linear approximation of expected score, clamped to [0.05, 0.95] in WAD
    function _expectedScore(int256 scaledDiff) internal pure returns (uint256) {
        int256 half = int256(WAD / 2);
        int256 result = half + (scaledDiff / 800);

        uint256 minE = WAD / 20;
        uint256 maxE = (WAD * 19) / 20;

        if (result < int256(minE)) return minE;
        if (result > int256(maxE)) return maxE;
        return uint256(result);
    }
}
