// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CountingMethodProviders
/// @notice Counting method provider contracts for governance vote tallying
/// @dev Implements Majority, Supermajority, Approval, ScoreVoting, BordaCount,
///      RankedChoice (IRV), QuadraticVoting, CondorcetSchulze, and ConsentProcess
///      counting method concepts from the Clef specification.
///      Uses basis points (10000 = 100%) for thresholds and fixed-point math where needed.

contract MajorityCounting {
    // --- Types ---

    struct Config {
        uint256 threshold;  // basis points required to pass (e.g., 5001 = 50.01%)
        bool exists;
    }

    struct Tally {
        uint256 totalFor;
        uint256 totalAgainst;
        uint256 totalAbstain;
        bool counted;
        bool passed;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;
    mapping(bytes32 => mapping(bytes32 => Tally)) private _tallies;

    // --- Events ---

    event MajorityConfigured(bytes32 indexed configId, uint256 threshold);
    event MajorityCounted(bytes32 indexed configId, bytes32 indexed proposalId, bool passed, uint256 forBps);

    // --- Functions ---

    /// @notice Configure a majority counting method
    /// @param configId Unique configuration identifier
    /// @param threshold Pass threshold in basis points (e.g., 5001 = simple majority)
    function configure(bytes32 configId, uint256 threshold) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(threshold > 0 && threshold <= 10000, "Threshold must be 1-10000 bps");

        _configs[configId] = Config({ threshold: threshold, exists: true });

        emit MajorityConfigured(configId, threshold);
    }

    /// @notice Count weighted votes and determine outcome
    /// @param configId The counting configuration
    /// @param proposalId The proposal being counted
    /// @param weightedFor Total weighted votes in favor
    /// @param weightedAgainst Total weighted votes against
    /// @param weightedAbstain Total weighted abstentions
    /// @return passed Whether the proposal passed the threshold
    function count(
        bytes32 configId,
        bytes32 proposalId,
        uint256 weightedFor,
        uint256 weightedAgainst,
        uint256 weightedAbstain
    ) external returns (bool passed) {
        require(_configs[configId].exists, "Config not found");
        require(proposalId != bytes32(0), "Proposal ID cannot be zero");

        uint256 decisive = weightedFor + weightedAgainst;
        uint256 forBps = 0;
        if (decisive > 0) {
            forBps = (weightedFor * 10000) / decisive;
        }

        passed = forBps >= _configs[configId].threshold;

        _tallies[configId][proposalId] = Tally({
            totalFor: weightedFor,
            totalAgainst: weightedAgainst,
            totalAbstain: weightedAbstain,
            counted: true,
            passed: passed,
            exists: true
        });

        emit MajorityCounted(configId, proposalId, passed, forBps);
        return passed;
    }
}

contract SupermajorityCounting {
    // --- Types ---

    enum AbstentionMode { Exclude, CountAsAgainst, CountAsSeparate }

    struct Config {
        uint256 threshold;          // basis points required (e.g., 6667 = 2/3)
        AbstentionMode abstentionMode;
        bool exists;
    }

    struct Tally {
        uint256 totalFor;
        uint256 totalAgainst;
        uint256 totalAbstain;
        bool counted;
        bool passed;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;
    mapping(bytes32 => mapping(bytes32 => Tally)) private _tallies;

    // --- Events ---

    event SupermajorityConfigured(bytes32 indexed configId, uint256 threshold, uint8 abstentionMode);
    event SupermajorityCounted(bytes32 indexed configId, bytes32 indexed proposalId, bool passed, uint256 forBps);

    // --- Functions ---

    /// @notice Configure a supermajority counting method
    /// @param configId Unique configuration identifier
    /// @param threshold Pass threshold in basis points (e.g., 6667 for 2/3 supermajority)
    /// @param abstentionMode How to handle abstentions: 0=Exclude, 1=CountAsAgainst, 2=CountAsSeparate
    function configure(bytes32 configId, uint256 threshold, AbstentionMode abstentionMode) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(threshold > 5000 && threshold <= 10000, "Threshold must be 5001-10000 bps");

        _configs[configId] = Config({
            threshold: threshold,
            abstentionMode: abstentionMode,
            exists: true
        });

        emit SupermajorityConfigured(configId, threshold, uint8(abstentionMode));
    }

    /// @notice Count votes with supermajority threshold and abstention handling
    /// @param configId The counting configuration
    /// @param proposalId The proposal being counted
    /// @param weightedFor Total weighted votes in favor
    /// @param weightedAgainst Total weighted votes against
    /// @param weightedAbstain Total weighted abstentions
    /// @return passed Whether the proposal met the supermajority threshold
    function count(
        bytes32 configId,
        bytes32 proposalId,
        uint256 weightedFor,
        uint256 weightedAgainst,
        uint256 weightedAbstain
    ) external returns (bool passed) {
        require(_configs[configId].exists, "Config not found");
        require(proposalId != bytes32(0), "Proposal ID cannot be zero");

        Config storage cfg = _configs[configId];
        uint256 denominator;

        if (cfg.abstentionMode == AbstentionMode.Exclude) {
            denominator = weightedFor + weightedAgainst;
        } else if (cfg.abstentionMode == AbstentionMode.CountAsAgainst) {
            denominator = weightedFor + weightedAgainst + weightedAbstain;
        } else {
            // CountAsSeparate: abstentions are recorded but not counted in the ratio
            denominator = weightedFor + weightedAgainst;
        }

        uint256 forBps = 0;
        if (denominator > 0) {
            forBps = (weightedFor * 10000) / denominator;
        }

        passed = forBps >= cfg.threshold;

        _tallies[configId][proposalId] = Tally({
            totalFor: weightedFor,
            totalAgainst: weightedAgainst,
            totalAbstain: weightedAbstain,
            counted: true,
            passed: passed,
            exists: true
        });

        emit SupermajorityCounted(configId, proposalId, passed, forBps);
        return passed;
    }
}

contract ApprovalCounting {
    // --- Types ---

    struct Config {
        uint256 approvalThreshold;  // minimum approvals required to pass
        bool exists;
    }

    struct Tally {
        uint256 approvalCount;
        uint256 totalVoters;
        bool counted;
        bool passed;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;
    mapping(bytes32 => mapping(bytes32 => Tally)) private _tallies;

    // --- Events ---

    event ApprovalConfigured(bytes32 indexed configId, uint256 approvalThreshold);
    event ApprovalCounted(bytes32 indexed configId, bytes32 indexed proposalId, bool passed, uint256 approvals);

    // --- Functions ---

    /// @notice Configure an approval counting method
    /// @param configId Unique configuration identifier
    /// @param approvalThreshold Minimum number of approvals to pass
    function configure(bytes32 configId, uint256 approvalThreshold) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(approvalThreshold > 0, "Threshold must be positive");

        _configs[configId] = Config({ approvalThreshold: approvalThreshold, exists: true });

        emit ApprovalConfigured(configId, approvalThreshold);
    }

    /// @notice Count approval votes
    /// @param configId The counting configuration
    /// @param proposalId The proposal being counted
    /// @param approvalCount Number of approvals received
    /// @param totalVoters Total number of voters who participated
    /// @return passed Whether the proposal received enough approvals
    function count(
        bytes32 configId,
        bytes32 proposalId,
        uint256 approvalCount,
        uint256 totalVoters
    ) external returns (bool passed) {
        require(_configs[configId].exists, "Config not found");
        require(proposalId != bytes32(0), "Proposal ID cannot be zero");
        require(approvalCount <= totalVoters, "Approvals exceed voter count");

        passed = approvalCount >= _configs[configId].approvalThreshold;

        _tallies[configId][proposalId] = Tally({
            approvalCount: approvalCount,
            totalVoters: totalVoters,
            counted: true,
            passed: passed,
            exists: true
        });

        emit ApprovalCounted(configId, proposalId, passed, approvalCount);
        return passed;
    }
}

contract ScoreVotingCounting {
    // --- Types ---

    struct Config {
        uint256 maxScore;       // maximum score per option per voter
        uint256 optionCount;    // number of options
        bool exists;
    }

    struct ScoreTally {
        uint256 optionCount;
        bool counted;
        bytes32 winner;     // option with highest aggregate score
        uint256 winnerScore;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> proposalId -> optionIndex -> aggregated score
    mapping(bytes32 => mapping(bytes32 => mapping(uint256 => uint256))) private _optionScores;

    mapping(bytes32 => mapping(bytes32 => ScoreTally)) private _tallies;

    // --- Events ---

    event ScoreVotingConfigured(bytes32 indexed configId, uint256 maxScore, uint256 optionCount);
    event ScoreVotingCounted(bytes32 indexed configId, bytes32 indexed proposalId, uint256 winnerIndex, uint256 winnerScore);

    // --- Functions ---

    /// @notice Configure a score voting counting method
    /// @param configId Unique configuration identifier
    /// @param maxScore Maximum score a voter can assign per option
    /// @param optionCount Number of options to score
    function configure(bytes32 configId, uint256 maxScore, uint256 optionCount) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(maxScore > 0, "Max score must be positive");
        require(optionCount >= 2, "Need at least 2 options");

        _configs[configId] = Config({
            maxScore: maxScore,
            optionCount: optionCount,
            exists: true
        });

        emit ScoreVotingConfigured(configId, maxScore, optionCount);
    }

    /// @notice Count aggregated scores and determine the winner
    /// @param configId The counting configuration
    /// @param proposalId The proposal being counted
    /// @param scores Array of aggregated scores, one per option (length must match optionCount)
    /// @return winnerIndex Index of the winning option
    function count(
        bytes32 configId,
        bytes32 proposalId,
        uint256[] calldata scores
    ) external returns (uint256 winnerIndex) {
        require(_configs[configId].exists, "Config not found");
        require(proposalId != bytes32(0), "Proposal ID cannot be zero");
        require(scores.length == _configs[configId].optionCount, "Score count mismatch");

        uint256 bestScore = 0;
        winnerIndex = 0;

        for (uint256 i = 0; i < scores.length; i++) {
            _optionScores[configId][proposalId][i] = scores[i];
            if (scores[i] > bestScore) {
                bestScore = scores[i];
                winnerIndex = i;
            }
        }

        _tallies[configId][proposalId] = ScoreTally({
            optionCount: scores.length,
            counted: true,
            winner: bytes32(winnerIndex),
            winnerScore: bestScore,
            exists: true
        });

        emit ScoreVotingCounted(configId, proposalId, winnerIndex, bestScore);
        return winnerIndex;
    }
}

contract BordaCountCounting {
    // --- Types ---

    struct Config {
        uint256 optionCount;    // number of options
        bool exists;
    }

    struct BordaTally {
        uint256 optionCount;
        bool counted;
        uint256 winnerIndex;
        uint256 winnerPoints;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> proposalId -> optionIndex -> aggregated Borda points
    mapping(bytes32 => mapping(bytes32 => mapping(uint256 => uint256))) private _bordaPoints;

    mapping(bytes32 => mapping(bytes32 => BordaTally)) private _tallies;

    // --- Events ---

    event BordaConfigured(bytes32 indexed configId, uint256 optionCount);
    event BordaCounted(bytes32 indexed configId, bytes32 indexed proposalId, uint256 winnerIndex, uint256 winnerPoints);

    // --- Functions ---

    /// @notice Configure a Borda count counting method
    /// @param configId Unique configuration identifier
    /// @param optionCount Number of options (points = optionCount - rank)
    function configure(bytes32 configId, uint256 optionCount) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(optionCount >= 2, "Need at least 2 options");

        _configs[configId] = Config({ optionCount: optionCount, exists: true });

        emit BordaConfigured(configId, optionCount);
    }

    /// @notice Count aggregated Borda points and determine winner
    /// @param configId The counting configuration
    /// @param proposalId The proposal being counted
    /// @param points Array of aggregated Borda points per option
    /// @return winnerIndex Index of the winning option
    function count(
        bytes32 configId,
        bytes32 proposalId,
        uint256[] calldata points
    ) external returns (uint256 winnerIndex) {
        require(_configs[configId].exists, "Config not found");
        require(proposalId != bytes32(0), "Proposal ID cannot be zero");
        require(points.length == _configs[configId].optionCount, "Points count mismatch");

        uint256 bestPoints = 0;
        winnerIndex = 0;

        for (uint256 i = 0; i < points.length; i++) {
            _bordaPoints[configId][proposalId][i] = points[i];
            if (points[i] > bestPoints) {
                bestPoints = points[i];
                winnerIndex = i;
            }
        }

        _tallies[configId][proposalId] = BordaTally({
            optionCount: points.length,
            counted: true,
            winnerIndex: winnerIndex,
            winnerPoints: bestPoints,
            exists: true
        });

        emit BordaCounted(configId, proposalId, winnerIndex, bestPoints);
        return winnerIndex;
    }
}

contract RankedChoiceCounting {
    // --- Types ---

    struct Config {
        uint256 optionCount;
        bool exists;
    }

    enum RoundOutcome { Eliminated, Winner, Continuing }

    struct IRVTally {
        uint256 optionCount;
        uint256 roundsRun;
        uint256 winnerIndex;
        bool counted;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;
    mapping(bytes32 => mapping(bytes32 => IRVTally)) private _tallies;

    /// @dev Maps configId -> proposalId -> round -> optionIndex -> vote count
    mapping(bytes32 => mapping(bytes32 => mapping(uint256 => mapping(uint256 => uint256)))) private _roundVotes;

    // --- Events ---

    event RankedChoiceConfigured(bytes32 indexed configId, uint256 optionCount);
    event IRVRoundCompleted(bytes32 indexed configId, bytes32 indexed proposalId, uint256 round, uint256 eliminatedOption);
    event IRVWinner(bytes32 indexed configId, bytes32 indexed proposalId, uint256 winnerIndex, uint256 rounds);

    // --- Functions ---

    /// @notice Configure a ranked choice (IRV) counting method
    /// @param configId Unique configuration identifier
    /// @param optionCount Number of options
    function configure(bytes32 configId, uint256 optionCount) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(optionCount >= 2, "Need at least 2 options");

        _configs[configId] = Config({ optionCount: optionCount, exists: true });

        emit RankedChoiceConfigured(configId, optionCount);
    }

    /// @notice Run IRV rounds to determine a winner
    /// @dev Accepts pre-aggregated first-preference counts per round. Each call provides
    ///      one round's vote distribution. The caller is responsible for redistributing
    ///      eliminated candidates' votes off-chain and submitting the next round.
    /// @param configId The counting configuration
    /// @param proposalId The proposal being counted
    /// @param roundVotes Array of first-preference counts per option for this round
    /// @param eliminatedOption Index of the option eliminated this round (type(uint256).max if none)
    /// @param totalBallots Total number of ballots in the election
    /// @return outcome 0 = eliminated, 1 = winner found, 2 = continuing
    /// @return winnerOrEliminated Index of the winner or eliminated candidate
    function count(
        bytes32 configId,
        bytes32 proposalId,
        uint256[] calldata roundVotes,
        uint256 eliminatedOption,
        uint256 totalBallots
    ) external returns (RoundOutcome outcome, uint256 winnerOrEliminated) {
        require(_configs[configId].exists, "Config not found");
        require(proposalId != bytes32(0), "Proposal ID cannot be zero");
        require(roundVotes.length == _configs[configId].optionCount, "Vote count mismatch");
        require(totalBallots > 0, "Total ballots must be positive");

        IRVTally storage tally = _tallies[configId][proposalId];
        if (!tally.exists) {
            _tallies[configId][proposalId] = IRVTally({
                optionCount: roundVotes.length,
                roundsRun: 0,
                winnerIndex: 0,
                counted: false,
                exists: true
            });
            tally = _tallies[configId][proposalId];
        }

        uint256 round = tally.roundsRun;
        uint256 majority = (totalBallots / 2) + 1;

        // Store round votes and check for majority winner
        for (uint256 i = 0; i < roundVotes.length; i++) {
            _roundVotes[configId][proposalId][round][i] = roundVotes[i];
            if (roundVotes[i] >= majority) {
                tally.winnerIndex = i;
                tally.counted = true;
                tally.roundsRun = round + 1;
                emit IRVWinner(configId, proposalId, i, round + 1);
                return (RoundOutcome.Winner, i);
            }
        }

        tally.roundsRun = round + 1;

        if (eliminatedOption < roundVotes.length) {
            emit IRVRoundCompleted(configId, proposalId, round, eliminatedOption);
            return (RoundOutcome.Eliminated, eliminatedOption);
        }

        return (RoundOutcome.Continuing, 0);
    }
}

contract QuadraticVotingCounting {
    // --- Types ---

    struct Session {
        bytes32 proposalId;
        uint256 optionCount;
        uint256 creditBudget;   // voice credits per voter
        bool open;
        bool tallied;
        bool exists;
    }

    struct VoterRecord {
        uint256 creditsSpent;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps sessionId -> Session
    mapping(bytes32 => Session) private _sessions;

    /// @dev Maps sessionId -> optionIndex -> aggregate effective votes
    mapping(bytes32 => mapping(uint256 => int256)) private _optionVotes;

    /// @dev Maps sessionId -> voterId -> VoterRecord
    mapping(bytes32 => mapping(bytes32 => VoterRecord)) private _voterRecords;

    // --- Events ---

    event QVSessionOpened(bytes32 indexed sessionId, bytes32 indexed proposalId, uint256 optionCount, uint256 creditBudget);
    event QVVotesCast(bytes32 indexed sessionId, bytes32 indexed voterId, uint256 creditsUsed);
    event QVTallied(bytes32 indexed sessionId, uint256 winnerIndex, int256 winnerVotes);

    // --- Functions ---

    /// @notice Open a quadratic voting session
    /// @param sessionId Unique session identifier
    /// @param proposalId The proposal being voted on
    /// @param optionCount Number of options
    /// @param creditBudget Voice credits each voter receives
    function openSession(
        bytes32 sessionId,
        bytes32 proposalId,
        uint256 optionCount,
        uint256 creditBudget
    ) external {
        require(sessionId != bytes32(0), "Session ID cannot be zero");
        require(!_sessions[sessionId].exists, "Session already exists");
        require(optionCount >= 1, "Need at least 1 option");
        require(creditBudget > 0, "Budget must be positive");

        _sessions[sessionId] = Session({
            proposalId: proposalId,
            optionCount: optionCount,
            creditBudget: creditBudget,
            open: true,
            tallied: false,
            exists: true
        });

        emit QVSessionOpened(sessionId, proposalId, optionCount, creditBudget);
    }

    /// @notice Cast quadratic votes (cost = votes^2 credits per option)
    /// @param sessionId The voting session
    /// @param voterId The voter identifier
    /// @param votes Signed vote counts per option (positive = for, negative = against)
    ///        Credits consumed = sum of votes[i]^2 across all options
    function castVotes(
        bytes32 sessionId,
        bytes32 voterId,
        int256[] calldata votes
    ) external {
        Session storage session = _sessions[sessionId];
        require(session.exists, "Session not found");
        require(session.open, "Session not open");
        require(voterId != bytes32(0), "Voter ID cannot be zero");
        require(votes.length == session.optionCount, "Vote count mismatch");
        require(!_voterRecords[sessionId][voterId].exists, "Already voted");

        // Calculate total credits spent: sum of |votes[i]|^2
        uint256 totalCredits = 0;
        for (uint256 i = 0; i < votes.length; i++) {
            int256 v = votes[i];
            uint256 absV = v >= 0 ? uint256(v) : uint256(-v);
            totalCredits += absV * absV;
        }

        require(totalCredits <= session.creditBudget, "Exceeds credit budget");

        // Apply votes to option tallies
        for (uint256 i = 0; i < votes.length; i++) {
            _optionVotes[sessionId][i] += votes[i];
        }

        _voterRecords[sessionId][voterId] = VoterRecord({
            creditsSpent: totalCredits,
            exists: true
        });

        emit QVVotesCast(sessionId, voterId, totalCredits);
    }

    /// @notice Tally the quadratic voting session and determine winner
    /// @param sessionId The voting session to tally
    /// @return winnerIndex Index of the option with the highest effective votes
    function tally(bytes32 sessionId) external returns (uint256 winnerIndex) {
        Session storage session = _sessions[sessionId];
        require(session.exists, "Session not found");
        require(session.open, "Session not open");
        require(!session.tallied, "Already tallied");

        session.open = false;
        session.tallied = true;

        int256 bestVotes = type(int256).min;
        winnerIndex = 0;

        for (uint256 i = 0; i < session.optionCount; i++) {
            if (_optionVotes[sessionId][i] > bestVotes) {
                bestVotes = _optionVotes[sessionId][i];
                winnerIndex = i;
            }
        }

        emit QVTallied(sessionId, winnerIndex, bestVotes);
        return winnerIndex;
    }
}

contract CondorcetSchulzeCounting {
    // --- Types ---

    struct Config {
        uint256 optionCount;
        bool exists;
    }

    struct SchulzeTally {
        uint256 optionCount;
        uint256 winnerIndex;
        bool counted;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;
    mapping(bytes32 => mapping(bytes32 => SchulzeTally)) private _tallies;

    /// @dev Maps configId -> proposalId -> i -> j -> pairwise preference count (i preferred over j)
    mapping(bytes32 => mapping(bytes32 => mapping(uint256 => mapping(uint256 => uint256)))) private _pairwise;

    // --- Events ---

    event CondorcetConfigured(bytes32 indexed configId, uint256 optionCount);
    event SchulzeWinner(bytes32 indexed configId, bytes32 indexed proposalId, uint256 winnerIndex);

    // --- Functions ---

    /// @notice Configure a Condorcet-Schulze counting method
    /// @param configId Unique configuration identifier
    /// @param optionCount Number of options (candidates)
    function configure(bytes32 configId, uint256 optionCount) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(optionCount >= 2 && optionCount <= 32, "Option count must be 2-32");

        _configs[configId] = Config({ optionCount: optionCount, exists: true });

        emit CondorcetConfigured(configId, optionCount);
    }

    /// @notice Count using Schulze method: build pairwise matrix, then compute widest paths
    /// @param configId The counting configuration
    /// @param proposalId The proposal being counted
    /// @param pairwiseMatrix Flattened n*n pairwise preference matrix (row-major).
    ///        pairwiseMatrix[i*n + j] = number of voters preferring option i over option j
    /// @return winnerIndex The Schulze winner
    function count(
        bytes32 configId,
        bytes32 proposalId,
        uint256[] calldata pairwiseMatrix
    ) external returns (uint256 winnerIndex) {
        Config storage cfg = _configs[configId];
        require(cfg.exists, "Config not found");
        require(proposalId != bytes32(0), "Proposal ID cannot be zero");
        uint256 n = cfg.optionCount;
        require(pairwiseMatrix.length == n * n, "Matrix size mismatch");

        // Store pairwise preferences
        for (uint256 i = 0; i < n; i++) {
            for (uint256 j = 0; j < n; j++) {
                _pairwise[configId][proposalId][i][j] = pairwiseMatrix[i * n + j];
            }
        }

        // Build strength-of-strongest-path matrix using Floyd-Warshall (Schulze algorithm)
        // Initialize: strength[i][j] = d[i][j] if d[i][j] > d[j][i], else 0
        uint256[] memory strength = new uint256[](n * n);
        for (uint256 i = 0; i < n; i++) {
            for (uint256 j = 0; j < n; j++) {
                if (i != j) {
                    uint256 dij = pairwiseMatrix[i * n + j];
                    uint256 dji = pairwiseMatrix[j * n + i];
                    if (dij > dji) {
                        strength[i * n + j] = dij;
                    }
                }
            }
        }

        // Floyd-Warshall widest path
        for (uint256 k = 0; k < n; k++) {
            for (uint256 i = 0; i < n; i++) {
                if (i == k) continue;
                for (uint256 j = 0; j < n; j++) {
                    if (j == i || j == k) continue;
                    uint256 indirect = strength[i * n + k] < strength[k * n + j]
                        ? strength[i * n + k]
                        : strength[k * n + j];
                    if (indirect > strength[i * n + j]) {
                        strength[i * n + j] = indirect;
                    }
                }
            }
        }

        // Find the winner: option i wins if for all j != i, strength[i][j] >= strength[j][i]
        winnerIndex = 0;
        uint256 bestWins = 0;
        for (uint256 i = 0; i < n; i++) {
            uint256 wins = 0;
            for (uint256 j = 0; j < n; j++) {
                if (i != j && strength[i * n + j] >= strength[j * n + i]) {
                    wins++;
                }
            }
            if (wins > bestWins) {
                bestWins = wins;
                winnerIndex = i;
            }
        }

        _tallies[configId][proposalId] = SchulzeTally({
            optionCount: n,
            winnerIndex: winnerIndex,
            counted: true,
            exists: true
        });

        emit SchulzeWinner(configId, proposalId, winnerIndex);
        return winnerIndex;
    }
}

contract ConsentProcessCounting {
    // --- Types ---

    enum Phase { Proposal, Clarification, QuickReaction, Objection, Integration, Decision }

    struct Round {
        bytes32 proposalId;
        Phase currentPhase;
        uint256 participantCount;
        uint256 objectionCount;
        uint256 resolvedObjections;
        bool finalized;
        bool passed;
        bool exists;
    }

    struct Objection {
        bytes32 raisedBy;
        string reason;
        bool resolved;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps roundId -> Round
    mapping(bytes32 => Round) private _rounds;

    /// @dev Maps roundId -> objectionIndex -> Objection
    mapping(bytes32 => mapping(uint256 => Objection)) private _objections;

    // --- Events ---

    event ConsentRoundOpened(bytes32 indexed roundId, bytes32 indexed proposalId, uint256 participantCount);
    event PhaseAdvanced(bytes32 indexed roundId, uint8 newPhase);
    event ObjectionRaised(bytes32 indexed roundId, uint256 indexed objectionIndex, bytes32 indexed raisedBy, string reason);
    event ObjectionResolved(bytes32 indexed roundId, uint256 indexed objectionIndex);
    event ConsentFinalized(bytes32 indexed roundId, bool passed);

    // --- Functions ---

    /// @notice Open a consent-based decision round
    /// @param roundId Unique round identifier
    /// @param proposalId The proposal being considered
    /// @param participantCount Number of participants in the consent round
    function openRound(bytes32 roundId, bytes32 proposalId, uint256 participantCount) external {
        require(roundId != bytes32(0), "Round ID cannot be zero");
        require(!_rounds[roundId].exists, "Round already exists");
        require(participantCount > 0, "Need at least 1 participant");

        _rounds[roundId] = Round({
            proposalId: proposalId,
            currentPhase: Phase.Proposal,
            participantCount: participantCount,
            objectionCount: 0,
            resolvedObjections: 0,
            finalized: false,
            passed: false,
            exists: true
        });

        emit ConsentRoundOpened(roundId, proposalId, participantCount);
    }

    /// @notice Advance to the next phase of the consent process
    /// @param roundId The round to advance
    function advancePhase(bytes32 roundId) external {
        Round storage round = _rounds[roundId];
        require(round.exists, "Round not found");
        require(!round.finalized, "Round already finalized");
        require(uint8(round.currentPhase) < uint8(Phase.Decision), "Already at final phase");

        // Cannot leave Objection phase while unresolved objections remain
        if (round.currentPhase == Phase.Objection) {
            require(
                round.resolvedObjections == round.objectionCount,
                "Unresolved objections remain"
            );
        }

        round.currentPhase = Phase(uint8(round.currentPhase) + 1);

        emit PhaseAdvanced(roundId, uint8(round.currentPhase));
    }

    /// @notice Raise an objection during the Objection phase
    /// @param roundId The round
    /// @param raisedBy The objector's identifier
    /// @param reason The reason for objection
    function raiseObjection(bytes32 roundId, bytes32 raisedBy, string calldata reason) external {
        Round storage round = _rounds[roundId];
        require(round.exists, "Round not found");
        require(!round.finalized, "Round already finalized");
        require(round.currentPhase == Phase.Objection, "Not in Objection phase");
        require(raisedBy != bytes32(0), "Objector cannot be zero");
        require(bytes(reason).length > 0, "Reason cannot be empty");

        uint256 idx = round.objectionCount;
        _objections[roundId][idx] = Objection({
            raisedBy: raisedBy,
            reason: reason,
            resolved: false,
            exists: true
        });
        round.objectionCount++;

        emit ObjectionRaised(roundId, idx, raisedBy, reason);
    }

    /// @notice Resolve an objection (through integration or amendment)
    /// @param roundId The round
    /// @param objectionIndex The index of the objection to resolve
    function resolveObjection(bytes32 roundId, uint256 objectionIndex) external {
        Round storage round = _rounds[roundId];
        require(round.exists, "Round not found");
        require(!round.finalized, "Round already finalized");
        require(
            round.currentPhase == Phase.Objection || round.currentPhase == Phase.Integration,
            "Not in Objection or Integration phase"
        );

        Objection storage obj = _objections[roundId][objectionIndex];
        require(obj.exists, "Objection not found");
        require(!obj.resolved, "Objection already resolved");

        obj.resolved = true;
        round.resolvedObjections++;

        emit ObjectionResolved(roundId, objectionIndex);
    }

    /// @notice Finalize the consent round
    /// @param roundId The round to finalize
    /// @return passed True if consent was achieved (no unresolved objections at Decision phase)
    function finalize(bytes32 roundId) external returns (bool passed) {
        Round storage round = _rounds[roundId];
        require(round.exists, "Round not found");
        require(!round.finalized, "Round already finalized");
        require(round.currentPhase == Phase.Decision, "Not in Decision phase");

        round.finalized = true;
        passed = round.resolvedObjections == round.objectionCount;
        round.passed = passed;

        emit ConsentFinalized(roundId, passed);
        return passed;
    }
}
