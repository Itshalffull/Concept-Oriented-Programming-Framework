// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FinalityProviders
/// @notice Finality provider contracts for governance decision confirmation
/// @dev Implements ImmediateFinality, ChainFinality, BftFinality, and OptimisticOracleFinality
///      provider concepts from the Clef specification.

contract ImmediateFinality {
    // --- Types ---

    struct FinalityRecord {
        bytes32 proposalId;
        bytes32 confirmedBy;
        uint256 confirmedAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps proposalId -> FinalityRecord
    mapping(bytes32 => FinalityRecord) private _records;

    // --- Events ---

    event ImmediatelyConfirmed(bytes32 indexed proposalId, bytes32 indexed confirmedBy, uint256 confirmedAt);

    // --- Functions ---

    /// @notice Confirm a decision with immediate finality (no delay, no challenge)
    /// @param proposalId The proposal/decision to confirm
    /// @param confirmedBy The entity confirming finality
    function confirm(bytes32 proposalId, bytes32 confirmedBy) external {
        require(proposalId != bytes32(0), "Proposal ID cannot be zero");
        require(confirmedBy != bytes32(0), "Confirmer cannot be zero");
        require(!_records[proposalId].exists, "Already confirmed (duplicate)");

        _records[proposalId] = FinalityRecord({
            proposalId: proposalId,
            confirmedBy: confirmedBy,
            confirmedAt: block.timestamp,
            exists: true
        });

        emit ImmediatelyConfirmed(proposalId, confirmedBy, block.timestamp);
    }

    /// @notice Check if a decision has been confirmed
    /// @param proposalId The proposal to check
    /// @return confirmed Whether the decision is final
    /// @return confirmedAt When it was confirmed (0 if not confirmed)
    function isConfirmed(bytes32 proposalId) external view returns (bool confirmed, uint256 confirmedAt) {
        if (_records[proposalId].exists) {
            return (true, _records[proposalId].confirmedAt);
        }
        return (false, 0);
    }
}

contract ChainFinality {
    // --- Types ---

    struct Config {
        uint256 requiredConfirmations;  // blocks/confirmations needed for finality
        bool exists;
    }

    struct TrackingRecord {
        bytes32 proposalId;
        bytes32 txHash;             // transaction/block hash being tracked
        uint256 submittedBlock;     // block number when submitted
        uint256 targetBlock;        // block number at which finality is achieved
        bool finalized;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> proposalId -> TrackingRecord
    mapping(bytes32 => mapping(bytes32 => TrackingRecord)) private _tracking;

    // --- Events ---

    event ChainFinalityConfigured(bytes32 indexed configId, uint256 requiredConfirmations);
    event FinalityTracked(bytes32 indexed configId, bytes32 indexed proposalId, bytes32 txHash, uint256 submittedBlock, uint256 targetBlock);
    event ChainFinalityAchieved(bytes32 indexed configId, bytes32 indexed proposalId, uint256 blockNumber);

    // --- Functions ---

    /// @notice Configure a chain finality provider
    /// @param configId Unique configuration identifier
    /// @param requiredConfirmations Number of block confirmations for finality
    function configure(bytes32 configId, uint256 requiredConfirmations) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(requiredConfirmations > 0, "Confirmations must be positive");

        _configs[configId] = Config({
            requiredConfirmations: requiredConfirmations,
            exists: true
        });

        emit ChainFinalityConfigured(configId, requiredConfirmations);
    }

    /// @notice Track a decision for chain-based finality
    /// @param configId The finality configuration
    /// @param proposalId The proposal being tracked
    /// @param txHash The transaction hash to track
    function track(bytes32 configId, bytes32 proposalId, bytes32 txHash) external {
        require(_configs[configId].exists, "Config not found");
        require(proposalId != bytes32(0), "Proposal ID cannot be zero");
        require(!_tracking[configId][proposalId].exists, "Already tracking");

        uint256 targetBlock = block.number + _configs[configId].requiredConfirmations;

        _tracking[configId][proposalId] = TrackingRecord({
            proposalId: proposalId,
            txHash: txHash,
            submittedBlock: block.number,
            targetBlock: targetBlock,
            finalized: false,
            exists: true
        });

        emit FinalityTracked(configId, proposalId, txHash, block.number, targetBlock);
    }

    /// @notice Check and confirm finality once enough blocks have passed
    /// @param configId The finality configuration
    /// @param proposalId The proposal to check
    /// @return finalized Whether the decision has achieved finality
    function checkFinality(bytes32 configId, bytes32 proposalId) external returns (bool finalized) {
        require(_configs[configId].exists, "Config not found");
        TrackingRecord storage rec = _tracking[configId][proposalId];
        require(rec.exists, "Not tracking this proposal");

        if (rec.finalized) return true;

        if (block.number >= rec.targetBlock) {
            rec.finalized = true;
            emit ChainFinalityAchieved(configId, proposalId, block.number);
            return true;
        }

        return false;
    }

    /// @notice Get the remaining blocks until finality
    /// @param configId The finality configuration
    /// @param proposalId The proposal to query
    /// @return remaining Blocks remaining (0 if finalized)
    function blocksRemaining(bytes32 configId, bytes32 proposalId) external view returns (uint256 remaining) {
        TrackingRecord storage rec = _tracking[configId][proposalId];
        if (!rec.exists || rec.finalized || block.number >= rec.targetBlock) return 0;
        return rec.targetBlock - block.number;
    }
}

contract BftFinality {
    // --- Types ---

    struct Committee {
        uint256 memberCount;
        uint256 threshold;      // required votes for consensus (> 2/3 of memberCount)
        bool exists;
    }

    struct FinalityProposal {
        bytes32 proposalId;
        bytes32 proposedBy;
        uint256 proposedAt;
        uint256 voteCount;
        bool consensusReached;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps committeeId -> Committee
    mapping(bytes32 => Committee) private _committees;

    /// @dev Maps committeeId -> memberIndex -> member ID
    mapping(bytes32 => mapping(uint256 => bytes32)) private _members;

    /// @dev Maps committeeId -> member -> isMember
    mapping(bytes32 => mapping(bytes32 => bool)) private _isMember;

    /// @dev Maps committeeId -> proposalId -> FinalityProposal
    mapping(bytes32 => mapping(bytes32 => FinalityProposal)) private _proposals;

    /// @dev Maps committeeId -> proposalId -> member -> hasVoted
    mapping(bytes32 => mapping(bytes32 => mapping(bytes32 => bool))) private _votes;

    // --- Events ---

    event CommitteeConfigured(bytes32 indexed committeeId, uint256 memberCount, uint256 threshold);
    event FinalityProposed(bytes32 indexed committeeId, bytes32 indexed proposalId, bytes32 indexed proposedBy);
    event FinalityVoteCast(bytes32 indexed committeeId, bytes32 indexed proposalId, bytes32 indexed memberId);
    event BftConsensusReached(bytes32 indexed committeeId, bytes32 indexed proposalId, uint256 voteCount, uint256 threshold);

    // --- Functions ---

    /// @notice Configure a BFT finality committee
    /// @param committeeId Unique committee identifier
    /// @param members Array of committee member identifiers
    function configureCommittee(bytes32 committeeId, bytes32[] calldata members) external {
        require(committeeId != bytes32(0), "Committee ID cannot be zero");
        require(!_committees[committeeId].exists, "Committee already exists");
        require(members.length >= 4, "Need at least 4 members for BFT (3f+1)");

        // BFT threshold: > 2/3 of members
        // threshold = floor(2 * members.length / 3) + 1
        uint256 threshold = (2 * members.length) / 3 + 1;

        _committees[committeeId] = Committee({
            memberCount: members.length,
            threshold: threshold,
            exists: true
        });

        for (uint256 i = 0; i < members.length; i++) {
            require(members[i] != bytes32(0), "Member cannot be zero");
            require(!_isMember[committeeId][members[i]], "Duplicate member");
            _members[committeeId][i] = members[i];
            _isMember[committeeId][members[i]] = true;
        }

        emit CommitteeConfigured(committeeId, members.length, threshold);
    }

    /// @notice Propose a decision for BFT finality
    /// @param committeeId The BFT committee
    /// @param proposalId The proposal/decision to finalize
    /// @param proposedBy The committee member proposing finality
    function proposeFinality(bytes32 committeeId, bytes32 proposalId, bytes32 proposedBy) external {
        require(_committees[committeeId].exists, "Committee not found");
        require(proposalId != bytes32(0), "Proposal ID cannot be zero");
        require(_isMember[committeeId][proposedBy], "Not a committee member");
        require(!_proposals[committeeId][proposalId].exists, "Proposal already exists");

        _proposals[committeeId][proposalId] = FinalityProposal({
            proposalId: proposalId,
            proposedBy: proposedBy,
            proposedAt: block.timestamp,
            voteCount: 1, // proposer implicitly votes
            consensusReached: false,
            exists: true
        });

        _votes[committeeId][proposalId][proposedBy] = true;

        emit FinalityProposed(committeeId, proposalId, proposedBy);
        emit FinalityVoteCast(committeeId, proposalId, proposedBy);

        // Check if threshold met with just the proposer (edge case for small committees)
        _checkAndFinalizeConsensus(committeeId, proposalId);
    }

    /// @notice Vote on a BFT finality proposal
    /// @param committeeId The BFT committee
    /// @param proposalId The proposal to vote on
    /// @param memberId The voting committee member
    function vote(bytes32 committeeId, bytes32 proposalId, bytes32 memberId) external {
        require(_committees[committeeId].exists, "Committee not found");
        FinalityProposal storage prop = _proposals[committeeId][proposalId];
        require(prop.exists, "Finality proposal not found");
        require(!prop.consensusReached, "Consensus already reached");
        require(_isMember[committeeId][memberId], "Not a committee member");
        require(!_votes[committeeId][proposalId][memberId], "Already voted");

        _votes[committeeId][proposalId][memberId] = true;
        prop.voteCount++;

        emit FinalityVoteCast(committeeId, proposalId, memberId);

        _checkAndFinalizeConsensus(committeeId, proposalId);
    }

    /// @notice Check if BFT consensus has been reached (> 2/3 votes)
    /// @param committeeId The BFT committee
    /// @param proposalId The proposal to check
    /// @return reached Whether consensus has been reached
    function checkConsensus(bytes32 committeeId, bytes32 proposalId) external view returns (bool reached) {
        require(_committees[committeeId].exists, "Committee not found");
        FinalityProposal storage prop = _proposals[committeeId][proposalId];
        if (!prop.exists) return false;
        return prop.consensusReached;
    }

    /// @dev Internal check and emit consensus event
    function _checkAndFinalizeConsensus(bytes32 committeeId, bytes32 proposalId) internal {
        FinalityProposal storage prop = _proposals[committeeId][proposalId];
        Committee storage committee = _committees[committeeId];

        if (!prop.consensusReached && prop.voteCount >= committee.threshold) {
            prop.consensusReached = true;
            emit BftConsensusReached(committeeId, proposalId, prop.voteCount, committee.threshold);
        }
    }
}

contract OptimisticOracleFinality {
    // --- Types ---

    enum AssertionStatus { Pending, Challenged, Resolved, Expired }

    struct Config {
        uint256 challengePeriod;    // seconds for the challenge window
        uint256 bondAmount;         // required bond for assertions and challenges
        bool exists;
    }

    struct Assertion {
        bytes32 proposalId;
        bytes32 asserter;
        uint256 assertedAt;
        uint256 challengeDeadline;
        bytes32 challenger;
        uint256 challengedAt;
        AssertionStatus status;
        bool outcome;               // true = assertion upheld, false = overturned
        bool resolved;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> proposalId -> Assertion
    mapping(bytes32 => mapping(bytes32 => Assertion)) private _assertions;

    // --- Events ---

    event OracleConfigured(bytes32 indexed configId, uint256 challengePeriod, uint256 bondAmount);
    event FinalityAsserted(bytes32 indexed configId, bytes32 indexed proposalId, bytes32 indexed asserter, uint256 challengeDeadline);
    event FinalityChallenged(bytes32 indexed configId, bytes32 indexed proposalId, bytes32 indexed challenger);
    event FinalityResolved(bytes32 indexed configId, bytes32 indexed proposalId, bool upheld);
    event FinalityExpired(bytes32 indexed configId, bytes32 indexed proposalId);

    // --- Functions ---

    /// @notice Configure an optimistic oracle finality provider
    /// @param configId Unique configuration identifier
    /// @param challengePeriod Challenge window duration in seconds
    /// @param bondAmount Required bond amount for assertions and challenges
    function configure(bytes32 configId, uint256 challengePeriod, uint256 bondAmount) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(challengePeriod > 0, "Challenge period must be positive");

        _configs[configId] = Config({
            challengePeriod: challengePeriod,
            bondAmount: bondAmount,
            exists: true
        });

        emit OracleConfigured(configId, challengePeriod, bondAmount);
    }

    /// @notice Assert that a decision should be finalized
    /// @param configId The oracle configuration
    /// @param proposalId The proposal being asserted as final
    /// @param asserter The entity making the assertion
    function assertFinality(bytes32 configId, bytes32 proposalId, bytes32 asserter) external {
        require(_configs[configId].exists, "Config not found");
        require(proposalId != bytes32(0), "Proposal ID cannot be zero");
        require(asserter != bytes32(0), "Asserter cannot be zero");
        require(!_assertions[configId][proposalId].exists, "Assertion already exists");

        uint256 deadline = block.timestamp + _configs[configId].challengePeriod;

        _assertions[configId][proposalId] = Assertion({
            proposalId: proposalId,
            asserter: asserter,
            assertedAt: block.timestamp,
            challengeDeadline: deadline,
            challenger: bytes32(0),
            challengedAt: 0,
            status: AssertionStatus.Pending,
            outcome: false,
            resolved: false,
            exists: true
        });

        emit FinalityAsserted(configId, proposalId, asserter, deadline);
    }

    /// @notice Challenge a finality assertion during the challenge window
    /// @param configId The oracle configuration
    /// @param proposalId The proposal whose assertion is being challenged
    /// @param challenger The entity challenging the assertion
    function challenge(bytes32 configId, bytes32 proposalId, bytes32 challenger) external {
        require(_configs[configId].exists, "Config not found");
        Assertion storage a = _assertions[configId][proposalId];
        require(a.exists, "Assertion not found");
        require(a.status == AssertionStatus.Pending, "Assertion not pending");
        require(block.timestamp <= a.challengeDeadline, "Challenge period ended");
        require(challenger != bytes32(0), "Challenger cannot be zero");
        require(challenger != a.asserter, "Cannot challenge own assertion");

        a.status = AssertionStatus.Challenged;
        a.challenger = challenger;
        a.challengedAt = block.timestamp;

        emit FinalityChallenged(configId, proposalId, challenger);
    }

    /// @notice Resolve a challenged assertion (e.g., via oracle or arbitration)
    /// @param configId The oracle configuration
    /// @param proposalId The challenged proposal
    /// @param upheld True if the original assertion is upheld, false if overturned
    function resolve(bytes32 configId, bytes32 proposalId, bool upheld) external {
        require(_configs[configId].exists, "Config not found");
        Assertion storage a = _assertions[configId][proposalId];
        require(a.exists, "Assertion not found");
        require(a.status == AssertionStatus.Challenged, "Assertion not challenged");
        require(!a.resolved, "Already resolved");

        a.status = AssertionStatus.Resolved;
        a.outcome = upheld;
        a.resolved = true;

        emit FinalityResolved(configId, proposalId, upheld);
    }

    /// @notice Check if a pending assertion has expired (challenge period passed without challenge)
    /// @dev If expired, the assertion is considered upheld (optimistic finality achieved)
    /// @param configId The oracle configuration
    /// @param proposalId The proposal to check
    /// @return finalized True if the assertion expired unchallenged (finality achieved)
    function checkExpiry(bytes32 configId, bytes32 proposalId) external returns (bool finalized) {
        require(_configs[configId].exists, "Config not found");
        Assertion storage a = _assertions[configId][proposalId];
        require(a.exists, "Assertion not found");

        if (a.status == AssertionStatus.Resolved) {
            return a.outcome;
        }

        if (a.status == AssertionStatus.Pending && block.timestamp > a.challengeDeadline) {
            a.status = AssertionStatus.Expired;
            a.outcome = true; // unchallenged assertion is upheld
            a.resolved = true;

            emit FinalityExpired(configId, proposalId);
            return true;
        }

        return false;
    }

    /// @notice Get the assertion status for a proposal
    /// @param configId The oracle configuration
    /// @param proposalId The proposal to query
    /// @return The assertion record
    function getAssertion(bytes32 configId, bytes32 proposalId) external view returns (Assertion memory) {
        require(_assertions[configId][proposalId].exists, "Assertion not found");
        return _assertions[configId][proposalId];
    }
}
