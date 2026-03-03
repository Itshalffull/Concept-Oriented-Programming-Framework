// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SybilProviders
/// @notice Sybil resistance provider contracts for governance identity verification
/// @dev Implements ProofOfPersonhood, StakeThresholdSybil, SocialGraphVerification,
///      and AttestationSybilCheck provider concepts from the Clef specification.

contract ProofOfPersonhood {
    // --- Types ---

    enum VerificationStatus { None, Pending, Verified, Rejected }

    struct VerificationRecord {
        VerificationStatus status;
        bytes32 verifierId;         // who confirmed/rejected
        uint256 requestedAt;
        uint256 resolvedAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps account -> VerificationRecord
    mapping(bytes32 => VerificationRecord) private _records;

    /// @dev Total verified persons
    uint256 private _verifiedCount;

    // --- Events ---

    event VerificationRequested(bytes32 indexed account, uint256 requestedAt);
    event VerificationConfirmed(bytes32 indexed account, bytes32 indexed verifierId, uint256 resolvedAt);
    event VerificationRejected(bytes32 indexed account, bytes32 indexed verifierId, uint256 resolvedAt);

    // --- Functions ---

    /// @notice Request proof-of-personhood verification
    /// @param account The account requesting verification
    function requestVerification(bytes32 account) external {
        require(account != bytes32(0), "Account cannot be zero");
        require(
            !_records[account].exists ||
            _records[account].status == VerificationStatus.Rejected,
            "Verification already pending or confirmed"
        );

        _records[account] = VerificationRecord({
            status: VerificationStatus.Pending,
            verifierId: bytes32(0),
            requestedAt: block.timestamp,
            resolvedAt: 0,
            exists: true
        });

        emit VerificationRequested(account, block.timestamp);
    }

    /// @notice Confirm an account's proof-of-personhood
    /// @param account The account to verify
    /// @param verifierId The verifier's identifier
    function confirmVerification(bytes32 account, bytes32 verifierId) external {
        require(_records[account].exists, "No verification request found");
        require(_records[account].status == VerificationStatus.Pending, "Not in pending state");
        require(verifierId != bytes32(0), "Verifier cannot be zero");

        _records[account].status = VerificationStatus.Verified;
        _records[account].verifierId = verifierId;
        _records[account].resolvedAt = block.timestamp;
        _verifiedCount++;

        emit VerificationConfirmed(account, verifierId, block.timestamp);
    }

    /// @notice Reject an account's proof-of-personhood request
    /// @param account The account to reject
    /// @param verifierId The verifier's identifier
    function rejectVerification(bytes32 account, bytes32 verifierId) external {
        require(_records[account].exists, "No verification request found");
        require(_records[account].status == VerificationStatus.Pending, "Not in pending state");
        require(verifierId != bytes32(0), "Verifier cannot be zero");

        _records[account].status = VerificationStatus.Rejected;
        _records[account].verifierId = verifierId;
        _records[account].resolvedAt = block.timestamp;

        emit VerificationRejected(account, verifierId, block.timestamp);
    }

    /// @notice Check an account's verification status
    /// @param account The account to check
    /// @return status The current verification status
    function checkStatus(bytes32 account) external view returns (VerificationStatus status) {
        if (!_records[account].exists) return VerificationStatus.None;
        return _records[account].status;
    }

    /// @notice Get the total number of verified persons
    /// @return count The verified count
    function getVerifiedCount() external view returns (uint256 count) {
        return _verifiedCount;
    }
}

contract StakeThresholdSybil {
    // --- Types ---

    struct Config {
        uint256 requiredStake;      // minimum stake to be considered non-sybil
        uint256 slashPercentBps;    // slash percentage in basis points (e.g., 5000 = 50%)
        bool exists;
    }

    struct DepositRecord {
        uint256 amount;
        uint256 depositedAt;
        bool slashed;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> account -> DepositRecord
    mapping(bytes32 => mapping(bytes32 => DepositRecord)) private _deposits;

    // --- Events ---

    event StakeThresholdConfigured(bytes32 indexed configId, uint256 requiredStake, uint256 slashPercentBps);
    event StakeDeposited(bytes32 indexed configId, bytes32 indexed account, uint256 amount, uint256 totalDeposit);
    event StakeSlashed(bytes32 indexed configId, bytes32 indexed account, uint256 slashedAmount, uint256 remaining);
    event SybilCheckResult(bytes32 indexed configId, bytes32 indexed account, bool passed);

    // --- Functions ---

    /// @notice Configure a stake-threshold sybil resistance provider
    /// @param configId Unique configuration identifier
    /// @param requiredStake Minimum stake to pass the sybil check
    /// @param slashPercentBps Slash percentage in basis points for detected sybils
    function configure(bytes32 configId, uint256 requiredStake, uint256 slashPercentBps) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(requiredStake > 0, "Required stake must be positive");
        require(slashPercentBps <= 10000, "Slash percent cannot exceed 100%");

        _configs[configId] = Config({
            requiredStake: requiredStake,
            slashPercentBps: slashPercentBps,
            exists: true
        });

        emit StakeThresholdConfigured(configId, requiredStake, slashPercentBps);
    }

    /// @notice Deposit stake as sybil resistance collateral
    /// @param configId The sybil resistance configuration
    /// @param account The account depositing
    /// @param amount Amount to deposit
    function deposit(bytes32 configId, bytes32 account, uint256 amount) external {
        require(_configs[configId].exists, "Config not found");
        require(account != bytes32(0), "Account cannot be zero");
        require(amount > 0, "Amount must be positive");

        DepositRecord storage rec = _deposits[configId][account];
        uint256 newTotal = rec.amount + amount;

        if (!rec.exists) {
            _deposits[configId][account] = DepositRecord({
                amount: newTotal,
                depositedAt: block.timestamp,
                slashed: false,
                exists: true
            });
        } else {
            require(!rec.slashed, "Account has been slashed");
            rec.amount = newTotal;
        }

        emit StakeDeposited(configId, account, amount, newTotal);
    }

    /// @notice Check if an account meets the stake threshold
    /// @param configId The sybil resistance configuration
    /// @param account The account to check
    /// @return passed True if the account's deposit meets the required stake
    function check(bytes32 configId, bytes32 account) external returns (bool passed) {
        require(_configs[configId].exists, "Config not found");
        DepositRecord storage rec = _deposits[configId][account];

        passed = rec.exists && !rec.slashed && rec.amount >= _configs[configId].requiredStake;

        emit SybilCheckResult(configId, account, passed);
        return passed;
    }

    /// @notice Slash a detected sybil's stake
    /// @param configId The sybil resistance configuration
    /// @param account The account to slash
    function slash(bytes32 configId, bytes32 account) external {
        require(_configs[configId].exists, "Config not found");
        DepositRecord storage rec = _deposits[configId][account];
        require(rec.exists, "No deposit found");
        require(!rec.slashed, "Already slashed");

        uint256 slashAmount = (rec.amount * _configs[configId].slashPercentBps) / 10000;
        rec.amount -= slashAmount;
        rec.slashed = true;

        emit StakeSlashed(configId, account, slashAmount, rec.amount);
    }
}

contract SocialGraphVerification {
    // --- Types ---

    struct Config {
        uint256 requiredVouches;    // minimum number of vouches needed
        uint256 maxVouchesPerUser;  // maximum vouches a single user can give
        bool exists;
    }

    struct VouchRecord {
        bytes32 voucher;
        uint256 vouchedAt;
        bool active;
        bool exists;
    }

    struct AccountStatus {
        uint256 activeVouches;
        uint256 givenVouches;
        bool verified;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> account -> AccountStatus
    mapping(bytes32 => mapping(bytes32 => AccountStatus)) private _accounts;

    /// @dev Maps configId -> account -> voucher -> VouchRecord
    mapping(bytes32 => mapping(bytes32 => mapping(bytes32 => VouchRecord))) private _vouches;

    // --- Events ---

    event SocialGraphConfigured(bytes32 indexed configId, uint256 requiredVouches, uint256 maxVouchesPerUser);
    event VouchAdded(bytes32 indexed configId, bytes32 indexed voucher, bytes32 indexed vouchee);
    event VouchRevoked(bytes32 indexed configId, bytes32 indexed voucher, bytes32 indexed vouchee);
    event SocialGraphVerified(bytes32 indexed configId, bytes32 indexed account, bool verified);

    // --- Functions ---

    /// @notice Configure a social graph verification provider
    /// @param configId Unique configuration identifier
    /// @param requiredVouches Minimum vouches needed for verification
    /// @param maxVouchesPerUser Maximum vouches a single user can give
    function configure(bytes32 configId, uint256 requiredVouches, uint256 maxVouchesPerUser) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(requiredVouches > 0, "Required vouches must be positive");
        require(maxVouchesPerUser > 0, "Max vouches must be positive");

        _configs[configId] = Config({
            requiredVouches: requiredVouches,
            maxVouchesPerUser: maxVouchesPerUser,
            exists: true
        });

        emit SocialGraphConfigured(configId, requiredVouches, maxVouchesPerUser);
    }

    /// @notice Add a vouch for an account
    /// @param configId The verification configuration
    /// @param voucher The account giving the vouch
    /// @param vouchee The account receiving the vouch
    function addVouch(bytes32 configId, bytes32 voucher, bytes32 vouchee) external {
        require(_configs[configId].exists, "Config not found");
        require(voucher != bytes32(0) && vouchee != bytes32(0), "Accounts cannot be zero");
        require(voucher != vouchee, "Cannot vouch for self");
        require(!_vouches[configId][vouchee][voucher].active, "Already vouched");

        AccountStatus storage voucherStatus = _accounts[configId][voucher];
        if (!voucherStatus.exists) {
            _accounts[configId][voucher] = AccountStatus({
                activeVouches: 0,
                givenVouches: 0,
                verified: false,
                exists: true
            });
            voucherStatus = _accounts[configId][voucher];
        }

        require(
            voucherStatus.givenVouches < _configs[configId].maxVouchesPerUser,
            "Voucher at max vouch limit"
        );

        AccountStatus storage voucheeStatus = _accounts[configId][vouchee];
        if (!voucheeStatus.exists) {
            _accounts[configId][vouchee] = AccountStatus({
                activeVouches: 0,
                givenVouches: 0,
                verified: false,
                exists: true
            });
            voucheeStatus = _accounts[configId][vouchee];
        }

        _vouches[configId][vouchee][voucher] = VouchRecord({
            voucher: voucher,
            vouchedAt: block.timestamp,
            active: true,
            exists: true
        });

        voucherStatus.givenVouches++;
        voucheeStatus.activeVouches++;

        emit VouchAdded(configId, voucher, vouchee);
    }

    /// @notice Revoke a vouch
    /// @param configId The verification configuration
    /// @param voucher The account revoking the vouch
    /// @param vouchee The account losing the vouch
    function revokeVouch(bytes32 configId, bytes32 voucher, bytes32 vouchee) external {
        require(_configs[configId].exists, "Config not found");
        VouchRecord storage rec = _vouches[configId][vouchee][voucher];
        require(rec.exists && rec.active, "Active vouch not found");

        rec.active = false;
        _accounts[configId][voucher].givenVouches--;
        _accounts[configId][vouchee].activeVouches--;

        // Revoke verification if vouches drop below threshold
        if (_accounts[configId][vouchee].verified &&
            _accounts[configId][vouchee].activeVouches < _configs[configId].requiredVouches) {
            _accounts[configId][vouchee].verified = false;
        }

        emit VouchRevoked(configId, voucher, vouchee);
    }

    /// @notice Verify an account based on its vouch count
    /// @param configId The verification configuration
    /// @param account The account to verify
    /// @return verified True if the account has enough vouches
    function verify(bytes32 configId, bytes32 account) external returns (bool verified) {
        require(_configs[configId].exists, "Config not found");
        AccountStatus storage status = _accounts[configId][account];
        require(status.exists, "Account not found");

        verified = status.activeVouches >= _configs[configId].requiredVouches;
        status.verified = verified;

        emit SocialGraphVerified(configId, account, verified);
        return verified;
    }
}

contract AttestationSybilCheck {
    // --- Types ---

    struct Config {
        uint256 requiredAttestations;   // minimum attestations needed
        uint256 attestationTtl;         // time-to-live for attestations in seconds (0 = no expiry)
        bool exists;
    }

    struct Attestation {
        bytes32 attestor;
        bytes32 attestationType;    // e.g., "identity", "kyc", "biometric"
        uint256 issuedAt;
        uint256 expiresAt;          // 0 = no expiry
        bool revoked;
        bool exists;
    }

    struct AccountAttestations {
        uint256 attestationCount;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => Config) private _configs;

    /// @dev Maps configId -> account -> AccountAttestations
    mapping(bytes32 => mapping(bytes32 => AccountAttestations)) private _accountAttestations;

    /// @dev Maps configId -> account -> attestationIndex -> Attestation
    mapping(bytes32 => mapping(bytes32 => mapping(uint256 => Attestation))) private _attestations;

    // --- Events ---

    event AttestationConfigured(bytes32 indexed configId, uint256 requiredAttestations, uint256 attestationTtl);
    event AttestationSubmitted(
        bytes32 indexed configId,
        bytes32 indexed account,
        bytes32 indexed attestor,
        bytes32 attestationType,
        uint256 attestationIndex
    );
    event AttestationVerified(bytes32 indexed configId, bytes32 indexed account, bool passed, uint256 validCount);

    // --- Functions ---

    /// @notice Configure an attestation-based sybil check
    /// @param configId Unique configuration identifier
    /// @param requiredAttestations Minimum attestations needed to pass
    /// @param attestationTtl Time-to-live for attestations in seconds (0 = no expiry)
    function configure(bytes32 configId, uint256 requiredAttestations, uint256 attestationTtl) external {
        require(configId != bytes32(0), "Config ID cannot be zero");
        require(!_configs[configId].exists, "Config already exists");
        require(requiredAttestations > 0, "Required attestations must be positive");

        _configs[configId] = Config({
            requiredAttestations: requiredAttestations,
            attestationTtl: attestationTtl,
            exists: true
        });

        emit AttestationConfigured(configId, requiredAttestations, attestationTtl);
    }

    /// @notice Submit an attestation for an account
    /// @param configId The sybil check configuration
    /// @param account The account being attested
    /// @param attestor The entity providing the attestation
    /// @param attestationType The type of attestation (e.g., "kyc", "biometric")
    function submitAttestation(
        bytes32 configId,
        bytes32 account,
        bytes32 attestor,
        bytes32 attestationType
    ) external {
        require(_configs[configId].exists, "Config not found");
        require(account != bytes32(0), "Account cannot be zero");
        require(attestor != bytes32(0), "Attestor cannot be zero");

        AccountAttestations storage acctAttest = _accountAttestations[configId][account];
        if (!acctAttest.exists) {
            _accountAttestations[configId][account] = AccountAttestations({
                attestationCount: 0,
                exists: true
            });
            acctAttest = _accountAttestations[configId][account];
        }

        uint256 idx = acctAttest.attestationCount;
        uint256 ttl = _configs[configId].attestationTtl;
        uint256 expiresAt = ttl > 0 ? block.timestamp + ttl : 0;

        _attestations[configId][account][idx] = Attestation({
            attestor: attestor,
            attestationType: attestationType,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            revoked: false,
            exists: true
        });

        acctAttest.attestationCount++;

        emit AttestationSubmitted(configId, account, attestor, attestationType, idx);
    }

    /// @notice Verify an account's attestations against the threshold
    /// @param configId The sybil check configuration
    /// @param account The account to verify
    /// @return passed True if the account has enough valid (non-expired, non-revoked) attestations
    function verify(bytes32 configId, bytes32 account) external returns (bool passed) {
        require(_configs[configId].exists, "Config not found");
        AccountAttestations storage acctAttest = _accountAttestations[configId][account];
        if (!acctAttest.exists) {
            emit AttestationVerified(configId, account, false, 0);
            return false;
        }

        uint256 validCount = 0;
        for (uint256 i = 0; i < acctAttest.attestationCount; i++) {
            Attestation storage att = _attestations[configId][account][i];
            if (!att.revoked) {
                if (att.expiresAt == 0 || block.timestamp <= att.expiresAt) {
                    validCount++;
                }
            }
        }

        passed = validCount >= _configs[configId].requiredAttestations;

        emit AttestationVerified(configId, account, passed, validCount);
        return passed;
    }
}
