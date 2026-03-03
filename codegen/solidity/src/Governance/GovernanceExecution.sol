// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GovernanceExecution
/// @notice Execution scheduling, timelocks, guard checks, finality gating, and rage-quit exit
/// @dev Implements the Execution, Timelock, Guard, FinalityGate, and RageQuit concepts
///      from Clef specification.
///      Execution manages schedule/execute/rollback. Timelock enforces delay + grace period.
///      Guard provides pre/post execution checks. FinalityGate is a stub for cross-chain
///      or async finality. RageQuit allows proportional exit during disagreement.

contract GovernanceExecution {
    // --- Types ---

    enum ExecutionStatus { Scheduled, Queued, Executed, RolledBack, Cancelled }

    struct Execution {
        bytes32 proposalId;
        bytes payload;               // encoded calldata for the action
        ExecutionStatus status;
        uint256 scheduledAt;
        uint256 executedAt;
        bool exists;
    }

    struct TimelockConfig {
        uint256 delay;               // seconds before execution is allowed
        uint256 gracePeriod;         // seconds after delay during which execution is valid
        bool exists;
    }

    struct TimelockEntry {
        bytes32 executionId;
        uint256 eta;                 // earliest execution time (scheduledAt + delay)
        uint256 expiresAt;           // eta + gracePeriod
        bool executed;
        bool cancelled;
        bool exists;
    }

    struct GuardCheck {
        bytes32 guardId;
        string condition;            // encoded pre/post condition reference
        bool isPre;                  // true = pre-check, false = post-check
        bool exists;
    }

    struct FinalityGateState {
        bytes32 executionId;
        bool finalized;
        uint256 confirmations;
        uint256 requiredConfirmations;
        bool exists;
    }

    struct RageQuitRequest {
        bytes32 memberId;
        uint256 sharesBurned;        // governance shares being surrendered
        uint256 proportionalValue;   // calculated proportional exit value
        uint256 requestedAt;
        bool processed;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps execution ID -> Execution
    mapping(bytes32 => Execution) private _executions;

    /// @dev Global timelock configuration (one per contract, updatable)
    TimelockConfig private _timelockConfig;

    /// @dev Maps execution ID -> TimelockEntry
    mapping(bytes32 => TimelockEntry) private _timelockEntries;

    /// @dev Maps guard ID -> GuardCheck
    mapping(bytes32 => GuardCheck) private _guards;

    /// @dev Maps execution ID -> array of guard IDs (pre-checks)
    mapping(bytes32 => bytes32[]) private _preGuards;

    /// @dev Maps execution ID -> array of guard IDs (post-checks)
    mapping(bytes32 => bytes32[]) private _postGuards;

    /// @dev Maps execution ID -> FinalityGateState
    mapping(bytes32 => FinalityGateState) private _finalityGates;

    /// @dev Maps rage-quit request ID -> RageQuitRequest
    mapping(bytes32 => RageQuitRequest) private _rageQuitRequests;

    /// @dev Total governance shares outstanding (for proportional exit calculation)
    uint256 private _totalShares;

    /// @dev Total value held (for proportional exit calculation)
    uint256 private _totalValue;

    // --- Events ---

    event ExecutionScheduled(bytes32 indexed executionId, bytes32 indexed proposalId, uint256 eta);
    event ExecutionExecuted(bytes32 indexed executionId);
    event ExecutionRolledBack(bytes32 indexed executionId);
    event ExecutionCancelled(bytes32 indexed executionId);

    event TimelockConfigured(uint256 delay, uint256 gracePeriod);
    event TimelockQueued(bytes32 indexed executionId, uint256 eta, uint256 expiresAt);

    event GuardRegistered(bytes32 indexed guardId, bool isPre);
    event GuardAttached(bytes32 indexed executionId, bytes32 indexed guardId);
    event GuardCheckPassed(bytes32 indexed executionId, bytes32 indexed guardId);

    event FinalityGateCreated(bytes32 indexed executionId, uint256 requiredConfirmations);
    event FinalityConfirmation(bytes32 indexed executionId, uint256 totalConfirmations);
    event FinalityReached(bytes32 indexed executionId);

    event RageQuitRequested(bytes32 indexed requestId, bytes32 indexed memberId, uint256 sharesBurned);
    event RageQuitProcessed(bytes32 indexed requestId, uint256 proportionalValue);

    // --- Timelock Configuration ---

    /// @notice Configure the timelock parameters
    /// @param delay Seconds before an execution can proceed
    /// @param gracePeriod Seconds after delay during which execution remains valid
    function configureTimelock(uint256 delay, uint256 gracePeriod) external {
        require(delay > 0, "Delay must be positive");
        require(gracePeriod > 0, "Grace period must be positive");

        _timelockConfig = TimelockConfig({
            delay: delay,
            gracePeriod: gracePeriod,
            exists: true
        });

        emit TimelockConfigured(delay, gracePeriod);
    }

    // --- Execution Actions ---

    /// @notice Schedule an execution for a passed proposal
    /// @param executionId Unique identifier
    /// @param proposalId The proposal being executed
    /// @param payload Encoded action calldata
    function schedule(bytes32 executionId, bytes32 proposalId, bytes calldata payload) external {
        require(executionId != bytes32(0), "Execution ID cannot be zero");
        require(!_executions[executionId].exists, "Execution already exists");
        require(proposalId != bytes32(0), "Proposal ID cannot be zero");
        require(payload.length > 0, "Payload cannot be empty");

        uint256 eta = block.timestamp;
        uint256 expiresAt = 0;

        _executions[executionId] = Execution({
            proposalId: proposalId,
            payload: payload,
            status: ExecutionStatus.Scheduled,
            scheduledAt: block.timestamp,
            executedAt: 0,
            exists: true
        });

        // Apply timelock if configured
        if (_timelockConfig.exists) {
            eta = block.timestamp + _timelockConfig.delay;
            expiresAt = eta + _timelockConfig.gracePeriod;

            _timelockEntries[executionId] = TimelockEntry({
                executionId: executionId,
                eta: eta,
                expiresAt: expiresAt,
                executed: false,
                cancelled: false,
                exists: true
            });

            _executions[executionId].status = ExecutionStatus.Queued;

            emit TimelockQueued(executionId, eta, expiresAt);
        }

        emit ExecutionScheduled(executionId, proposalId, eta);
    }

    /// @notice Execute a scheduled action (respects timelock if present)
    /// @param executionId The execution to run
    function execute(bytes32 executionId) external {
        require(_executions[executionId].exists, "Execution not found");
        ExecutionStatus s = _executions[executionId].status;
        require(s == ExecutionStatus.Scheduled || s == ExecutionStatus.Queued, "Not in executable state");

        // Check timelock constraints
        if (_timelockEntries[executionId].exists) {
            TimelockEntry storage tl = _timelockEntries[executionId];
            require(!tl.cancelled, "Timelock cancelled");
            require(block.timestamp >= tl.eta, "Timelock delay not elapsed");
            require(block.timestamp <= tl.expiresAt, "Timelock grace period expired");
            tl.executed = true;
        }

        // Check finality gate if present
        if (_finalityGates[executionId].exists) {
            require(_finalityGates[executionId].finalized, "Finality not reached");
        }

        // Run pre-guards
        bytes32[] storage preGuardIds = _preGuards[executionId];
        for (uint256 i = 0; i < preGuardIds.length; i++) {
            // TODO: implement actual guard condition evaluation
            emit GuardCheckPassed(executionId, preGuardIds[i]);
        }

        _executions[executionId].status = ExecutionStatus.Executed;
        _executions[executionId].executedAt = block.timestamp;

        // TODO: implement actual payload execution (low-level call)

        // Run post-guards
        bytes32[] storage postGuardIds = _postGuards[executionId];
        for (uint256 i = 0; i < postGuardIds.length; i++) {
            // TODO: implement actual guard condition evaluation
            emit GuardCheckPassed(executionId, postGuardIds[i]);
        }

        emit ExecutionExecuted(executionId);
    }

    /// @notice Roll back a previously executed action
    /// @param executionId The execution to roll back
    function rollback(bytes32 executionId) external {
        require(_executions[executionId].exists, "Execution not found");
        require(_executions[executionId].status == ExecutionStatus.Executed, "Not executed");

        _executions[executionId].status = ExecutionStatus.RolledBack;

        // TODO: implement rollback logic (reverse action or compensating transaction)

        emit ExecutionRolledBack(executionId);
    }

    /// @notice Cancel a scheduled or queued execution
    /// @param executionId The execution to cancel
    function cancel(bytes32 executionId) external {
        require(_executions[executionId].exists, "Execution not found");
        ExecutionStatus s = _executions[executionId].status;
        require(s == ExecutionStatus.Scheduled || s == ExecutionStatus.Queued, "Not cancellable");

        _executions[executionId].status = ExecutionStatus.Cancelled;

        if (_timelockEntries[executionId].exists) {
            _timelockEntries[executionId].cancelled = true;
        }

        emit ExecutionCancelled(executionId);
    }

    // --- Guard Actions ---

    /// @notice Register a guard condition
    /// @param guardId Unique guard identifier
    /// @param condition Encoded condition reference
    /// @param isPre Whether this is a pre-check (true) or post-check (false)
    function registerGuard(bytes32 guardId, string calldata condition, bool isPre) external {
        require(guardId != bytes32(0), "Guard ID cannot be zero");
        require(!_guards[guardId].exists, "Guard already exists");
        require(bytes(condition).length > 0, "Condition cannot be empty");

        _guards[guardId] = GuardCheck({
            guardId: guardId,
            condition: condition,
            isPre: isPre,
            exists: true
        });

        emit GuardRegistered(guardId, isPre);
    }

    /// @notice Attach a guard to an execution
    /// @param executionId The execution to guard
    /// @param guardId The guard to attach
    function attachGuard(bytes32 executionId, bytes32 guardId) external {
        require(_executions[executionId].exists, "Execution not found");
        require(_guards[guardId].exists, "Guard not found");

        if (_guards[guardId].isPre) {
            _preGuards[executionId].push(guardId);
        } else {
            _postGuards[executionId].push(guardId);
        }

        emit GuardAttached(executionId, guardId);
    }

    // --- FinalityGate Actions ---

    /// @notice Create a finality gate requiring N confirmations before execution
    /// @param executionId The execution to gate
    /// @param requiredConfirmations Number of confirmations needed
    function createFinalityGate(bytes32 executionId, uint256 requiredConfirmations) external {
        require(_executions[executionId].exists, "Execution not found");
        require(!_finalityGates[executionId].exists, "Gate already exists");
        require(requiredConfirmations > 0, "Must require at least one confirmation");

        _finalityGates[executionId] = FinalityGateState({
            executionId: executionId,
            finalized: false,
            confirmations: 0,
            requiredConfirmations: requiredConfirmations,
            exists: true
        });

        emit FinalityGateCreated(executionId, requiredConfirmations);
    }

    /// @notice Add a confirmation to a finality gate
    /// @param executionId The gated execution
    function confirmFinality(bytes32 executionId) external {
        require(_finalityGates[executionId].exists, "Gate not found");
        require(!_finalityGates[executionId].finalized, "Already finalized");

        // TODO: implement deduplication of confirmations per confirmer

        _finalityGates[executionId].confirmations++;

        emit FinalityConfirmation(executionId, _finalityGates[executionId].confirmations);

        if (_finalityGates[executionId].confirmations >= _finalityGates[executionId].requiredConfirmations) {
            _finalityGates[executionId].finalized = true;
            emit FinalityReached(executionId);
        }
    }

    // --- RageQuit Actions ---

    /// @notice Configure total shares and value for proportional exit calculation
    /// @param totalShares Total governance shares outstanding
    /// @param totalValue Total value held by the governance body
    function configureRageQuit(uint256 totalShares, uint256 totalValue) external {
        require(totalShares > 0, "Total shares must be positive");

        _totalShares = totalShares;
        _totalValue = totalValue;
    }

    /// @notice Request a rage-quit: burn governance shares for proportional exit value
    /// @param requestId Unique request identifier
    /// @param memberId The member requesting exit
    /// @param sharesBurned Number of governance shares to burn
    function requestRageQuit(bytes32 requestId, bytes32 memberId, uint256 sharesBurned) external {
        require(requestId != bytes32(0), "Request ID cannot be zero");
        require(!_rageQuitRequests[requestId].exists, "Request already exists");
        require(memberId != bytes32(0), "Member ID cannot be zero");
        require(sharesBurned > 0, "Shares must be positive");
        require(_totalShares > 0, "RageQuit not configured");
        require(sharesBurned <= _totalShares, "Exceeds total shares");

        uint256 proportional = (_totalValue * sharesBurned) / _totalShares;

        _rageQuitRequests[requestId] = RageQuitRequest({
            memberId: memberId,
            sharesBurned: sharesBurned,
            proportionalValue: proportional,
            requestedAt: block.timestamp,
            processed: false,
            exists: true
        });

        emit RageQuitRequested(requestId, memberId, sharesBurned);
    }

    /// @notice Process a rage-quit request (transfer exit value)
    /// @param requestId The request to process
    function processRageQuit(bytes32 requestId) external {
        require(_rageQuitRequests[requestId].exists, "Request not found");
        require(!_rageQuitRequests[requestId].processed, "Already processed");

        RageQuitRequest storage req = _rageQuitRequests[requestId];
        req.processed = true;

        _totalShares -= req.sharesBurned;
        _totalValue -= req.proportionalValue;

        // TODO: implement actual value transfer to exiting member

        emit RageQuitProcessed(requestId, req.proportionalValue);
    }

    // --- Views ---

    /// @notice Get an execution record
    /// @param executionId The execution ID
    /// @return The Execution struct
    function getExecution(bytes32 executionId) external view returns (Execution memory) {
        require(_executions[executionId].exists, "Execution not found");
        return _executions[executionId];
    }

    /// @notice Get a timelock entry
    /// @param executionId The execution ID
    /// @return The TimelockEntry struct
    function getTimelockEntry(bytes32 executionId) external view returns (TimelockEntry memory) {
        require(_timelockEntries[executionId].exists, "Timelock not found");
        return _timelockEntries[executionId];
    }

    /// @notice Get the timelock configuration
    /// @return The TimelockConfig struct
    function getTimelockConfig() external view returns (TimelockConfig memory) {
        require(_timelockConfig.exists, "Timelock not configured");
        return _timelockConfig;
    }

    /// @notice Get a finality gate state
    /// @param executionId The execution ID
    /// @return The FinalityGateState struct
    function getFinalityGate(bytes32 executionId) external view returns (FinalityGateState memory) {
        require(_finalityGates[executionId].exists, "Gate not found");
        return _finalityGates[executionId];
    }

    /// @notice Get a rage-quit request
    /// @param requestId The request ID
    /// @return The RageQuitRequest struct
    function getRageQuitRequest(bytes32 requestId) external view returns (RageQuitRequest memory) {
        require(_rageQuitRequests[requestId].exists, "Request not found");
        return _rageQuitRequests[requestId];
    }
}
