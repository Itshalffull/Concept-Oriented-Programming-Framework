// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GovernanceRules
/// @notice Policy evaluation, compliance monitoring, graduated sanctions, and dispute resolution
/// @dev Implements the Policy, Monitor, Sanction, and Dispute concepts from Clef specification.
///      Policy provides rule evaluation stubs. Monitor tracks compliance checks.
///      Sanction applies graduated severity from Warning through Expulsion.
///      Dispute manages a resolution lifecycle (Filed -> UnderReview -> Resolved/Dismissed).

contract GovernanceRules {
    // --- Types ---

    enum PolicyStatus { Active, Suspended, Retired }

    struct Policy {
        string name;
        string ruleExpression;       // encoded policy rule (off-chain or DSL reference)
        PolicyStatus status;
        uint256 createdAt;
        bool exists;
    }

    struct ComplianceCheck {
        bytes32 policyId;
        bytes32 subjectId;           // entity being checked
        bool compliant;
        string details;
        uint256 checkedAt;
    }

    enum SanctionSeverity { Warning, Suspension, Fine, Expulsion }

    struct Sanction {
        bytes32 subjectId;
        bytes32 policyId;
        SanctionSeverity severity;
        string reason;
        uint256 issuedAt;
        bool appealed;
        bool exists;
    }

    enum DisputeStatus { Filed, UnderReview, Resolved, Dismissed }

    struct Dispute {
        bytes32 claimantId;
        bytes32 respondentId;
        string claim;
        string evidence;
        DisputeStatus status;
        string resolution;
        uint256 filedAt;
        uint256 resolvedAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps policy ID -> Policy
    mapping(bytes32 => Policy) private _policies;

    /// @dev Maps policy ID -> array of compliance checks
    mapping(bytes32 => ComplianceCheck[]) private _complianceHistory;

    /// @dev Maps sanction ID -> Sanction
    mapping(bytes32 => Sanction) private _sanctions;

    /// @dev Maps subject ID -> array of sanction IDs for graduated lookup
    mapping(bytes32 => bytes32[]) private _subjectSanctions;

    /// @dev Maps dispute ID -> Dispute
    mapping(bytes32 => Dispute) private _disputes;

    // --- Events ---

    event PolicyCreated(bytes32 indexed policyId, string name);
    event PolicySuspended(bytes32 indexed policyId);
    event PolicyRetired(bytes32 indexed policyId);

    event ComplianceChecked(bytes32 indexed policyId, bytes32 indexed subjectId, bool compliant);

    event SanctionIssued(bytes32 indexed sanctionId, bytes32 indexed subjectId, SanctionSeverity severity);
    event SanctionAppealed(bytes32 indexed sanctionId);

    event DisputeFiled(bytes32 indexed disputeId, bytes32 indexed claimantId, bytes32 indexed respondentId);
    event DisputeUnderReview(bytes32 indexed disputeId);
    event DisputeResolved(bytes32 indexed disputeId, string resolution);
    event DisputeDismissed(bytes32 indexed disputeId);

    // --- Policy Actions ---

    /// @notice Create a governance policy
    /// @param policyId Unique identifier
    /// @param name Human-readable policy name
    /// @param ruleExpression Encoded rule expression (DSL reference or hash)
    function createPolicy(bytes32 policyId, string calldata name, string calldata ruleExpression) external {
        require(policyId != bytes32(0), "Policy ID cannot be zero");
        require(!_policies[policyId].exists, "Policy already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _policies[policyId] = Policy({
            name: name,
            ruleExpression: ruleExpression,
            status: PolicyStatus.Active,
            createdAt: block.timestamp,
            exists: true
        });

        emit PolicyCreated(policyId, name);
    }

    /// @notice Suspend a policy
    /// @param policyId The policy to suspend
    function suspendPolicy(bytes32 policyId) external {
        require(_policies[policyId].exists, "Policy not found");
        require(_policies[policyId].status == PolicyStatus.Active, "Policy not active");

        _policies[policyId].status = PolicyStatus.Suspended;

        emit PolicySuspended(policyId);
    }

    /// @notice Retire a policy permanently
    /// @param policyId The policy to retire
    function retirePolicy(bytes32 policyId) external {
        require(_policies[policyId].exists, "Policy not found");
        require(_policies[policyId].status != PolicyStatus.Retired, "Already retired");

        _policies[policyId].status = PolicyStatus.Retired;

        emit PolicyRetired(policyId);
    }

    /// @notice Evaluate a policy against a subject (compliance check)
    /// @param policyId The policy to evaluate
    /// @param subjectId The entity being checked
    /// @param compliant Whether the subject is compliant
    /// @param details Human-readable details of the check
    function evaluatePolicy(
        bytes32 policyId,
        bytes32 subjectId,
        bool compliant,
        string calldata details
    ) external {
        require(_policies[policyId].exists, "Policy not found");
        require(_policies[policyId].status == PolicyStatus.Active, "Policy not active");
        require(subjectId != bytes32(0), "Subject ID cannot be zero");

        _complianceHistory[policyId].push(ComplianceCheck({
            policyId: policyId,
            subjectId: subjectId,
            compliant: compliant,
            details: details,
            checkedAt: block.timestamp
        }));

        // TODO: implement automated rule evaluation engine

        emit ComplianceChecked(policyId, subjectId, compliant);
    }

    // --- Sanction Actions ---

    /// @notice Issue a sanction with graduated severity
    /// @param sanctionId Unique identifier
    /// @param subjectId The sanctioned member
    /// @param policyId The violated policy
    /// @param severity The sanction severity level
    /// @param reason Human-readable reason
    function issueSanction(
        bytes32 sanctionId,
        bytes32 subjectId,
        bytes32 policyId,
        SanctionSeverity severity,
        string calldata reason
    ) external {
        require(sanctionId != bytes32(0), "Sanction ID cannot be zero");
        require(!_sanctions[sanctionId].exists, "Sanction already exists");
        require(subjectId != bytes32(0), "Subject ID cannot be zero");
        require(bytes(reason).length > 0, "Reason cannot be empty");

        _sanctions[sanctionId] = Sanction({
            subjectId: subjectId,
            policyId: policyId,
            severity: severity,
            reason: reason,
            issuedAt: block.timestamp,
            appealed: false,
            exists: true
        });

        _subjectSanctions[subjectId].push(sanctionId);

        emit SanctionIssued(sanctionId, subjectId, severity);
    }

    /// @notice Appeal a sanction
    /// @param sanctionId The sanction to appeal
    function appealSanction(bytes32 sanctionId) external {
        require(_sanctions[sanctionId].exists, "Sanction not found");
        require(!_sanctions[sanctionId].appealed, "Already appealed");

        _sanctions[sanctionId].appealed = true;

        emit SanctionAppealed(sanctionId);
    }

    // --- Dispute Actions ---

    /// @notice File a dispute
    /// @param disputeId Unique identifier
    /// @param claimantId The member filing the dispute
    /// @param respondentId The member being disputed
    /// @param claim Description of the claim
    /// @param evidence Supporting evidence reference
    function fileDispute(
        bytes32 disputeId,
        bytes32 claimantId,
        bytes32 respondentId,
        string calldata claim,
        string calldata evidence
    ) external {
        require(disputeId != bytes32(0), "Dispute ID cannot be zero");
        require(!_disputes[disputeId].exists, "Dispute already exists");
        require(claimantId != bytes32(0), "Claimant ID cannot be zero");
        require(respondentId != bytes32(0), "Respondent ID cannot be zero");
        require(claimantId != respondentId, "Cannot dispute self");
        require(bytes(claim).length > 0, "Claim cannot be empty");

        _disputes[disputeId] = Dispute({
            claimantId: claimantId,
            respondentId: respondentId,
            claim: claim,
            evidence: evidence,
            status: DisputeStatus.Filed,
            resolution: "",
            filedAt: block.timestamp,
            resolvedAt: 0,
            exists: true
        });

        emit DisputeFiled(disputeId, claimantId, respondentId);
    }

    /// @notice Move a dispute to under-review status
    /// @param disputeId The dispute to review
    function reviewDispute(bytes32 disputeId) external {
        require(_disputes[disputeId].exists, "Dispute not found");
        require(_disputes[disputeId].status == DisputeStatus.Filed, "Dispute not in Filed status");

        _disputes[disputeId].status = DisputeStatus.UnderReview;

        emit DisputeUnderReview(disputeId);
    }

    /// @notice Resolve a dispute with a resolution statement
    /// @param disputeId The dispute to resolve
    /// @param resolution Resolution description
    function resolveDispute(bytes32 disputeId, string calldata resolution) external {
        require(_disputes[disputeId].exists, "Dispute not found");
        DisputeStatus s = _disputes[disputeId].status;
        require(s == DisputeStatus.Filed || s == DisputeStatus.UnderReview, "Dispute not resolvable");
        require(bytes(resolution).length > 0, "Resolution cannot be empty");

        _disputes[disputeId].status = DisputeStatus.Resolved;
        _disputes[disputeId].resolution = resolution;
        _disputes[disputeId].resolvedAt = block.timestamp;

        emit DisputeResolved(disputeId, resolution);
    }

    /// @notice Dismiss a dispute
    /// @param disputeId The dispute to dismiss
    function dismissDispute(bytes32 disputeId) external {
        require(_disputes[disputeId].exists, "Dispute not found");
        DisputeStatus s = _disputes[disputeId].status;
        require(s == DisputeStatus.Filed || s == DisputeStatus.UnderReview, "Dispute not dismissable");

        _disputes[disputeId].status = DisputeStatus.Dismissed;
        _disputes[disputeId].resolvedAt = block.timestamp;

        emit DisputeDismissed(disputeId);
    }

    // --- Views ---

    /// @notice Get a policy
    /// @param policyId The policy ID
    /// @return The Policy struct
    function getPolicy(bytes32 policyId) external view returns (Policy memory) {
        require(_policies[policyId].exists, "Policy not found");
        return _policies[policyId];
    }

    /// @notice Get the number of compliance checks for a policy
    /// @param policyId The policy ID
    /// @return count Number of compliance checks
    function getComplianceCheckCount(bytes32 policyId) external view returns (uint256 count) {
        return _complianceHistory[policyId].length;
    }

    /// @notice Get a sanction
    /// @param sanctionId The sanction ID
    /// @return The Sanction struct
    function getSanction(bytes32 sanctionId) external view returns (Sanction memory) {
        require(_sanctions[sanctionId].exists, "Sanction not found");
        return _sanctions[sanctionId];
    }

    /// @notice Get the number of sanctions for a subject
    /// @param subjectId The subject member ID
    /// @return count Number of sanctions
    function getSanctionCount(bytes32 subjectId) external view returns (uint256 count) {
        return _subjectSanctions[subjectId].length;
    }

    /// @notice Get a dispute
    /// @param disputeId The dispute ID
    /// @return The Dispute struct
    function getDispute(bytes32 disputeId) external view returns (Dispute memory) {
        require(_disputes[disputeId].exists, "Dispute not found");
        return _disputes[disputeId];
    }
}
