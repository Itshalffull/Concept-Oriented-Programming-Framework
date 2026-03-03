// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WeightProviders
/// @notice Weight source provider contracts for governance voting power calculation
/// @dev Implements TokenBalanceWeight, ReputationWeight, StakeWeight, EqualWeight,
///      VoteEscrowWeight, and QuadraticWeight provider concepts from the Clef specification.
///      Uses fixed-point arithmetic in basis points (10000 = 100%) and WAD (1e18) where noted.

contract TokenBalanceWeight {
    // --- Types ---

    struct Config {
        bytes32 tokenId;
        uint256 snapshotInterval;   // minimum blocks between snapshots
        bool exists;
    }

    struct BalanceRecord {
        uint256 balance;
        uint256 snapshotBlock;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps configId -> Config
    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> account -> BalanceRecord
    mapping(bytes32 => mapping(bytes32 => BalanceRecord)) private _balances;

    /// @dev Maps configId -> account -> snapshotBlock -> snapshotted balance
    mapping(bytes32 => mapping(bytes32 => mapping(uint256 => uint256))) private _snapshots;

    // --- Events ---

    event TokenBalanceConfigured(bytes32 indexed configId, bytes32 indexed tokenId, uint256 snapshotInterval);
    event BalanceSet(bytes32 indexed configId, bytes32 indexed account, uint256 balance);
    event SnapshotTaken(bytes32 indexed configId, bytes32 indexed account, uint256 balance, uint256 blockNumber);

    // --- Functions ---

    /// @notice Configure a token balance weight source
    /// @param configId Unique configuration identifier
    /// @param tokenId The token whose balances determine weight
    /// @param snapshotInterval Minimum blocks between snapshots
    function configure(bytes32 configId, bytes32 tokenId, uint256 snapshotInterval) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(tokenId != bytes32(0), "Token ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");

        _configs[configId] = Config({
            tokenId: tokenId,
            snapshotInterval: snapshotInterval,
            exists: true
        });

        emit TokenBalanceConfigured(configId, tokenId, snapshotInterval);
    }

    /// @notice Set or update an account's token balance
    /// @param configId The weight configuration
    /// @param account The account identifier
    /// @param balance The token balance
    function setBalance(bytes32 configId, bytes32 account, uint256 balance) external {
        require(_configs[configId].exists, "Config not found");
        require(account != bytes32(0), "Account cannot be zero");

        _balances[configId][account] = BalanceRecord({
            balance: balance,
            snapshotBlock: block.number,
            exists: true
        });

        emit BalanceSet(configId, account, balance);
    }

    /// @notice Take a snapshot of an account's balance at the current block
    /// @param configId The weight configuration
    /// @param account The account to snapshot
    function takeSnapshot(bytes32 configId, bytes32 account) external {
        require(_configs[configId].exists, "Config not found");
        BalanceRecord storage record = _balances[configId][account];
        require(record.exists, "Balance not found");

        uint256 interval = _configs[configId].snapshotInterval;
        if (interval > 0) {
            require(
                block.number >= record.snapshotBlock + interval,
                "Snapshot interval not elapsed"
            );
        }

        _snapshots[configId][account][block.number] = record.balance;
        record.snapshotBlock = block.number;

        emit SnapshotTaken(configId, account, record.balance, block.number);
    }

    /// @notice Get an account's current balance as voting weight
    /// @param configId The weight configuration
    /// @param account The account identifier
    /// @return weight The voting weight (equals token balance)
    function getBalance(bytes32 configId, bytes32 account) external view returns (uint256 weight) {
        require(_configs[configId].exists, "Config not found");
        require(_balances[configId][account].exists, "Balance not found");
        return _balances[configId][account].balance;
    }
}

contract ReputationWeight {
    // --- Types ---

    enum ScalingMode { Linear, Logarithmic, Sigmoid }

    struct Config {
        ScalingMode mode;
        uint256 cap;        // maximum weight (0 = no cap)
        uint256 scale;      // scaling factor in WAD (1e18 = 1x)
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps configId -> Config
    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> account -> raw reputation score (WAD)
    mapping(bytes32 => mapping(bytes32 => uint256)) private _scores;

    // --- Events ---

    event ReputationConfigured(bytes32 indexed configId, uint8 mode, uint256 cap, uint256 scale);
    event ReputationComputed(bytes32 indexed configId, bytes32 indexed account, uint256 rawScore, uint256 weight);

    // --- Constants ---

    uint256 private constant WAD = 1e18;

    // --- Functions ---

    /// @notice Configure a reputation weight source
    /// @param configId Unique configuration identifier
    /// @param mode Scaling mode: 0 = Linear, 1 = Logarithmic, 2 = Sigmoid
    /// @param cap Maximum weight output (0 for no cap)
    /// @param scale Scaling factor in WAD (1e18 = 1.0x)
    function configure(bytes32 configId, ScalingMode mode, uint256 cap, uint256 scale) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(scale > 0, "Scale must be positive");

        _configs[configId] = Config({
            mode: mode,
            cap: cap,
            scale: scale,
            exists: true
        });

        emit ReputationConfigured(configId, uint8(mode), cap, scale);
    }

    /// @notice Compute voting weight from a raw reputation score
    /// @param configId The weight configuration
    /// @param account The account identifier
    /// @param rawScore The raw reputation score (WAD-scaled)
    /// @return weight The computed voting weight
    function compute(bytes32 configId, bytes32 account, uint256 rawScore) external returns (uint256 weight) {
        require(_configs[configId].exists, "Config not found");
        require(account != bytes32(0), "Account cannot be zero");

        Config storage cfg = _configs[configId];
        _scores[configId][account] = rawScore;

        if (cfg.mode == ScalingMode.Linear) {
            // weight = rawScore * scale / WAD
            weight = (rawScore * cfg.scale) / WAD;
        } else if (cfg.mode == ScalingMode.Logarithmic) {
            // Approximate log2 via bit-length, then scale
            // log2(x) ~= bitLength(x) - 1 for x > 0
            uint256 logVal = _log2Approx(rawScore);
            weight = (logVal * cfg.scale) / WAD;
        } else {
            // Sigmoid approximation: weight = score / (score + scale)
            // Output in WAD, then normalized
            weight = (rawScore * WAD) / (rawScore + cfg.scale);
        }

        // Apply cap
        if (cfg.cap > 0 && weight > cfg.cap) {
            weight = cfg.cap;
        }

        emit ReputationComputed(configId, account, rawScore, weight);
        return weight;
    }

    /// @dev Approximate log2 of a value using bit-length (integer part only, WAD-scaled)
    function _log2Approx(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 result = 0;
        uint256 temp = x;
        while (temp > 1) {
            temp >>= 1;
            result++;
        }
        return result * WAD;
    }
}

contract StakeWeight {
    // --- Types ---

    struct Config {
        uint256 minStake;
        uint256 maxStake;       // 0 = no maximum
        bool exists;
    }

    struct StakeRecord {
        uint256 amount;
        uint256 stakedAt;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;
    mapping(bytes32 => mapping(bytes32 => StakeRecord)) private _stakes;

    // --- Events ---

    event StakeConfigured(bytes32 indexed configId, uint256 minStake, uint256 maxStake);
    event Staked(bytes32 indexed configId, bytes32 indexed account, uint256 amount, uint256 totalStake);
    event Unstaked(bytes32 indexed configId, bytes32 indexed account, uint256 amount, uint256 remaining);

    // --- Functions ---

    /// @notice Configure a stake-based weight source
    /// @param configId Unique configuration identifier
    /// @param minStake Minimum stake to receive any weight
    /// @param maxStake Maximum stake counted toward weight (0 = unlimited)
    function configure(bytes32 configId, uint256 minStake, uint256 maxStake) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(maxStake == 0 || maxStake >= minStake, "Max must be >= min");

        _configs[configId] = Config({
            minStake: minStake,
            maxStake: maxStake,
            exists: true
        });

        emit StakeConfigured(configId, minStake, maxStake);
    }

    /// @notice Stake tokens to gain voting weight
    /// @param configId The weight configuration
    /// @param account The staker's account identifier
    /// @param amount Amount to stake
    function stake(bytes32 configId, bytes32 account, uint256 amount) external {
        require(_configs[configId].exists, "Config not found");
        require(account != bytes32(0), "Account cannot be zero");
        require(amount > 0, "Amount must be positive");

        StakeRecord storage record = _stakes[configId][account];
        uint256 newTotal = record.amount + amount;

        if (!record.exists) {
            _stakes[configId][account] = StakeRecord({
                amount: newTotal,
                stakedAt: block.timestamp,
                exists: true
            });
        } else {
            record.amount = newTotal;
        }

        emit Staked(configId, account, amount, newTotal);
    }

    /// @notice Unstake tokens
    /// @param configId The weight configuration
    /// @param account The staker's account identifier
    /// @param amount Amount to unstake
    function unstake(bytes32 configId, bytes32 account, uint256 amount) external {
        require(_configs[configId].exists, "Config not found");
        StakeRecord storage record = _stakes[configId][account];
        require(record.exists, "No stake found");
        require(record.amount >= amount, "Insufficient stake");

        record.amount -= amount;

        emit Unstaked(configId, account, amount, record.amount);
    }

    /// @notice Get the voting weight for an account based on its stake
    /// @param configId The weight configuration
    /// @param account The account identifier
    /// @return weight The effective voting weight
    function getWeight(bytes32 configId, bytes32 account) external view returns (uint256 weight) {
        require(_configs[configId].exists, "Config not found");
        StakeRecord storage record = _stakes[configId][account];
        if (!record.exists) return 0;

        Config storage cfg = _configs[configId];
        uint256 staked = record.amount;

        if (staked < cfg.minStake) return 0;
        if (cfg.maxStake > 0 && staked > cfg.maxStake) {
            return cfg.maxStake;
        }
        return staked;
    }
}

contract EqualWeight {
    // --- Types ---

    struct Config {
        uint256 fixedWeight;    // the equal weight assigned to every eligible participant
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> account -> eligible
    mapping(bytes32 => mapping(bytes32 => bool)) private _eligible;

    // --- Events ---

    event EqualWeightConfigured(bytes32 indexed configId, uint256 fixedWeight);
    event EligibilitySet(bytes32 indexed configId, bytes32 indexed account, bool eligible);

    // --- Functions ---

    /// @notice Configure an equal weight source
    /// @param configId Unique configuration identifier
    /// @param fixedWeight The fixed weight every eligible participant receives
    function configure(bytes32 configId, uint256 fixedWeight) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(fixedWeight > 0, "Weight must be positive");

        _configs[configId] = Config({
            fixedWeight: fixedWeight,
            exists: true
        });

        emit EqualWeightConfigured(configId, fixedWeight);
    }

    /// @notice Set eligibility for an account
    /// @param configId The weight configuration
    /// @param account The account identifier
    /// @param eligible Whether the account is eligible
    function setEligibility(bytes32 configId, bytes32 account, bool eligible) external {
        require(_configs[configId].exists, "Config not found");
        require(account != bytes32(0), "Account cannot be zero");

        _eligible[configId][account] = eligible;

        emit EligibilitySet(configId, account, eligible);
    }

    /// @notice Get the voting weight for an account (equal for all eligible)
    /// @param configId The weight configuration
    /// @param account The account identifier
    /// @return weight The voting weight (fixedWeight if eligible, 0 otherwise)
    function getWeight(bytes32 configId, bytes32 account) external view returns (uint256 weight) {
        require(_configs[configId].exists, "Config not found");
        if (_eligible[configId][account]) {
            return _configs[configId].fixedWeight;
        }
        return 0;
    }
}

contract VoteEscrowWeight {
    // --- Types ---

    struct Config {
        uint256 maxLockDuration;    // maximum lock period in seconds
        bool exists;
    }

    struct LockRecord {
        uint256 amount;
        uint256 lockStart;
        uint256 lockEnd;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> account -> LockRecord
    mapping(bytes32 => mapping(bytes32 => LockRecord)) private _locks;

    // --- Events ---

    event VoteEscrowConfigured(bytes32 indexed configId, uint256 maxLockDuration);
    event TokensLocked(bytes32 indexed configId, bytes32 indexed account, uint256 amount, uint256 lockEnd);
    event LockExtended(bytes32 indexed configId, bytes32 indexed account, uint256 newLockEnd);

    // --- Functions ---

    /// @notice Configure a vote-escrow weight source (ve-token model)
    /// @param configId Unique configuration identifier
    /// @param maxLockDuration Maximum lock duration in seconds
    function configure(bytes32 configId, uint256 maxLockDuration) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(maxLockDuration > 0, "Max lock must be positive");

        _configs[configId] = Config({
            maxLockDuration: maxLockDuration,
            exists: true
        });

        emit VoteEscrowConfigured(configId, maxLockDuration);
    }

    /// @notice Lock tokens for a duration to gain voting weight
    /// @param configId The weight configuration
    /// @param account The account identifier
    /// @param amount Amount of tokens to lock
    /// @param duration Lock duration in seconds (must be <= maxLockDuration)
    function lock(bytes32 configId, bytes32 account, uint256 amount, uint256 duration) external {
        require(_configs[configId].exists, "Config not found");
        require(account != bytes32(0), "Account cannot be zero");
        require(amount > 0, "Amount must be positive");
        require(duration > 0, "Duration must be positive");
        require(duration <= _configs[configId].maxLockDuration, "Duration exceeds max lock");
        require(!_locks[configId][account].exists, "Lock already exists");

        uint256 lockEnd = block.timestamp + duration;
        _locks[configId][account] = LockRecord({
            amount: amount,
            lockStart: block.timestamp,
            lockEnd: lockEnd,
            exists: true
        });

        emit TokensLocked(configId, account, amount, lockEnd);
    }

    /// @notice Extend the lock duration for additional weight
    /// @param configId The weight configuration
    /// @param account The account identifier
    /// @param newDuration New total duration from now (must be > remaining and <= maxLockDuration)
    function extendLock(bytes32 configId, bytes32 account, uint256 newDuration) external {
        require(_configs[configId].exists, "Config not found");
        LockRecord storage rec = _locks[configId][account];
        require(rec.exists, "Lock not found");
        require(block.timestamp < rec.lockEnd, "Lock already expired");

        uint256 newLockEnd = block.timestamp + newDuration;
        require(newLockEnd > rec.lockEnd, "New end must be later than current end");
        require(newDuration <= _configs[configId].maxLockDuration, "Duration exceeds max lock");

        rec.lockEnd = newLockEnd;

        emit LockExtended(configId, account, newLockEnd);
    }

    /// @notice Get the voting weight: amount * timeRemaining / maxLockDuration
    /// @param configId The weight configuration
    /// @param account The account identifier
    /// @return weight The ve-token voting weight
    function getWeight(bytes32 configId, bytes32 account) external view returns (uint256 weight) {
        require(_configs[configId].exists, "Config not found");
        LockRecord storage rec = _locks[configId][account];
        if (!rec.exists) return 0;

        if (block.timestamp >= rec.lockEnd) return 0;

        uint256 timeRemaining = rec.lockEnd - block.timestamp;
        uint256 maxLock = _configs[configId].maxLockDuration;

        // weight = amount * timeRemaining / maxLockDuration
        weight = (rec.amount * timeRemaining) / maxLock;
        return weight;
    }
}

contract QuadraticWeight {
    // --- Types ---

    struct Config {
        uint256 scale;  // scaling factor in WAD (1e18 = 1.0x)
        uint256 cap;    // maximum weight (0 = no cap)
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;
    mapping(bytes32 => mapping(bytes32 => uint256)) private _rawValues;

    // --- Events ---

    event QuadraticConfigured(bytes32 indexed configId, uint256 scale, uint256 cap);
    event QuadraticComputed(bytes32 indexed configId, bytes32 indexed account, uint256 rawValue, uint256 weight);

    // --- Constants ---

    uint256 private constant WAD = 1e18;

    // --- Functions ---

    /// @notice Configure a quadratic weight source (sqrt scaling)
    /// @param configId Unique configuration identifier
    /// @param scale Scaling factor in WAD (1e18 = 1.0x)
    /// @param cap Maximum weight output (0 for no cap)
    function configure(bytes32 configId, uint256 scale, uint256 cap) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(scale > 0, "Scale must be positive");

        _configs[configId] = Config({
            scale: scale,
            cap: cap,
            exists: true
        });

        emit QuadraticConfigured(configId, scale, cap);
    }

    /// @notice Compute quadratic weight: sqrt(rawValue) * scale
    /// @param configId The weight configuration
    /// @param account The account identifier
    /// @param rawValue The raw input value (e.g., token balance)
    /// @return weight The sqrt-scaled voting weight
    function compute(bytes32 configId, bytes32 account, uint256 rawValue) external returns (uint256 weight) {
        require(_configs[configId].exists, "Config not found");
        require(account != bytes32(0), "Account cannot be zero");

        _rawValues[configId][account] = rawValue;
        Config storage cfg = _configs[configId];

        // Integer square root via Newton's method
        uint256 sqrtVal = _sqrt(rawValue);

        // weight = sqrt(rawValue) * scale / WAD
        weight = (sqrtVal * cfg.scale) / WAD;

        if (cfg.cap > 0 && weight > cfg.cap) {
            weight = cfg.cap;
        }

        emit QuadraticComputed(configId, account, rawValue, weight);
        return weight;
    }

    /// @dev Integer square root via Newton's method (Babylonian method)
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
