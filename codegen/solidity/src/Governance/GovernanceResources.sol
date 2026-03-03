// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GovernanceResources
/// @notice Multi-token treasury, reputation management, bonding curves, and objective tracking
/// @dev Implements the Treasury, Reputation, BondingCurve, Metric, and Objective concepts
///      from Clef specification.
///      Treasury provides a multi-token vault with deposit/withdraw/allocate.
///      Reputation supports earn/burn/decay. BondingCurve stubs buy/sell with curve math.
///      Metric and Objective are lightweight tracking structs for governance KPIs.

contract GovernanceResources {
    // --- Types ---

    struct TokenBalance {
        address token;               // ERC-20 token address (address(0) for native ETH)
        uint256 balance;
        bool exists;
    }

    struct Allocation {
        bytes32 recipientId;
        address token;
        uint256 amount;
        string purpose;
        uint256 allocatedAt;
    }

    struct ReputationRecord {
        bytes32 memberId;
        uint256 score;
        uint256 lastDecayBlock;
        bool exists;
    }

    struct BondingCurveConfig {
        uint256 reserveBalance;
        uint256 tokenSupply;
        uint32 reserveRatio;         // in parts-per-million (e.g., 500000 = 50%)
        bool exists;
    }

    struct Metric {
        string name;
        string unit;
        int256 value;
        uint256 updatedAt;
        bool exists;
    }

    enum ObjectiveStatus { Active, Completed, Abandoned }

    struct Objective {
        string title;
        string description;
        bytes32 metricId;            // the metric being targeted
        int256 targetValue;
        ObjectiveStatus status;
        uint256 createdAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps token address -> TokenBalance in the treasury
    mapping(address => TokenBalance) private _treasuryBalances;

    /// @dev Array of all token addresses held in treasury (for enumeration)
    address[] private _treasuryTokens;

    /// @dev History of allocations
    Allocation[] private _allocations;

    /// @dev Maps member ID -> ReputationRecord
    mapping(bytes32 => ReputationRecord) private _reputations;

    /// @dev Global bonding curve configuration
    BondingCurveConfig private _bondingCurve;

    /// @dev Maps metric ID -> Metric
    mapping(bytes32 => Metric) private _metrics;

    /// @dev Maps objective ID -> Objective
    mapping(bytes32 => Objective) private _objectives;

    // --- Events ---

    event TreasuryDeposited(address indexed token, uint256 amount, bytes32 indexed depositorId);
    event TreasuryWithdrawn(address indexed token, uint256 amount, bytes32 indexed recipientId);
    event TreasuryAllocated(address indexed token, uint256 amount, bytes32 indexed recipientId, string purpose);

    event ReputationEarned(bytes32 indexed memberId, uint256 amount, uint256 newScore);
    event ReputationBurned(bytes32 indexed memberId, uint256 amount, uint256 newScore);
    event ReputationDecayed(bytes32 indexed memberId, uint256 decayAmount, uint256 newScore);

    event BondingCurveConfigured(uint256 reserveBalance, uint256 tokenSupply, uint32 reserveRatio);
    event BondingCurveBuy(address indexed buyer, uint256 depositAmount, uint256 tokensReceived);
    event BondingCurveSell(address indexed seller, uint256 tokensBurned, uint256 reserveReturned);

    event MetricUpdated(bytes32 indexed metricId, string name, int256 value);
    event ObjectiveCreated(bytes32 indexed objectiveId, string title, bytes32 indexed metricId);
    event ObjectiveStatusChanged(bytes32 indexed objectiveId, ObjectiveStatus status);

    // --- Treasury Actions ---

    /// @notice Deposit tokens into the treasury
    /// @param token The ERC-20 token address (address(0) for native ETH)
    /// @param amount The amount to deposit
    /// @param depositorId The depositor's member ID
    function deposit(address token, uint256 amount, bytes32 depositorId) external {
        require(amount > 0, "Amount must be positive");
        require(depositorId != bytes32(0), "Depositor ID cannot be zero");

        if (!_treasuryBalances[token].exists) {
            _treasuryBalances[token] = TokenBalance({
                token: token,
                balance: 0,
                exists: true
            });
            _treasuryTokens.push(token);
        }

        _treasuryBalances[token].balance += amount;

        // TODO: implement actual ERC-20 transferFrom or ETH receive

        emit TreasuryDeposited(token, amount, depositorId);
    }

    /// @notice Withdraw tokens from the treasury
    /// @param token The ERC-20 token address
    /// @param amount The amount to withdraw
    /// @param recipientId The recipient's member ID
    function withdraw(address token, uint256 amount, bytes32 recipientId) external {
        require(amount > 0, "Amount must be positive");
        require(recipientId != bytes32(0), "Recipient ID cannot be zero");
        require(_treasuryBalances[token].exists, "Token not in treasury");
        require(_treasuryBalances[token].balance >= amount, "Insufficient balance");

        _treasuryBalances[token].balance -= amount;

        // TODO: implement actual ERC-20 transfer or ETH send

        emit TreasuryWithdrawn(token, amount, recipientId);
    }

    /// @notice Allocate tokens from the treasury for a specific purpose
    /// @param token The token to allocate
    /// @param amount The amount to allocate
    /// @param recipientId The recipient
    /// @param purpose Human-readable purpose
    function allocate(address token, uint256 amount, bytes32 recipientId, string calldata purpose) external {
        require(amount > 0, "Amount must be positive");
        require(recipientId != bytes32(0), "Recipient ID cannot be zero");
        require(bytes(purpose).length > 0, "Purpose cannot be empty");
        require(_treasuryBalances[token].exists, "Token not in treasury");
        require(_treasuryBalances[token].balance >= amount, "Insufficient balance");

        _treasuryBalances[token].balance -= amount;

        _allocations.push(Allocation({
            recipientId: recipientId,
            token: token,
            amount: amount,
            purpose: purpose,
            allocatedAt: block.timestamp
        }));

        // TODO: implement actual token transfer to recipient

        emit TreasuryAllocated(token, amount, recipientId, purpose);
    }

    // --- Reputation Actions ---

    /// @notice Earn reputation for a member
    /// @param memberId The member earning reputation
    /// @param amount Amount of reputation to earn
    function earnReputation(bytes32 memberId, uint256 amount) external {
        require(memberId != bytes32(0), "Member ID cannot be zero");
        require(amount > 0, "Amount must be positive");

        if (!_reputations[memberId].exists) {
            _reputations[memberId] = ReputationRecord({
                memberId: memberId,
                score: 0,
                lastDecayBlock: block.number,
                exists: true
            });
        }

        _reputations[memberId].score += amount;

        emit ReputationEarned(memberId, amount, _reputations[memberId].score);
    }

    /// @notice Burn reputation from a member
    /// @param memberId The member losing reputation
    /// @param amount Amount of reputation to burn
    function burnReputation(bytes32 memberId, uint256 amount) external {
        require(memberId != bytes32(0), "Member ID cannot be zero");
        require(_reputations[memberId].exists, "Reputation not found");
        require(_reputations[memberId].score >= amount, "Insufficient reputation");

        _reputations[memberId].score -= amount;

        emit ReputationBurned(memberId, amount, _reputations[memberId].score);
    }

    /// @notice Apply time-based reputation decay
    /// @param memberId The member to decay
    /// @param decayRateBps Decay rate in basis points per block-interval elapsed
    /// @param blockInterval Number of blocks per decay interval
    function applyDecay(bytes32 memberId, uint256 decayRateBps, uint256 blockInterval) external {
        require(_reputations[memberId].exists, "Reputation not found");
        require(decayRateBps <= 10000, "Decay rate exceeds 100%");
        require(blockInterval > 0, "Block interval must be positive");

        ReputationRecord storage rep = _reputations[memberId];
        uint256 elapsed = block.number - rep.lastDecayBlock;

        if (elapsed < blockInterval) {
            return;
        }

        uint256 intervals = elapsed / blockInterval;
        uint256 decayAmount = (rep.score * decayRateBps * intervals) / 10000;

        if (decayAmount > rep.score) {
            decayAmount = rep.score;
        }

        rep.score -= decayAmount;
        rep.lastDecayBlock = block.number;

        emit ReputationDecayed(memberId, decayAmount, rep.score);
    }

    // --- BondingCurve Actions ---

    /// @notice Configure the bonding curve parameters
    /// @param reserveBalance Initial reserve token balance
    /// @param tokenSupply Initial continuous token supply
    /// @param reserveRatio Reserve ratio in PPM (e.g., 500000 = 50%)
    function configureBondingCurve(uint256 reserveBalance, uint256 tokenSupply, uint32 reserveRatio) external {
        require(reserveBalance > 0, "Reserve must be positive");
        require(tokenSupply > 0, "Supply must be positive");
        require(reserveRatio > 0 && reserveRatio <= 1000000, "Ratio must be 1-1000000 PPM");

        _bondingCurve = BondingCurveConfig({
            reserveBalance: reserveBalance,
            tokenSupply: tokenSupply,
            reserveRatio: reserveRatio,
            exists: true
        });

        emit BondingCurveConfigured(reserveBalance, tokenSupply, reserveRatio);
    }

    /// @notice Buy tokens on the bonding curve
    /// @param buyer The buyer address
    /// @param depositAmount Amount of reserve token deposited
    function buyOnCurve(address buyer, uint256 depositAmount) external {
        require(_bondingCurve.exists, "Curve not configured");
        require(buyer != address(0), "Buyer cannot be zero address");
        require(depositAmount > 0, "Deposit must be positive");

        // TODO: implement Bancor formula: tokensReceived = tokenSupply * ((1 + depositAmount / reserveBalance)^(reserveRatio/1000000) - 1)
        uint256 tokensReceived = 0;

        _bondingCurve.reserveBalance += depositAmount;
        _bondingCurve.tokenSupply += tokensReceived;

        emit BondingCurveBuy(buyer, depositAmount, tokensReceived);
    }

    /// @notice Sell tokens on the bonding curve
    /// @param seller The seller address
    /// @param tokensBurned Amount of continuous tokens to sell
    function sellOnCurve(address seller, uint256 tokensBurned) external {
        require(_bondingCurve.exists, "Curve not configured");
        require(seller != address(0), "Seller cannot be zero address");
        require(tokensBurned > 0, "Tokens must be positive");
        require(tokensBurned <= _bondingCurve.tokenSupply, "Exceeds supply");

        // TODO: implement Bancor formula: reserveReturned = reserveBalance * (1 - (1 - tokensBurned / tokenSupply)^(1000000/reserveRatio))
        uint256 reserveReturned = 0;

        _bondingCurve.tokenSupply -= tokensBurned;
        _bondingCurve.reserveBalance -= reserveReturned;

        emit BondingCurveSell(seller, tokensBurned, reserveReturned);
    }

    // --- Metric & Objective Actions ---

    /// @notice Create or update a governance metric
    /// @param metricId Unique identifier
    /// @param name Metric name
    /// @param unit Unit of measurement
    /// @param value Current metric value
    function updateMetric(bytes32 metricId, string calldata name, string calldata unit, int256 value) external {
        require(metricId != bytes32(0), "Metric ID cannot be zero");
        require(bytes(name).length > 0, "Name cannot be empty");

        _metrics[metricId] = Metric({
            name: name,
            unit: unit,
            value: value,
            updatedAt: block.timestamp,
            exists: true
        });

        emit MetricUpdated(metricId, name, value);
    }

    /// @notice Create an objective targeting a metric
    /// @param objectiveId Unique identifier
    /// @param title Objective title
    /// @param description Objective description
    /// @param metricId The metric being targeted
    /// @param targetValue Target value for the metric
    function createObjective(
        bytes32 objectiveId,
        string calldata title,
        string calldata description,
        bytes32 metricId,
        int256 targetValue
    ) external {
        require(objectiveId != bytes32(0), "Objective ID cannot be zero");
        require(!_objectives[objectiveId].exists, "Objective already exists");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(_metrics[metricId].exists, "Metric not found");

        _objectives[objectiveId] = Objective({
            title: title,
            description: description,
            metricId: metricId,
            targetValue: targetValue,
            status: ObjectiveStatus.Active,
            createdAt: block.timestamp,
            exists: true
        });

        emit ObjectiveCreated(objectiveId, title, metricId);
    }

    /// @notice Update objective status
    /// @param objectiveId The objective to update
    /// @param status New status
    function updateObjectiveStatus(bytes32 objectiveId, ObjectiveStatus status) external {
        require(_objectives[objectiveId].exists, "Objective not found");

        _objectives[objectiveId].status = status;

        emit ObjectiveStatusChanged(objectiveId, status);
    }

    // --- Views ---

    /// @notice Get treasury balance for a token
    /// @param token The token address
    /// @return balance The current balance
    function getTreasuryBalance(address token) external view returns (uint256 balance) {
        return _treasuryBalances[token].balance;
    }

    /// @notice Get the number of tokens in the treasury
    /// @return count Number of distinct tokens
    function getTreasuryTokenCount() external view returns (uint256 count) {
        return _treasuryTokens.length;
    }

    /// @notice Get the total number of allocations
    /// @return count Number of allocations
    function getAllocationCount() external view returns (uint256 count) {
        return _allocations.length;
    }

    /// @notice Get a member's reputation
    /// @param memberId The member ID
    /// @return The ReputationRecord struct
    function getReputation(bytes32 memberId) external view returns (ReputationRecord memory) {
        require(_reputations[memberId].exists, "Reputation not found");
        return _reputations[memberId];
    }

    /// @notice Get the bonding curve configuration
    /// @return The BondingCurveConfig struct
    function getBondingCurve() external view returns (BondingCurveConfig memory) {
        require(_bondingCurve.exists, "Curve not configured");
        return _bondingCurve;
    }

    /// @notice Get a metric
    /// @param metricId The metric ID
    /// @return The Metric struct
    function getMetric(bytes32 metricId) external view returns (Metric memory) {
        require(_metrics[metricId].exists, "Metric not found");
        return _metrics[metricId];
    }

    /// @notice Get an objective
    /// @param objectiveId The objective ID
    /// @return The Objective struct
    function getObjective(bytes32 objectiveId) external view returns (Objective memory) {
        require(_objectives[objectiveId].exists, "Objective not found");
        return _objectives[objectiveId];
    }
}
