// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GovernanceDecision
/// @notice Proposal lifecycle, vote collection, quorum checks, and advanced decision mechanisms
/// @dev Implements the Proposal, Vote, Quorum, Conviction, PredictionMarket, and OptimisticApproval
///      concepts from Clef specification.
///      Core proposal/vote/quorum logic is fully stubbed with parameter validation.
///      Complex mechanisms (Conviction, PredictionMarket, OptimisticApproval) include struct
///      definitions and event signatures with stubbed function bodies.

contract GovernanceDecision {
    // --- Types ---

    enum ProposalStatus { Draft, Active, Passed, Rejected, Executed, Cancelled }

    struct Proposal {
        bytes32 proposer;
        string title;
        string description;
        ProposalStatus status;
        uint256 createdAt;
        uint256 activatedAt;
        uint256 closedAt;
        bytes32 quorumRuleId;
        bool exists;
    }

    enum BallotChoice { Abstain, For, Against }

    struct Ballot {
        bytes32 voterId;
        BallotChoice choice;
        uint256 weight;
        uint256 castAt;
        bool exists;
    }

    struct QuorumRule {
        uint256 minParticipation;    // basis points (e.g., 5000 = 50%)
        uint256 passThreshold;       // basis points for passing (e.g., 5001 = 50.01%)
        bool exists;
    }

    struct VoteSession {
        bytes32 proposalId;
        uint256 totalFor;
        uint256 totalAgainst;
        uint256 totalAbstain;
        uint256 ballotCount;
        bool finalized;
        bool exists;
    }

    // --- Complex Decision Types (struct definitions + event stubs) ---

    struct ConvictionState {
        bytes32 proposalId;
        bytes32 stakerId;
        uint256 stakedAmount;
        uint256 convictionScore;     // accumulated conviction over time
        uint256 lastUpdatedBlock;
    }

    struct PredictionMarketState {
        bytes32 proposalId;
        uint256 yesShares;
        uint256 noShares;
        uint256 totalLiquidity;
        bool resolved;
        bool outcome;
    }

    struct OptimisticApprovalState {
        bytes32 proposalId;
        uint256 submittedAt;
        uint256 challengePeriodEnd;
        bool challenged;
        bool executed;
    }

    // --- Storage ---

    /// @dev Maps proposal ID -> Proposal
    mapping(bytes32 => Proposal) private _proposals;

    /// @dev Maps proposal ID -> VoteSession
    mapping(bytes32 => VoteSession) private _voteSessions;

    /// @dev Maps proposal ID -> voter ID -> Ballot
    mapping(bytes32 => mapping(bytes32 => Ballot)) private _ballots;

    /// @dev Maps quorum rule ID -> QuorumRule
    mapping(bytes32 => QuorumRule) private _quorumRules;

    /// @dev Maps proposal ID -> ConvictionState[] for conviction voting
    mapping(bytes32 => ConvictionState[]) private _convictionStakes;

    /// @dev Maps proposal ID -> PredictionMarketState
    mapping(bytes32 => PredictionMarketState) private _predictionMarkets;

    /// @dev Maps proposal ID -> OptimisticApprovalState
    mapping(bytes32 => OptimisticApprovalState) private _optimisticApprovals;

    // --- Events ---

    event ProposalCreated(bytes32 indexed proposalId, bytes32 indexed proposer, string title);
    event ProposalActivated(bytes32 indexed proposalId);
    event ProposalCancelled(bytes32 indexed proposalId);
    event ProposalPassed(bytes32 indexed proposalId);
    event ProposalRejected(bytes32 indexed proposalId);
    event ProposalExecuted(bytes32 indexed proposalId);

    event BallotCast(bytes32 indexed proposalId, bytes32 indexed voterId, BallotChoice choice, uint256 weight);
    event VoteSessionFinalized(bytes32 indexed proposalId, bool passed);

    event QuorumRuleCreated(bytes32 indexed ruleId, uint256 minParticipation, uint256 passThreshold);

    event ConvictionStaked(bytes32 indexed proposalId, bytes32 indexed stakerId, uint256 amount);
    event ConvictionWithdrawn(bytes32 indexed proposalId, bytes32 indexed stakerId, uint256 amount);
    event ConvictionThresholdReached(bytes32 indexed proposalId, uint256 convictionScore);

    event PredictionMarketCreated(bytes32 indexed proposalId, uint256 initialLiquidity);
    event PredictionSharesBought(bytes32 indexed proposalId, bool isYes, uint256 shares);
    event PredictionMarketResolved(bytes32 indexed proposalId, bool outcome);

    event OptimisticSubmitted(bytes32 indexed proposalId, uint256 challengePeriodEnd);
    event OptimisticChallenged(bytes32 indexed proposalId, bytes32 indexed challengerId);
    event OptimisticExecuted(bytes32 indexed proposalId);

    // --- Quorum Rule Actions ---

    /// @notice Create a quorum rule for proposals
    /// @param ruleId Unique identifier for the rule
    /// @param minParticipation Minimum participation in basis points (0-10000)
    /// @param passThreshold Pass threshold in basis points (0-10000)
    function createQuorumRule(bytes32 ruleId, uint256 minParticipation, uint256 passThreshold) external {
        require(ruleId != bytes32(0), "Rule ID cannot be zero");
        require(!_quorumRules[ruleId].exists, "Rule already exists");
        require(minParticipation <= 10000, "Participation exceeds 100%");
        require(passThreshold <= 10000, "Threshold exceeds 100%");

        _quorumRules[ruleId] = QuorumRule({
            minParticipation: minParticipation,
            passThreshold: passThreshold,
            exists: true
        });

        emit QuorumRuleCreated(ruleId, minParticipation, passThreshold);
    }

    // --- Proposal Lifecycle ---

    /// @notice Create a proposal in Draft status
    /// @param proposalId Unique identifier
    /// @param proposer The proposer's member ID
    /// @param title Proposal title
    /// @param description Proposal description
    /// @param quorumRuleId The quorum rule to apply
    function createProposal(
        bytes32 proposalId,
        bytes32 proposer,
        string calldata title,
        string calldata description,
        bytes32 quorumRuleId
    ) external {
        require(proposalId != bytes32(0), "Proposal ID cannot be zero");
        require(proposer != bytes32(0), "Proposer cannot be zero");
        require(!_proposals[proposalId].exists, "Proposal already exists");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(_quorumRules[quorumRuleId].exists, "Quorum rule not found");

        _proposals[proposalId] = Proposal({
            proposer: proposer,
            title: title,
            description: description,
            status: ProposalStatus.Draft,
            createdAt: block.timestamp,
            activatedAt: 0,
            closedAt: 0,
            quorumRuleId: quorumRuleId,
            exists: true
        });

        _voteSessions[proposalId] = VoteSession({
            proposalId: proposalId,
            totalFor: 0,
            totalAgainst: 0,
            totalAbstain: 0,
            ballotCount: 0,
            finalized: false,
            exists: true
        });

        emit ProposalCreated(proposalId, proposer, title);
    }

    /// @notice Activate a draft proposal to begin voting
    /// @param proposalId The proposal to activate
    function activateProposal(bytes32 proposalId) external {
        require(_proposals[proposalId].exists, "Proposal not found");
        require(_proposals[proposalId].status == ProposalStatus.Draft, "Proposal not in Draft");

        _proposals[proposalId].status = ProposalStatus.Active;
        _proposals[proposalId].activatedAt = block.timestamp;

        emit ProposalActivated(proposalId);
    }

    /// @notice Cancel a proposal (only from Draft or Active)
    /// @param proposalId The proposal to cancel
    function cancelProposal(bytes32 proposalId) external {
        require(_proposals[proposalId].exists, "Proposal not found");
        ProposalStatus s = _proposals[proposalId].status;
        require(s == ProposalStatus.Draft || s == ProposalStatus.Active, "Cannot cancel in current state");

        _proposals[proposalId].status = ProposalStatus.Cancelled;
        _proposals[proposalId].closedAt = block.timestamp;

        emit ProposalCancelled(proposalId);
    }

    /// @notice Mark a passed proposal as executed
    /// @param proposalId The proposal to mark executed
    function executeProposal(bytes32 proposalId) external {
        require(_proposals[proposalId].exists, "Proposal not found");
        require(_proposals[proposalId].status == ProposalStatus.Passed, "Proposal not passed");

        _proposals[proposalId].status = ProposalStatus.Executed;

        emit ProposalExecuted(proposalId);
    }

    // --- Voting Actions ---

    /// @notice Cast a ballot on an active proposal
    /// @param proposalId The proposal to vote on
    /// @param voterId The voter's member ID
    /// @param choice The vote choice
    /// @param weight The voter's weight for this ballot
    function castBallot(
        bytes32 proposalId,
        bytes32 voterId,
        BallotChoice choice,
        uint256 weight
    ) external {
        require(_proposals[proposalId].exists, "Proposal not found");
        require(_proposals[proposalId].status == ProposalStatus.Active, "Proposal not active");
        require(voterId != bytes32(0), "Voter ID cannot be zero");
        require(!_ballots[proposalId][voterId].exists, "Already voted");
        require(weight > 0, "Weight must be positive");

        _ballots[proposalId][voterId] = Ballot({
            voterId: voterId,
            choice: choice,
            weight: weight,
            castAt: block.timestamp,
            exists: true
        });

        VoteSession storage session = _voteSessions[proposalId];
        if (choice == BallotChoice.For) {
            session.totalFor += weight;
        } else if (choice == BallotChoice.Against) {
            session.totalAgainst += weight;
        } else {
            session.totalAbstain += weight;
        }
        session.ballotCount++;

        emit BallotCast(proposalId, voterId, choice, weight);
    }

    /// @notice Finalize a vote session and determine proposal outcome
    /// @param proposalId The proposal to finalize
    /// @param totalEligibleWeight The total weight of all eligible voters (for quorum calculation)
    function finalizeVote(bytes32 proposalId, uint256 totalEligibleWeight) external {
        require(_proposals[proposalId].exists, "Proposal not found");
        require(_proposals[proposalId].status == ProposalStatus.Active, "Proposal not active");

        VoteSession storage session = _voteSessions[proposalId];
        require(!session.finalized, "Already finalized");
        require(totalEligibleWeight > 0, "Eligible weight must be positive");

        session.finalized = true;

        QuorumRule storage rule = _quorumRules[_proposals[proposalId].quorumRuleId];

        uint256 totalVoted = session.totalFor + session.totalAgainst + session.totalAbstain;
        uint256 participationBps = (totalVoted * 10000) / totalEligibleWeight;

        bool quorumMet = participationBps >= rule.minParticipation;

        uint256 forBps = 0;
        if (session.totalFor + session.totalAgainst > 0) {
            forBps = (session.totalFor * 10000) / (session.totalFor + session.totalAgainst);
        }

        bool passed = quorumMet && forBps >= rule.passThreshold;

        if (passed) {
            _proposals[proposalId].status = ProposalStatus.Passed;
            emit ProposalPassed(proposalId);
        } else {
            _proposals[proposalId].status = ProposalStatus.Rejected;
            emit ProposalRejected(proposalId);
        }

        _proposals[proposalId].closedAt = block.timestamp;

        emit VoteSessionFinalized(proposalId, passed);
    }

    // --- Conviction Voting Stubs ---

    /// @notice Stake tokens toward conviction for a proposal
    /// @param proposalId The proposal to stake on
    /// @param stakerId The staker's member ID
    /// @param amount Amount to stake
    function stakeConviction(bytes32 proposalId, bytes32 stakerId, uint256 amount) external {
        require(_proposals[proposalId].exists, "Proposal not found");
        require(stakerId != bytes32(0), "Staker ID cannot be zero");
        require(amount > 0, "Amount must be positive");

        _convictionStakes[proposalId].push(ConvictionState({
            proposalId: proposalId,
            stakerId: stakerId,
            stakedAmount: amount,
            convictionScore: 0,
            lastUpdatedBlock: block.number
        }));

        // TODO: implement conviction accumulation curve (exponential decay formula)

        emit ConvictionStaked(proposalId, stakerId, amount);
    }

    /// @notice Withdraw conviction stake
    /// @param proposalId The proposal
    /// @param stakerId The staker's member ID
    /// @param amount Amount to withdraw
    function withdrawConviction(bytes32 proposalId, bytes32 stakerId, uint256 amount) external {
        require(_proposals[proposalId].exists, "Proposal not found");
        require(stakerId != bytes32(0), "Staker ID cannot be zero");
        require(amount > 0, "Amount must be positive");

        // TODO: implement stake lookup and partial withdrawal logic

        emit ConvictionWithdrawn(proposalId, stakerId, amount);
    }

    // --- Prediction Market Stubs ---

    /// @notice Create a prediction market for a proposal
    /// @param proposalId The proposal to create a market for
    /// @param initialLiquidity Initial liquidity to seed the market
    function createPredictionMarket(bytes32 proposalId, uint256 initialLiquidity) external {
        require(_proposals[proposalId].exists, "Proposal not found");
        require(initialLiquidity > 0, "Liquidity must be positive");

        _predictionMarkets[proposalId] = PredictionMarketState({
            proposalId: proposalId,
            yesShares: 0,
            noShares: 0,
            totalLiquidity: initialLiquidity,
            resolved: false,
            outcome: false
        });

        // TODO: implement automated market maker curve (LMSR or constant product)

        emit PredictionMarketCreated(proposalId, initialLiquidity);
    }

    /// @notice Buy shares in a prediction market
    /// @param proposalId The proposal market
    /// @param isYes Whether to buy Yes or No shares
    /// @param amount Amount of liquidity to spend
    function buyPredictionShares(bytes32 proposalId, bool isYes, uint256 amount) external {
        require(_predictionMarkets[proposalId].totalLiquidity > 0, "Market not found");
        require(!_predictionMarkets[proposalId].resolved, "Market already resolved");
        require(amount > 0, "Amount must be positive");

        // TODO: implement AMM share calculation and price impact

        emit PredictionSharesBought(proposalId, isYes, amount);
    }

    /// @notice Resolve a prediction market
    /// @param proposalId The proposal market to resolve
    /// @param outcome The true outcome
    function resolvePredictionMarket(bytes32 proposalId, bool outcome) external {
        require(_predictionMarkets[proposalId].totalLiquidity > 0, "Market not found");
        require(!_predictionMarkets[proposalId].resolved, "Already resolved");

        _predictionMarkets[proposalId].resolved = true;
        _predictionMarkets[proposalId].outcome = outcome;

        // TODO: implement payout distribution

        emit PredictionMarketResolved(proposalId, outcome);
    }

    // --- Optimistic Approval Stubs ---

    /// @notice Submit a proposal for optimistic approval (passes unless challenged)
    /// @param proposalId The proposal
    /// @param challengePeriodSeconds Duration of the challenge window in seconds
    function submitOptimistic(bytes32 proposalId, uint256 challengePeriodSeconds) external {
        require(_proposals[proposalId].exists, "Proposal not found");
        require(challengePeriodSeconds > 0, "Challenge period must be positive");

        _optimisticApprovals[proposalId] = OptimisticApprovalState({
            proposalId: proposalId,
            submittedAt: block.timestamp,
            challengePeriodEnd: block.timestamp + challengePeriodSeconds,
            challenged: false,
            executed: false
        });

        emit OptimisticSubmitted(proposalId, block.timestamp + challengePeriodSeconds);
    }

    /// @notice Challenge an optimistic proposal during the challenge window
    /// @param proposalId The proposal to challenge
    /// @param challengerId The challenger's member ID
    function challengeOptimistic(bytes32 proposalId, bytes32 challengerId) external {
        OptimisticApprovalState storage state = _optimisticApprovals[proposalId];
        require(state.submittedAt > 0, "Optimistic not found");
        require(!state.challenged, "Already challenged");
        require(block.timestamp <= state.challengePeriodEnd, "Challenge period ended");
        require(challengerId != bytes32(0), "Challenger ID cannot be zero");

        state.challenged = true;

        // TODO: implement challenge resolution (e.g., fall back to full vote)

        emit OptimisticChallenged(proposalId, challengerId);
    }

    /// @notice Execute an unchallenged optimistic proposal after the challenge period
    /// @param proposalId The proposal to execute
    function executeOptimistic(bytes32 proposalId) external {
        OptimisticApprovalState storage state = _optimisticApprovals[proposalId];
        require(state.submittedAt > 0, "Optimistic not found");
        require(!state.challenged, "Proposal was challenged");
        require(!state.executed, "Already executed");
        require(block.timestamp > state.challengePeriodEnd, "Challenge period not ended");

        state.executed = true;

        // TODO: implement execution of the proposal's action payload

        emit OptimisticExecuted(proposalId);
    }

    // --- Views ---

    /// @notice Get a proposal
    /// @param proposalId The proposal ID
    /// @return The Proposal struct
    function getProposal(bytes32 proposalId) external view returns (Proposal memory) {
        require(_proposals[proposalId].exists, "Proposal not found");
        return _proposals[proposalId];
    }

    /// @notice Get a vote session for a proposal
    /// @param proposalId The proposal ID
    /// @return The VoteSession struct
    function getVoteSession(bytes32 proposalId) external view returns (VoteSession memory) {
        require(_voteSessions[proposalId].exists, "Session not found");
        return _voteSessions[proposalId];
    }

    /// @notice Get a voter's ballot on a proposal
    /// @param proposalId The proposal ID
    /// @param voterId The voter ID
    /// @return The Ballot struct
    function getBallot(bytes32 proposalId, bytes32 voterId) external view returns (Ballot memory) {
        require(_ballots[proposalId][voterId].exists, "Ballot not found");
        return _ballots[proposalId][voterId];
    }

    /// @notice Get a quorum rule
    /// @param ruleId The rule ID
    /// @return The QuorumRule struct
    function getQuorumRule(bytes32 ruleId) external view returns (QuorumRule memory) {
        require(_quorumRules[ruleId].exists, "Rule not found");
        return _quorumRules[ruleId];
    }
}
