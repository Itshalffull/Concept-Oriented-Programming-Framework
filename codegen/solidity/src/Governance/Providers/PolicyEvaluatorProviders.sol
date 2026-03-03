// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PolicyEvaluatorProviders
/// @notice Policy evaluator contracts for governance rule evaluation
/// @dev Implements CustomEvaluator, AdicoEvaluator, CedarEvaluator, and RegoEvaluator
///      provider concepts from the Clef specification.
///      On-chain policy evaluation stores policy definitions and evaluation results.
///      Complex parsing (ADICO, Cedar, Rego) is represented as structured data that
///      can be evaluated against on-chain state.

contract CustomEvaluator {
    // --- Types ---

    enum EvalResult { Undecided, Permit, Deny }

    struct Evaluator {
        bytes32 owner;
        bytes32 policyHash;     // hash of the policy logic (off-chain reference)
        string description;
        bool active;
        bool exists;
    }

    struct EvaluationRecord {
        bytes32 evaluatorId;
        bytes32 subjectId;
        bytes32 resourceId;
        EvalResult result;
        uint256 evaluatedAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps evaluatorId -> Evaluator
    mapping(bytes32 => Evaluator) private _evaluators;

    /// @dev Maps evaluationId -> EvaluationRecord
    mapping(bytes32 => EvaluationRecord) private _evaluations;

    /// @dev Evaluation counter for generating unique IDs
    uint256 private _evaluationNonce;

    // --- Events ---

    event EvaluatorRegistered(bytes32 indexed evaluatorId, bytes32 indexed owner, bytes32 policyHash);
    event EvaluatorDeregistered(bytes32 indexed evaluatorId);
    event PolicyEvaluated(
        bytes32 indexed evaluationId,
        bytes32 indexed evaluatorId,
        bytes32 indexed subjectId,
        bytes32 resourceId,
        uint8 result
    );

    // --- Functions ---

    /// @notice Register a custom policy evaluator
    /// @param evaluatorId Unique evaluator identifier
    /// @param owner The owner/registrant of this evaluator
    /// @param policyHash Hash of the policy logic (stored off-chain)
    /// @param description Human-readable description of the policy
    function register(
        bytes32 evaluatorId,
        bytes32 owner,
        bytes32 policyHash,
        string calldata description
    ) external {
        require(evaluatorId != bytes32(0), "Evaluator ID cannot be zero");
        require(!_evaluators[evaluatorId].exists, "Evaluator already exists");
        require(owner != bytes32(0), "Owner cannot be zero");
        require(policyHash != bytes32(0), "Policy hash cannot be zero");

        _evaluators[evaluatorId] = Evaluator({
            owner: owner,
            policyHash: policyHash,
            description: description,
            active: true,
            exists: true
        });

        emit EvaluatorRegistered(evaluatorId, owner, policyHash);
    }

    /// @notice Evaluate a policy against a subject and resource
    /// @param evaluatorId The evaluator to use
    /// @param subjectId The subject (actor) being evaluated
    /// @param resourceId The resource being accessed
    /// @param result The evaluation result (0=Undecided, 1=Permit, 2=Deny)
    /// @return evaluationId Unique identifier for this evaluation record
    function evaluate(
        bytes32 evaluatorId,
        bytes32 subjectId,
        bytes32 resourceId,
        EvalResult result
    ) external returns (bytes32 evaluationId) {
        require(_evaluators[evaluatorId].exists, "Evaluator not found");
        require(_evaluators[evaluatorId].active, "Evaluator not active");
        require(subjectId != bytes32(0), "Subject cannot be zero");

        _evaluationNonce++;
        evaluationId = keccak256(abi.encodePacked(evaluatorId, _evaluationNonce));

        _evaluations[evaluationId] = EvaluationRecord({
            evaluatorId: evaluatorId,
            subjectId: subjectId,
            resourceId: resourceId,
            result: result,
            evaluatedAt: block.timestamp,
            exists: true
        });

        emit PolicyEvaluated(evaluationId, evaluatorId, subjectId, resourceId, uint8(result));
        return evaluationId;
    }

    /// @notice Deregister (deactivate) a custom evaluator
    /// @param evaluatorId The evaluator to deregister
    function deregister(bytes32 evaluatorId) external {
        require(_evaluators[evaluatorId].exists, "Evaluator not found");
        require(_evaluators[evaluatorId].active, "Evaluator already inactive");

        _evaluators[evaluatorId].active = false;

        emit EvaluatorDeregistered(evaluatorId);
    }

    /// @notice Get an evaluation record
    /// @param evaluationId The evaluation to query
    /// @return The evaluation record
    function getEvaluation(bytes32 evaluationId) external view returns (EvaluationRecord memory) {
        require(_evaluations[evaluationId].exists, "Evaluation not found");
        return _evaluations[evaluationId];
    }
}

contract AdicoEvaluator {
    // --- Types ---

    /// @dev ADICO institutional grammar components:
    ///      A = Attributes (who), D = Deontic (must/may/must-not),
    ///      I = aIm (action), C = Conditions (when), O = Or-else (sanction)
    enum Deontic { Must, May, MustNot }

    struct AdicoRule {
        bytes32 attributes;     // who the rule applies to (role/group hash)
        Deontic deontic;        // obligation type
        bytes32 aim;            // action identifier
        bytes32 conditions;     // condition hash (evaluated off-chain)
        bytes32 orElse;         // sanction/consequence identifier
        bool active;
        bool exists;
    }

    enum AdicoResult { Permitted, Obligated, Forbidden, NoMatch }

    // --- Storage ---

    /// @dev Maps ruleId -> AdicoRule
    mapping(bytes32 => AdicoRule) private _rules;

    /// @dev Maps ruleId list for iteration (bounded)
    bytes32[] private _ruleIds;

    // --- Events ---

    event AdicoRuleParsed(bytes32 indexed ruleId, bytes32 attributes, uint8 deontic, bytes32 aim);
    event AdicoEvaluated(bytes32 indexed ruleId, bytes32 indexed subjectId, bytes32 indexed aim, uint8 result);

    // --- Functions ---

    /// @notice Parse and store an ADICO institutional grammar rule
    /// @param ruleId Unique rule identifier
    /// @param attributes Who the rule applies to (role/group hash)
    /// @param deontic Obligation type: 0=Must, 1=May, 2=MustNot
    /// @param aim The action this rule governs
    /// @param conditions Conditions hash (complex conditions evaluated off-chain)
    /// @param orElse Sanction identifier if rule is violated
    function parse(
        bytes32 ruleId,
        bytes32 attributes,
        Deontic deontic,
        bytes32 aim,
        bytes32 conditions,
        bytes32 orElse
    ) external {
        require(ruleId != bytes32(0), "Rule ID cannot be zero");
        require(!_rules[ruleId].exists, "Rule already exists");
        require(attributes != bytes32(0), "Attributes cannot be zero");
        require(aim != bytes32(0), "Aim cannot be zero");

        _rules[ruleId] = AdicoRule({
            attributes: attributes,
            deontic: deontic,
            aim: aim,
            conditions: conditions,
            orElse: orElse,
            active: true,
            exists: true
        });

        _ruleIds.push(ruleId);

        emit AdicoRuleParsed(ruleId, attributes, uint8(deontic), aim);
    }

    /// @notice Evaluate whether a subject can perform an action under ADICO rules
    /// @param ruleId The specific rule to evaluate against
    /// @param subjectId The subject attempting the action
    /// @param aim The action being attempted
    /// @param conditionsMet Whether the rule's conditions are met (evaluated off-chain)
    /// @return result The ADICO evaluation result
    function evaluate(
        bytes32 ruleId,
        bytes32 subjectId,
        bytes32 aim,
        bool conditionsMet
    ) external returns (AdicoResult result) {
        require(_rules[ruleId].exists, "Rule not found");
        require(_rules[ruleId].active, "Rule not active");
        require(subjectId != bytes32(0), "Subject cannot be zero");

        AdicoRule storage rule = _rules[ruleId];

        // If the aim doesn't match, no match
        if (rule.aim != aim) {
            emit AdicoEvaluated(ruleId, subjectId, aim, uint8(AdicoResult.NoMatch));
            return AdicoResult.NoMatch;
        }

        // If conditions are not met, rule does not apply
        if (!conditionsMet) {
            emit AdicoEvaluated(ruleId, subjectId, aim, uint8(AdicoResult.NoMatch));
            return AdicoResult.NoMatch;
        }

        // Apply deontic logic
        if (rule.deontic == Deontic.Must) {
            result = AdicoResult.Obligated;
        } else if (rule.deontic == Deontic.May) {
            result = AdicoResult.Permitted;
        } else {
            result = AdicoResult.Forbidden;
        }

        emit AdicoEvaluated(ruleId, subjectId, aim, uint8(result));
        return result;
    }

    /// @notice Get an ADICO rule
    /// @param ruleId The rule to query
    /// @return The ADICO rule
    function getRule(bytes32 ruleId) external view returns (AdicoRule memory) {
        require(_rules[ruleId].exists, "Rule not found");
        return _rules[ruleId];
    }
}

contract CedarEvaluator {
    // --- Types ---

    enum Effect { Permit, Forbid }

    struct CedarPolicy {
        bytes32 principalType;  // principal entity type hash
        bytes32 actionType;     // action type hash
        bytes32 resourceType;   // resource type hash
        Effect effect;
        bytes32 conditionHash;  // hash of Cedar condition expression (evaluated off-chain)
        bool active;
        bool exists;
    }

    enum AuthzDecision { Allow, Deny, NotApplicable }

    struct AuthzRecord {
        bytes32 principal;
        bytes32 action;
        bytes32 resource;
        AuthzDecision decision;
        bytes32[] matchedPolicies;
        uint256 decidedAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps policyId -> CedarPolicy
    mapping(bytes32 => CedarPolicy) private _policies;

    /// @dev Policy IDs for iteration
    bytes32[] private _policyIds;

    /// @dev Maps authzId -> AuthzRecord
    mapping(bytes32 => AuthzRecord) private _authzRecords;

    /// @dev Authorization nonce
    uint256 private _authzNonce;

    // --- Events ---

    event CedarPoliciesLoaded(bytes32 indexed policyId, uint8 effect, bytes32 principalType, bytes32 actionType, bytes32 resourceType);
    event CedarAuthorized(bytes32 indexed authzId, bytes32 indexed principal, bytes32 indexed action, bytes32 resource, uint8 decision);
    event CedarPolicyVerified(bytes32 indexed policyId, bool valid);

    // --- Functions ---

    /// @notice Load a Cedar-style policy
    /// @param policyId Unique policy identifier
    /// @param principalType Hash of the principal entity type
    /// @param actionType Hash of the action type
    /// @param resourceType Hash of the resource type
    /// @param effect The policy effect: 0=Permit, 1=Forbid
    /// @param conditionHash Hash of the Cedar condition expression
    function loadPolicies(
        bytes32 policyId,
        bytes32 principalType,
        bytes32 actionType,
        bytes32 resourceType,
        Effect effect,
        bytes32 conditionHash
    ) external {
        require(policyId != bytes32(0), "Policy ID cannot be zero");
        require(!_policies[policyId].exists, "Policy already exists");

        _policies[policyId] = CedarPolicy({
            principalType: principalType,
            actionType: actionType,
            resourceType: resourceType,
            effect: effect,
            conditionHash: conditionHash,
            active: true,
            exists: true
        });

        _policyIds.push(policyId);

        emit CedarPoliciesLoaded(policyId, uint8(effect), principalType, actionType, resourceType);
    }

    /// @notice Authorize a request against loaded Cedar policies
    /// @dev Follows Cedar semantics: explicit Forbid overrides Permit, no match = Deny
    /// @param principal The requesting principal hash
    /// @param action The action being requested
    /// @param resource The target resource
    /// @param matchedPolicyIds Policy IDs that match this request (pre-filtered off-chain)
    /// @param conditionsMetFlags Per-policy boolean: whether each policy's condition is met
    /// @return decision The authorization decision
    function authorize(
        bytes32 principal,
        bytes32 action,
        bytes32 resource,
        bytes32[] calldata matchedPolicyIds,
        bool[] calldata conditionsMetFlags
    ) external returns (AuthzDecision decision) {
        require(principal != bytes32(0), "Principal cannot be zero");
        require(matchedPolicyIds.length == conditionsMetFlags.length, "Array length mismatch");

        bool hasPermit = false;
        bool hasForbid = false;

        for (uint256 i = 0; i < matchedPolicyIds.length; i++) {
            CedarPolicy storage pol = _policies[matchedPolicyIds[i]];
            if (!pol.exists || !pol.active) continue;
            if (!conditionsMetFlags[i]) continue;

            if (pol.effect == Effect.Forbid) {
                hasForbid = true;
                break; // Forbid is final in Cedar semantics
            } else {
                hasPermit = true;
            }
        }

        if (hasForbid) {
            decision = AuthzDecision.Deny;
        } else if (hasPermit) {
            decision = AuthzDecision.Allow;
        } else {
            decision = AuthzDecision.Deny; // default deny
        }

        _authzNonce++;
        bytes32 authzId = keccak256(abi.encodePacked(principal, action, _authzNonce));

        // Store record (without dynamic array in storage -- store matched count only)
        _authzRecords[authzId] = AuthzRecord({
            principal: principal,
            action: action,
            resource: resource,
            decision: decision,
            matchedPolicies: matchedPolicyIds,
            decidedAt: block.timestamp,
            exists: true
        });

        emit CedarAuthorized(authzId, principal, action, resource, uint8(decision));
        return decision;
    }

    /// @notice Verify that a policy is well-formed and active
    /// @param policyId The policy to verify
    /// @return valid True if the policy exists and is active
    function verify(bytes32 policyId) external returns (bool valid) {
        valid = _policies[policyId].exists && _policies[policyId].active;
        emit CedarPolicyVerified(policyId, valid);
        return valid;
    }
}

contract RegoEvaluator {
    // --- Types ---

    struct PolicyBundle {
        bytes32 bundleHash;     // hash of the OPA Rego bundle
        uint256 version;
        bytes32 dataHash;       // hash of the external data document
        uint256 loadedAt;
        bool active;
        bool exists;
    }

    enum RegoDecision { Allow, Deny, Error }

    struct RegoEvalRecord {
        bytes32 bundleId;
        bytes32 inputHash;      // hash of the input document
        RegoDecision decision;
        bytes32 resultHash;     // hash of the full result object
        uint256 evaluatedAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps bundleId -> PolicyBundle
    mapping(bytes32 => PolicyBundle) private _bundles;

    /// @dev Maps evalId -> RegoEvalRecord
    mapping(bytes32 => RegoEvalRecord) private _evaluations;

    /// @dev Evaluation nonce
    uint256 private _evalNonce;

    // --- Events ---

    event BundleLoaded(bytes32 indexed bundleId, bytes32 bundleHash, uint256 version);
    event DataUpdated(bytes32 indexed bundleId, bytes32 newDataHash);
    event RegoEvaluated(bytes32 indexed evalId, bytes32 indexed bundleId, bytes32 inputHash, uint8 decision);

    // --- Functions ---

    /// @notice Load an OPA/Rego policy bundle
    /// @param bundleId Unique bundle identifier
    /// @param bundleHash Hash of the Rego policy bundle content
    /// @param version Bundle version number
    function loadBundle(bytes32 bundleId, bytes32 bundleHash, uint256 version) external {
        require(bundleId != bytes32(0), "Bundle ID cannot be zero");
        require(bundleHash != bytes32(0), "Bundle hash cannot be zero");

        if (_bundles[bundleId].exists) {
            // Update existing bundle
            require(version > _bundles[bundleId].version, "Version must increase");
            _bundles[bundleId].bundleHash = bundleHash;
            _bundles[bundleId].version = version;
            _bundles[bundleId].loadedAt = block.timestamp;
        } else {
            _bundles[bundleId] = PolicyBundle({
                bundleHash: bundleHash,
                version: version,
                dataHash: bytes32(0),
                loadedAt: block.timestamp,
                active: true,
                exists: true
            });
        }

        emit BundleLoaded(bundleId, bundleHash, version);
    }

    /// @notice Evaluate an input against a Rego policy bundle
    /// @dev Actual Rego evaluation happens off-chain. This records the result on-chain
    ///      with hashes for verifiability.
    /// @param bundleId The policy bundle to evaluate against
    /// @param inputHash Hash of the input document
    /// @param decision The evaluation decision (computed off-chain)
    /// @param resultHash Hash of the complete result object
    /// @return evalId Unique evaluation record identifier
    function evaluate(
        bytes32 bundleId,
        bytes32 inputHash,
        RegoDecision decision,
        bytes32 resultHash
    ) external returns (bytes32 evalId) {
        require(_bundles[bundleId].exists, "Bundle not found");
        require(_bundles[bundleId].active, "Bundle not active");
        require(inputHash != bytes32(0), "Input hash cannot be zero");

        _evalNonce++;
        evalId = keccak256(abi.encodePacked(bundleId, _evalNonce));

        _evaluations[evalId] = RegoEvalRecord({
            bundleId: bundleId,
            inputHash: inputHash,
            decision: decision,
            resultHash: resultHash,
            evaluatedAt: block.timestamp,
            exists: true
        });

        emit RegoEvaluated(evalId, bundleId, inputHash, uint8(decision));
        return evalId;
    }

    /// @notice Update the external data document for a policy bundle
    /// @param bundleId The bundle to update
    /// @param newDataHash Hash of the new data document
    function updateData(bytes32 bundleId, bytes32 newDataHash) external {
        require(_bundles[bundleId].exists, "Bundle not found");
        require(_bundles[bundleId].active, "Bundle not active");
        require(newDataHash != bytes32(0), "Data hash cannot be zero");

        _bundles[bundleId].dataHash = newDataHash;

        emit DataUpdated(bundleId, newDataHash);
    }

    /// @notice Get a policy bundle
    /// @param bundleId The bundle to query
    /// @return The policy bundle
    function getBundle(bytes32 bundleId) external view returns (PolicyBundle memory) {
        require(_bundles[bundleId].exists, "Bundle not found");
        return _bundles[bundleId];
    }

    /// @notice Get an evaluation record
    /// @param evalId The evaluation to query
    /// @return The evaluation record
    function getEvaluation(bytes32 evalId) external view returns (RegoEvalRecord memory) {
        require(_evaluations[evalId].exists, "Evaluation not found");
        return _evaluations[evalId];
    }
}
