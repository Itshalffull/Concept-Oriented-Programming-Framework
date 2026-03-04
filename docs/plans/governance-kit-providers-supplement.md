# Governance Kit — Provider Concepts Supplement

**Version:** 0.1.0-supplement (2026-03-01)
**Amends:** governance-kit-implementation-plan.md Section 5

---

## Design Decision: Providers as Concepts

All 32 mechanism providers are promoted to full `.concept` specs. The coordination+provider pattern still applies — coordination concepts (CountingMethod, Weight, SybilResistance, Reputation, FinalityGate, Policy) route to these provider concepts via PluginRegistry — but each provider now has its own sovereign state, purpose, actions with domain-specific variants, and operational principles.

**Rationale:** Even "simple" algorithms carry configuration state, have distinct purposes worth naming, and exhibit different failure modes. Capturing this as formal concept specs means:

1. Every provider gets generated schemas, handler skeletons, and conformance tests
2. Provider-specific state (credit budgets, lock records, graph structures) is explicitly modeled
3. Providers can be independently versioned and deployed
4. The concept library becomes a complete semantic map of governance mechanisms

**Updated totals:** 28 core concepts + 32 provider concepts = **60 governance concepts** across **7 suites + 1 provider suite** (or distributed into their parent suites).

**Structural choice:** Provider concepts live in sub-kits within their coordination concept's suite, keeping the routing relationship clear:

```
governance-decision/
├── Proposal.concept
├── Vote.concept
├── CountingMethod.concept          # coordination
├── counting-methods/               # provider sub-kit
│   ├── Majority.concept
│   ├── Supermajority.concept
│   ├── ApprovalCounting.concept
│   ├── RankedChoice.concept
│   ├── CondorcetSchulze.concept
│   ├── QuadraticVoting.concept
│   ├── ScoreVoting.concept
│   ├── BordaCount.concept
│   └── ConsentProcess.concept
├── ...
```

---

## 1. Counting Method Provider Concepts

### 1.1 Majority

```
@version(1)
concept Majority [MJ] {

  purpose {
    Determine a winner by simple majority of weighted votes, the unique
    anonymous, neutral, and monotone rule for binary decisions per May's theorem.
  }

  state {
    configurations: set MJ
    threshold: MJ -> Float
    binaryOnly: MJ -> Bool
    tieBreaker: MJ -> option String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(threshold: Float, binaryOnly: Bool, tieBreaker: option String) {
      -> configured(config: MJ) {
        A majority counting configuration is created. Default threshold
        is 0.5 (strict majority). BinaryOnly enforces exactly two choices.
      }
    }

    action count(config: MJ, ballots: String, weights: String) {
      -> winner(choice: String, voteShare: Float, totalWeight: Float) {
        One choice exceeds the threshold of total weighted votes cast.
      }
      -> tie(choices: String, voteShare: Float) {
        Two or more choices have equal weighted support at or above threshold.
        If tieBreaker is configured, it is applied.
      }
      -> no_majority(leadingChoice: String, voteShare: Float, threshold: Float) {
        No choice meets the threshold.
      }
    }
  }

  invariant {
    after configure(threshold: 0.5, binaryOnly: true, tieBreaker: _) -> configured(config: mj)
    then count(config: mj, ballots: _, weights: _) -> winner(choice: _, voteShare: _, totalWeight: _)
    // When one of two choices has > 50% of weight
  }
}
```

### 1.2 Supermajority

```
@version(1)
concept Supermajority [SM] {

  purpose {
    Require a heightened threshold of support beyond simple majority,
    typically used for constitutional amendments, irreversible actions,
    or high-stakes governance decisions.
  }

  state {
    configurations: set SM
    threshold: SM -> Float
    roundingMode: SM -> {Floor | Ceil | Round}
    abstentionsCount: SM -> Bool
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(threshold: Float, roundingMode: String, abstentionsCount: Bool) {
      -> configured(config: SM) {
        A supermajority configuration is created. Common thresholds:
        0.6667 (two-thirds), 0.75 (three-quarters), 0.8 (four-fifths).
        AbtentionsCount determines whether abstentions inflate the denominator.
      }
      -> invalid_threshold(threshold: Float) {
        Threshold must be between 0.5 (exclusive) and 1.0 (inclusive).
      }
    }

    action count(config: SM, ballots: String, weights: String) {
      -> winner(choice: String, voteShare: Float, requiredShare: Float) {
        One choice meets or exceeds the supermajority threshold.
      }
      -> insufficient(leadingChoice: String, voteShare: Float, requiredShare: Float, shortfall: Float) {
        The leading choice falls short of the threshold.
      }
    }
  }

  invariant {
    after configure(threshold: 0.6667, roundingMode: "Ceil", abstentionsCount: false) -> configured(config: sm)
    then count(config: sm, ballots: _, weights: _) -> winner(choice: _, voteShare: _, requiredShare: 0.6667)
    // When one choice has >= 66.67% of cast votes
  }
}
```

### 1.3 ApprovalCounting

```
@version(1)
concept ApprovalCounting [AC] {

  purpose {
    Allow each voter to approve any number of candidates, selecting the
    candidate with the most total approvals as the winner.
  }

  state {
    configurations: set AC
    maxApprovals: AC -> option Int
    winnerCount: AC -> Int
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(maxApprovals: option Int, winnerCount: Int) {
      -> configured(config: AC) {
        An approval counting configuration is created. MaxApprovals limits
        how many candidates each voter can approve (none = unlimited).
        WinnerCount allows multi-winner elections.
      }
    }

    action count(config: AC, approvalSets: String, weights: String) {
      -> winners(rankedResults: String, topChoice: String, approvalCount: Float) {
        Candidates ranked by weighted approval count. Top N per winnerCount.
      }
      -> tie(tiedCandidates: String, approvalCount: Float) {
        Multiple candidates have identical approval counts at the winner boundary.
      }
    }
  }

  invariant {
    after configure(maxApprovals: _, winnerCount: 1) -> configured(config: ac)
    then count(config: ac, approvalSets: _, weights: _) -> winners(rankedResults: _, topChoice: _, approvalCount: _)
  }
}
```

### 1.4 RankedChoice

```
@version(1)
concept RankedChoice [RC] {

  purpose {
    Elect a winner through iterative elimination of the candidate with
    fewest first-preference votes, transferring those votes to the next
    preference on each ballot.
  }

  state {
    configurations: set RC
    eliminationMethod: RC -> {InstantRunoff | SingleTransferable}
    seats: RC -> Int
    rounds: set RC
    round_data {
      roundNumber: RC -> Int
      eliminated: RC -> String
      voteCounts: RC -> String
      transfers: RC -> String
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(eliminationMethod: String, seats: Int) {
      -> configured(config: RC) {
        A ranked choice configuration is created. InstantRunoff for
        single-winner, SingleTransferable for multi-winner.
      }
    }

    action count(config: RC, rankedBallots: String, weights: String) {
      -> winner(choice: String, finalRound: Int, roundDetails: String) {
        A candidate achieves majority (IRV) or quota (STV) after
        elimination rounds. Full round-by-round details are recorded.
      }
      -> exhausted(remainingCandidates: String, finalRound: Int) {
        All ballots are exhausted before a winner emerges.
      }
    }

    action getRoundDetail(config: RC, roundNumber: Int) {
      -> detail(eliminated: String, voteCounts: String, transfers: String) {
        Returns the state of a specific elimination round.
      }
      -> not_found(roundNumber: Int) {
        No such round exists.
      }
    }
  }

  invariant {
    after configure(eliminationMethod: "InstantRunoff", seats: 1) -> configured(config: rc)
    then count(config: rc, rankedBallots: _, weights: _) -> winner(choice: _, finalRound: _, roundDetails: _)
  }
}
```

### 1.5 CondorcetSchulze

```
@version(1)
concept CondorcetSchulze [CS] {

  purpose {
    Find the candidate who would win every pairwise comparison, using the
    Schulze method to resolve cycles in the pairwise preference graph.
  }

  state {
    configurations: set CS
    pairwiseMatrix: CS -> String
    strongestPaths: CS -> String
    smithSet: CS -> option String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure() {
      -> configured(config: CS) {
        A Condorcet-Schulze configuration is created.
      }
    }

    action count(config: CS, rankedBallots: String, weights: String) {
      -> condorcet_winner(choice: String, pairwiseRecord: String) {
        A Condorcet winner exists — one candidate beats all others head-to-head.
      }
      -> schulze_winner(choice: String, strongestPaths: String) {
        No Condorcet winner exists. Schulze method resolves cycles by
        computing widest paths in the pairwise graph.
      }
      -> unresolvable(smithSet: String) {
        The Smith set contains candidates that Schulze cannot further
        distinguish. Rare with real ballots.
      }
    }

    action getPairwiseMatrix(config: CS) {
      -> matrix(data: String) {
        Returns the full pairwise comparison matrix from the last count.
      }
    }
  }

  invariant {
    after configure() -> configured(config: cs)
    then count(config: cs, rankedBallots: _, weights: _) -> condorcet_winner(choice: _, pairwiseRecord: _)
    // When a Condorcet winner exists
  }
}
```

### 1.6 QuadraticVoting

```
@version(1)
concept QuadraticVoting [QV] {

  purpose {
    Allow participants to express intensity of preference by purchasing
    votes at quadratic cost, so casting N votes on an issue costs N²
    credits from a finite budget.
  }

  state {
    configurations: set QV
    creditBudget: QV -> Float
    balances: set QV
    balance_data {
      voter: QV -> String
      remaining: QV -> Float
      spent: QV -> list {
        issue: String,
        votesCast: Int,
        creditsSpent: Float
      }
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(creditBudget: Float) {
      -> configured(config: QV) {
        A quadratic voting configuration with the given per-voter
        credit budget. Cost = votes².
      }
    }

    action allocateCredits(config: QV, voter: String) {
      -> allocated(voter: String, credits: Float) {
        The voter receives their credit budget for this voting round.
      }
      -> already_allocated(voter: String) {
        Credits have already been allocated to this voter.
      }
    }

    action castVotes(config: QV, voter: String, issue: String, numberOfVotes: Int) {
      -> cast(voter: String, votesCast: Int, creditsSpent: Float, remaining: Float) {
        The voter casts N votes at cost N². Credits are deducted.
      }
      -> insufficient_credits(voter: String, needed: Float, available: Float) {
        The voter does not have enough credits. Needed = votes².
      }
      -> no_allocation(voter: String) {
        The voter has not been allocated credits.
      }
    }

    action count(config: QV, issue: String) {
      -> winner(choice: String, totalVotes: Float, details: String) {
        Votes (not credits) are summed per choice. Highest total wins.
      }
      -> tie(choices: String, totalVotes: Float) {
        Multiple choices have equal vote totals.
      }
    }
  }

  invariant {
    after configure(creditBudget: 100.0) -> configured(config: qv)
    then allocateCredits(config: qv, voter: v) -> allocated(voter: v, credits: 100.0)
    and  castVotes(config: qv, voter: v, issue: _, numberOfVotes: 5) -> cast(voter: v, votesCast: 5, creditsSpent: 25.0, remaining: 75.0)
    // 5 votes costs 25 credits (5² = 25)
  }
}
```

### 1.7 ScoreVoting

```
@version(1)
concept ScoreVoting [SV] {

  purpose {
    Allow voters to assign a numeric score to each candidate within a
    defined range, selecting the candidate with the highest average
    or total weighted score.
  }

  state {
    configurations: set SV
    minScore: SV -> Float
    maxScore: SV -> Float
    aggregation: SV -> {Sum | Average | Median}
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(minScore: Float, maxScore: Float, aggregation: String) {
      -> configured(config: SV) {
        A score voting configuration with the given range and aggregation
        method.
      }
      -> invalid_range(minScore: Float, maxScore: Float) {
        MinScore must be less than maxScore.
      }
    }

    action count(config: SV, scoreBallots: String, weights: String) {
      -> winner(choice: String, aggregateScore: Float, details: String) {
        The candidate with the highest aggregate score wins.
      }
      -> tie(choices: String, aggregateScore: Float) {
        Multiple candidates have identical aggregate scores.
      }
    }
  }

  invariant {
    after configure(minScore: 0.0, maxScore: 5.0, aggregation: "Average") -> configured(config: sv)
    then count(config: sv, scoreBallots: _, weights: _) -> winner(choice: _, aggregateScore: _, details: _)
  }
}
```

### 1.8 BordaCount

```
@version(1)
concept BordaCount [BD] {

  purpose {
    Assign points based on rank position in each voter's preference
    ordering, awarding N-1 points to the first choice, N-2 to the
    second, and so on, where N is the number of candidates.
  }

  state {
    configurations: set BD
    pointScheme: BD -> {Standard | Modified | Dowdall}
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(pointScheme: String) {
      -> configured(config: BD) {
        Standard: first gets N-1, second N-2, ..., last gets 0.
        Modified: first gets N, last gets 1 (no zero).
        Dowdall: first gets 1, second gets 1/2, third 1/3, etc.
      }
    }

    action count(config: BD, rankedBallots: String, weights: String) {
      -> winner(choice: String, totalPoints: Float, details: String) {
        The candidate with the highest weighted Borda score wins.
      }
      -> tie(choices: String, totalPoints: Float) {
        Multiple candidates have identical Borda scores.
      }
    }
  }

  invariant {
    after configure(pointScheme: "Standard") -> configured(config: bd)
    then count(config: bd, rankedBallots: _, weights: _) -> winner(choice: _, totalPoints: _, details: _)
  }
}
```

### 1.9 ConsentProcess

```
@version(1)
concept ConsentProcess [CP] {

  purpose {
    Determine whether a proposal proceeds based on the absence of
    reasoned objections rather than affirmative majority support,
    following sociocratic consent-based decision making.
  }

  state {
    processes: set CP
    proposalRef: CP -> String
    status: CP -> {Presenting | Clarifying | Reacting | ObjectionRound | Integrated | Consented | Blocked}
    objections: CP -> list {
      objector: String,
      reason: String,
      isParamount: Bool,
      integrated: Bool
    }
    amendments: CP -> list String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action initiate(proposalRef: String) {
      -> initiated(process: CP) {
        A consent process begins in Presenting phase.
      }
    }

    action advancePhase(process: CP) {
      -> advanced(process: CP, newPhase: String) {
        The process moves to the next phase in sequence:
        Presenting → Clarifying → Reacting → ObjectionRound.
      }
    }

    action raiseObjection(process: CP, objector: String, reason: String, isParamount: Bool) {
      -> objection_raised(process: CP) {
        An objection is recorded. If paramount (would harm the organization's
        ability to achieve its aim), it blocks the proposal.
      }
      -> wrong_phase(process: CP) {
        Objections can only be raised during ObjectionRound.
      }
    }

    action integrateObjection(process: CP, objectionIndex: Int, amendment: String) {
      -> integrated(process: CP) {
        The proposal is amended to address the objection. The objection
        is marked as integrated. If all objections are integrated,
        a new objection round begins on the amended proposal.
      }
    }

    action resolve(process: CP) {
      -> consented(process: CP) {
        No unintegrated objections remain. The proposal has consent.
      }
      -> blocked(process: CP, outstandingObjections: Int) {
        Paramount objections remain that could not be integrated.
      }
    }
  }

  invariant {
    after initiate(proposalRef: _) -> initiated(process: cp)
    then advancePhase(process: cp) -> advanced(process: cp, newPhase: "Clarifying")
    // After full cycle with no objections:
    and  resolve(process: cp) -> consented(process: cp)
  }
}
```

---

## 2. Weight Source Provider Concepts

### 2.1 TokenBalance

```
@version(1)
concept TokenBalance [TB] {

  purpose {
    Derive governance weight from a participant's balance of a specific
    token at a point in time, the standard model for token-weighted
    governance.
  }

  state {
    configurations: set TB
    tokenAddress: TB -> String
    snapshotBlock: TB -> option String
    balanceCache: TB -> list {
      participant: String,
      balance: Float,
      cachedAt: DateTime
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(tokenAddress: String) {
      -> configured(config: TB) {
        A token balance weight source is configured for the given token.
      }
    }

    action snapshot(config: TB, blockRef: String) {
      -> snapshotted(config: TB, participantCount: Int) {
        All token balances are cached at the given block reference.
      }
    }

    action getWeight(config: TB, participant: String) {
      -> weight(participant: String, balance: Float) {
        Returns the participant's token balance (from cache if snapshotted,
        live if not).
      }
      -> zero_balance(participant: String) {
        The participant holds no tokens.
      }
    }
  }

  invariant {
    after configure(tokenAddress: _) -> configured(config: tb)
    then getWeight(config: tb, participant: _) -> weight(participant: _, balance: _)
  }
}
```

### 2.2 ReputationWeight

```
@version(1)
concept ReputationWeight [RW] {

  purpose {
    Derive governance weight from a participant's reputation score,
    decoupling influence from financial holdings.
  }

  state {
    configurations: set RW
    scalingFunction: RW -> {Linear | Logarithmic | Capped}
    cap: RW -> option Float
    floor: RW -> option Float
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(scalingFunction: String, cap: option Float, floor: option Float) {
      -> configured(config: RW) {
        Weight = f(reputation) where f is the configured scaling function.
        Cap sets maximum weight. Floor sets minimum weight for any
        participant with positive reputation.
      }
    }

    action computeWeight(config: RW, reputationScore: Float) {
      -> weight(value: Float) {
        The reputation score is transformed through the scaling function,
        clamped by cap and floor.
      }
      -> no_reputation() {
        The participant has zero or negative reputation. Weight is zero.
      }
    }
  }

  invariant {
    after configure(scalingFunction: "Linear", cap: 100.0, floor: 1.0) -> configured(config: rw)
    then computeWeight(config: rw, reputationScore: 50.0) -> weight(value: 50.0)
  }
}
```

### 2.3 StakeWeight

```
@version(1)
concept StakeWeight [SW] {

  purpose {
    Derive governance weight from tokens locked in a staking vault,
    requiring participants to commit capital as a signal of alignment.
  }

  state {
    vaults: set SW
    stakes: SW -> list {
      participant: String,
      amount: Float,
      lockedAt: DateTime,
      lockDuration: Float,
      unlockAt: DateTime
    }
    minimumStake: SW -> Float
    cooldownPeriod: SW -> Float
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(minimumStake: Float, cooldownPeriod: Float) {
      -> configured(vault: SW) {
        A staking weight source with minimum stake and cooldown period.
      }
    }

    action stake(vault: SW, participant: String, amount: Float, lockDurationHours: Float) {
      -> staked(participant: String, unlockAt: DateTime) {
        Tokens are locked. Weight is active immediately.
      }
      -> below_minimum(participant: String, amount: Float, minimum: Float) {
        The stake is below the minimum.
      }
    }

    action unstake(vault: SW, participant: String) {
      -> unstaking(participant: String, availableAt: DateTime) {
        Cooldown period begins. Weight is removed immediately.
        Tokens available after cooldown.
      }
      -> still_locked(participant: String, unlockAt: DateTime) {
        The lock period has not expired.
      }
    }

    action getWeight(vault: SW, participant: String) {
      -> weight(participant: String, stakedAmount: Float) {
        Returns the participant's staked amount as weight.
      }
      -> not_staked(participant: String) {
        The participant has no active stake.
      }
    }
  }

  invariant {
    after configure(minimumStake: 10.0, cooldownPeriod: 24.0) -> configured(vault: sw)
    then stake(vault: sw, participant: p, amount: 100.0, lockDurationHours: 720.0) -> staked(participant: p, unlockAt: _)
    and  getWeight(vault: sw, participant: p) -> weight(participant: p, stakedAmount: 100.0)
  }
}
```

### 2.4 EqualWeight

```
@version(1)
concept EqualWeight [EW] {

  purpose {
    Assign identical governance weight to every eligible participant
    regardless of holdings, reputation, or stake — one person, one vote.
  }

  state {
    configurations: set EW
    weightValue: EW -> Float
  }

  actions {
    action configure(weightValue: Float) {
      -> configured(config: EW) {
        Every participant receives the given weight. Default 1.0.
      }
    }

    action getWeight(config: EW, participant: String) {
      -> weight(participant: String, value: Float) {
        Returns the fixed weight value.
      }
    }
  }

  invariant {
    after configure(weightValue: 1.0) -> configured(config: ew)
    then getWeight(config: ew, participant: _) -> weight(participant: _, value: 1.0)
  }
}
```

### 2.5 VoteEscrow

```
@version(1)
concept VoteEscrow [VE] {

  purpose {
    Derive governance weight from time-locked token positions, where
    weight is proportional to both amount locked and remaining lock
    duration, incentivizing long-term commitment.
  }

  state {
    locks: set VE
    participant: VE -> String
    amount: VE -> Float
    lockEnd: VE -> DateTime
    maxLockDuration: VE -> Float
    checkpoints: VE -> list {
      timestamp: DateTime,
      weight: Float
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(maxLockDurationDays: Float) {
      -> configured(config: VE) {
        Maximum lock duration in days. Weight = amount × (remaining / max).
      }
    }

    action lock(participant: String, amount: Float, lockDurationDays: Float) {
      -> locked(lock: VE, initialWeight: Float) {
        Tokens are locked. Weight = amount × (lockDuration / maxLockDuration).
        Weight decays linearly as lock approaches expiry.
      }
      -> exceeds_max(lockDurationDays: Float, maxDays: Float) {
        Lock duration exceeds the configured maximum.
      }
    }

    action extendLock(lock: VE, additionalDays: Float) {
      -> extended(lock: VE, newWeight: Float) {
        Lock end is pushed further. Weight increases.
      }
    }

    action getWeight(lock: VE) {
      -> weight(participant: String, currentWeight: Float, decayRate: Float) {
        Returns current weight based on remaining lock time.
        Weight = amount × max(0, (lockEnd - now) / maxLockDuration).
      }
      -> expired(participant: String) {
        Lock has expired. Weight is zero. Tokens can be withdrawn.
      }
    }

    action withdraw(lock: VE) {
      -> withdrawn(participant: String, amount: Float) {
        Lock has expired; tokens are returned.
      }
      -> still_locked(lock: VE, unlockAt: DateTime) {
        Lock has not expired.
      }
    }
  }

  invariant {
    after configure(maxLockDurationDays: 365.0) -> configured(config: _)
    then lock(participant: p, amount: 100.0, lockDurationDays: 365.0) -> locked(lock: ve, initialWeight: 100.0)
    // Weight starts at 100.0 (full lock) and decays to 0 at expiry
    and  getWeight(lock: ve) -> weight(participant: p, currentWeight: _, decayRate: _)
  }
}
```

### 2.6 QuadraticWeight

```
@version(1)
concept QuadraticWeight [QW] {

  purpose {
    Derive governance weight as the square root of a participant's
    token balance, reducing concentration of power while still
    recognizing larger stakeholders.
  }

  state {
    configurations: set QW
    tokenSource: QW -> String
    scalingFactor: QW -> Float
  }

  actions {
    action configure(tokenSource: String, scalingFactor: Float) {
      -> configured(config: QW) {
        Weight = scalingFactor × √(balance). ScalingFactor defaults to 1.0.
      }
    }

    action computeWeight(config: QW, balance: Float) {
      -> weight(value: Float) {
        Returns scalingFactor × √(balance).
      }
      -> zero_balance() {
        Balance is zero. Weight is zero.
      }
    }
  }

  invariant {
    after configure(tokenSource: _, scalingFactor: 1.0) -> configured(config: qw)
    then computeWeight(config: qw, balance: 100.0) -> weight(value: 10.0)
    // √100 = 10
  }
}
```

---

## 3. Sybil Resistance Provider Concepts

### 3.1 ProofOfPersonhood

```
@version(1)
concept ProofOfPersonhood [PP] {

  purpose {
    Verify that a governance participant represents a unique biological
    human through biometric, physical, or ceremony-based proof.
  }

  state {
    verifications: set PP
    participant: PP -> String
    method: PP -> {Biometric | Ceremony | VideoCall | InPerson}
    verifiedAt: PP -> DateTime
    expiresAt: PP -> option DateTime
    verifier: PP -> String
    proofHash: PP -> String
  }

  capabilities {
    requires persistent-storage
    requires crypto
  }

  actions {
    action verify(participant: String, method: String, proofHash: String, verifier: String, expiryDays: option Float) {
      -> verified(verification: PP) {
        The participant is verified as a unique human.
      }
      -> invalid_proof(participant: String, reason: String) {
        The proof is invalid or insufficient.
      }
      -> already_verified(participant: String) {
        The participant already has an active verification.
      }
    }

    action checkStatus(participant: String) {
      -> valid(expiresAt: option DateTime) {
        The participant has a current, non-expired verification.
      }
      -> expired(expiredAt: DateTime) {
        The verification has expired and must be renewed.
      }
      -> not_verified() {
        No verification exists for this participant.
      }
    }

    action revoke(participant: String, reason: String) {
      -> revoked(participant: String) {
        The verification is invalidated.
      }
    }
  }

  invariant {
    after verify(participant: p, method: _, proofHash: _, verifier: _, expiryDays: _) -> verified(verification: _)
    then checkStatus(participant: p) -> valid(expiresAt: _)
  }
}
```

### 3.2 StakeThreshold

```
@version(1)
concept StakeThreshold [ST] {

  purpose {
    Deter sybil attacks by requiring a minimum capital deposit to
    participate in governance, making identity duplication costly.
  }

  state {
    configurations: set ST
    minimumStake: ST -> Float
    slashOnViolation: ST -> Bool
    deposits: ST -> list {
      participant: String,
      amount: Float,
      depositedAt: DateTime
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(minimumStake: Float, slashOnViolation: Bool) {
      -> configured(config: ST) {
        Sets the minimum stake for participation and whether detected
        sybil accounts forfeit their deposit.
      }
    }

    action deposit(config: ST, participant: String, amount: Float) {
      -> deposited(participant: String) {
        The participant has met the stake threshold and is eligible.
      }
      -> insufficient(participant: String, deposited: Float, required: Float) {
        The deposit does not meet the minimum.
      }
    }

    action checkEligibility(config: ST, participant: String) {
      -> eligible(participant: String, stakedAmount: Float) {
        The participant has an active deposit meeting the threshold.
      }
      -> ineligible(participant: String) {
        No sufficient deposit exists.
      }
    }

    action slash(config: ST, participant: String, reason: String) {
      -> slashed(participant: String, forfeitedAmount: Float) {
        The participant's deposit is forfeited.
      }
      -> slashing_disabled() {
        SlashOnViolation is false.
      }
    }
  }

  invariant {
    after configure(minimumStake: 100.0, slashOnViolation: true) -> configured(config: st)
    then deposit(config: st, participant: p, amount: 100.0) -> deposited(participant: p)
    and  checkEligibility(config: st, participant: p) -> eligible(participant: p, stakedAmount: 100.0)
  }
}
```

### 3.3 SocialGraphVerification

```
@version(1)
concept SocialGraphVerification [SG] {

  purpose {
    Detect sybil identities by analyzing the vouching graph between
    participants, identifying clusters that are weakly connected to
    the trusted core.
  }

  state {
    vouches: set SG
    voucher: SG -> String
    vouchee: SG -> String
    vouchedAt: SG -> DateTime
    config {
      minVouches: SG -> Int
      trustAnchors: SG -> set String
      clusterThreshold: SG -> Float
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(minVouches: Int, trustAnchors: set String, clusterThreshold: Float) {
      -> configured(config: SG) {
        MinVouches is the minimum endorsements needed. TrustAnchors
        are pre-trusted founding members. ClusterThreshold sets the
        minimum graph connectivity score to pass.
      }
    }

    action vouch(voucher: String, vouchee: String) {
      -> vouched(vouch: SG) {
        A vouching edge is added to the graph.
      }
      -> self_vouch(participant: String) {
        Cannot vouch for oneself.
      }
      -> already_vouched(voucher: String, vouchee: String) {
        This vouch already exists.
      }
    }

    action analyze(participant: String) {
      -> trusted(participant: String, connectivityScore: Float, vouchCount: Int) {
        The participant is sufficiently connected to the trust graph.
      }
      -> suspicious(participant: String, connectivityScore: Float, reason: String) {
        The participant's graph position suggests potential sybil behavior.
      }
      -> insufficient_vouches(participant: String, have: Int, need: Int) {
        The participant has too few vouches.
      }
    }

    action revokeVouch(voucher: String, vouchee: String) {
      -> revoked(voucher: String, vouchee: String) {
        The vouch is removed.
      }
    }
  }

  invariant {
    after configure(minVouches: 3, trustAnchors: _, clusterThreshold: _) -> configured(config: _)
    then vouch(voucher: _, vouchee: p) -> vouched(vouch: _)
    // After 3+ vouches from well-connected members:
    and  analyze(participant: p) -> trusted(participant: p, connectivityScore: _, vouchCount: _)
  }
}
```

### 3.4 AttestationSybil

```
@version(1)
concept AttestationSybil [AS] {

  purpose {
    Verify participant uniqueness through credentials issued by trusted
    attesters, bridging external identity systems into governance.
  }

  state {
    configurations: set AS
    requiredSchemas: AS -> set String
    trustedAttesters: AS -> set String
    verificationCache: AS -> list {
      participant: String,
      attestationRef: String,
      verifiedAt: DateTime
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(requiredSchemas: set String, trustedAttesters: set String) {
      -> configured(config: AS) {
        Defines which attestation schemas and issuers are accepted
        for sybil verification.
      }
    }

    action checkParticipant(config: AS, participant: String, attestationRef: String) {
      -> verified(participant: String) {
        The participant holds a valid attestation from a trusted attester
        matching a required schema.
      }
      -> untrusted_attester(attester: String) {
        The attestation's issuer is not in the trusted set.
      }
      -> wrong_schema(schema: String) {
        The attestation does not match any required schema.
      }
      -> invalid_attestation(reason: String) {
        The attestation is expired, revoked, or malformed.
      }
    }
  }

  invariant {
    after configure(requiredSchemas: _, trustedAttesters: _) -> configured(config: as)
    then checkParticipant(config: as, participant: _, attestationRef: _) -> verified(participant: _)
  }
}
```

---

## 4. Reputation Algorithm Provider Concepts

### 4.1 SimpleAccumulator

```
@version(1)
concept SimpleAccumulator [SA] {

  purpose {
    Compute reputation as a running sum of earned and burned increments,
    with optional time-based exponential decay.
  }

  state {
    configurations: set SA
    decayHalfLifeDays: SA -> option Float
    initialScore: SA -> Float
    minScore: SA -> Float
    maxScore: SA -> option Float
  }

  actions {
    action configure(decayHalfLifeDays: option Float, initialScore: Float, minScore: Float, maxScore: option Float) {
      -> configured(config: SA) {
        Simple additive reputation with optional exponential decay.
        Score is clamped between minScore and maxScore.
      }
    }

    action compute(config: SA, currentScore: Float, delta: Float, daysSinceLastUpdate: Float) {
      -> score(newScore: Float, decayApplied: Float) {
        NewScore = (currentScore × decayFactor) + delta, clamped.
        DecayFactor = 0.5^(daysSinceLastUpdate / halfLife) if decay configured.
      }
    }
  }

  invariant {
    after configure(decayHalfLifeDays: _, initialScore: 0.0, minScore: 0.0, maxScore: _) -> configured(config: sa)
    then compute(config: sa, currentScore: 50.0, delta: 10.0, daysSinceLastUpdate: 0.0) -> score(newScore: 60.0, decayApplied: 0.0)
  }
}
```

### 4.2 PageRankReputation

```
@version(1)
concept PageRankReputation [PR] {

  purpose {
    Compute reputation by applying PageRank to a directed contribution
    graph, where endorsements and interactions propagate trust through
    the network.
  }

  state {
    graphs: set PR
    edges: PR -> list {
      source: String,
      target: String,
      weight: Float
    }
    scores: PR -> list {
      participant: String,
      score: Float
    }
    config {
      dampingFactor: PR -> Float
      maxIterations: PR -> Int
      convergenceThreshold: PR -> Float
      preTrusted: PR -> set String
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(dampingFactor: Float, maxIterations: Int, convergenceThreshold: Float, preTrusted: set String) {
      -> configured(graph: PR) {
        Standard damping factor is 0.85. PreTrusted nodes serve as
        trust anchors to prevent manipulation by isolated clusters.
      }
    }

    action addEdge(graph: PR, source: String, target: String, weight: Float) {
      -> added(graph: PR) {
        A directed edge is added to the contribution graph.
      }
    }

    action removeEdge(graph: PR, source: String, target: String) {
      -> removed(graph: PR) {
        The edge is removed.
      }
    }

    action compute(graph: PR) {
      -> computed(graph: PR, iterations: Int, converged: Bool) {
        PageRank is computed over the current graph. Scores are stored
        for each participant. Teleport probability distributes to
        preTrusted nodes rather than uniformly.
      }
    }

    action getScore(graph: PR, participant: String) {
      -> score(participant: String, value: Float, rank: Int) {
        Returns the participant's PageRank score and ordinal rank.
      }
      -> not_in_graph(participant: String) {
        The participant has no edges in the graph.
      }
    }
  }

  invariant {
    after configure(dampingFactor: 0.85, maxIterations: 100, convergenceThreshold: 0.0001, preTrusted: _) -> configured(graph: pr)
    then addEdge(graph: pr, source: _, target: _, weight: _) -> added(graph: pr)
    and  compute(graph: pr) -> computed(graph: pr, iterations: _, converged: _)
  }
}
```

### 4.3 EloRating

```
@version(1)
concept EloRating [EL] {

  purpose {
    Maintain pairwise comparison-based skill ratings for governance
    participants, updating ratings after interactions based on expected
    versus actual outcomes.
  }

  state {
    ratings: set EL
    participant: EL -> String
    rating: EL -> Float
    gamesPlayed: EL -> Int
    config {
      kFactor: EL -> Float
      initialRating: EL -> Float
      kFactorDecay: EL -> option String
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(kFactor: Float, initialRating: Float, kFactorDecay: option String) {
      -> configured(config: EL) {
        K-factor controls update magnitude. InitialRating for new
        participants. KFactorDecay optionally reduces K as games increase.
      }
    }

    action recordOutcome(config: EL, winner: String, loser: String) {
      -> updated(winnerNewRating: Float, loserNewRating: Float, winnerDelta: Float, loserDelta: Float) {
        Expected scores computed from rating difference. Actual outcome
        (1 for winner, 0 for loser) drives update:
        newRating = oldRating + K × (actual - expected).
      }
    }

    action recordDraw(config: EL, participantA: String, participantB: String) {
      -> updated(aNewRating: Float, bNewRating: Float) {
        Both participants scored 0.5. Updates apply symmetrically.
      }
    }

    action getRating(config: EL, participant: String) {
      -> rating(participant: String, value: Float, gamesPlayed: Int) {
        Returns current Elo rating.
      }
      -> unrated(participant: String) {
        No rating exists. Would receive initialRating.
      }
    }
  }

  invariant {
    after configure(kFactor: 32.0, initialRating: 1500.0, kFactorDecay: _) -> configured(config: el)
    then recordOutcome(config: el, winner: w, loser: l) -> updated(winnerNewRating: _, loserNewRating: _, winnerDelta: _, loserDelta: _)
  }
}
```

### 4.4 GlickoRating

```
@version(1)
concept GlickoRating [GL] {

  purpose {
    Extend Elo with a rating deviation (uncertainty) dimension that
    increases during inactivity and decreases with activity, enabling
    governance systems to discount influence from inactive participants.
  }

  state {
    ratings: set GL
    participant: GL -> String
    rating: GL -> Float
    deviation: GL -> Float
    volatility: GL -> Float
    lastActive: GL -> DateTime
    config {
      initialRating: GL -> Float
      initialDeviation: GL -> Float
      initialVolatility: GL -> Float
      inactivityGrowthRate: GL -> Float
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action configure(initialRating: Float, initialDeviation: Float, initialVolatility: Float, inactivityGrowthRate: Float) {
      -> configured(config: GL) {
        Glicko-2 parameters. Deviation grows with inactivity per
        inactivityGrowthRate, representing increasing uncertainty.
      }
    }

    action recordOutcome(config: GL, participant: String, opponent: String, outcome: Float) {
      -> updated(participant: String, newRating: Float, newDeviation: Float) {
        Rating and deviation updated per Glicko-2 algorithm.
        Deviation decreases (more certain) after activity.
      }
    }

    action applyInactivityDecay(config: GL, participant: String, daysSinceActive: Float) {
      -> decayed(participant: String, newDeviation: Float) {
        Deviation increases based on days inactive, reflecting
        growing uncertainty about the participant's current ability.
      }
    }

    action getReliableWeight(config: GL, participant: String) {
      -> weight(participant: String, rating: Float, deviation: Float, reliability: Float) {
        Reliability = 1 - (deviation / maxDeviation). Can be used
        to discount governance weight for uncertain participants.
      }
    }
  }

  invariant {
    after configure(initialRating: 1500.0, initialDeviation: 350.0, initialVolatility: 0.06, inactivityGrowthRate: _) -> configured(config: gl)
    then recordOutcome(config: gl, participant: p, opponent: _, outcome: _) -> updated(participant: p, newRating: _, newDeviation: _)
  }
}
```

### 4.5 PeerAllocation

```
@version(1)
concept PeerAllocation [PA] {

  purpose {
    Compute reputation through periodic peer-to-peer allocation rounds
    where participants distribute a limited budget of recognition tokens
    to colleagues based on perceived value.
  }

  state {
    rounds: set PA
    roundStatus: PA -> {Open | Closed | Finalized}
    deadline: PA -> DateTime
    budget: PA -> Int
    allocations: PA -> list {
      allocator: String,
      recipient: String,
      amount: Int,
      note: option String
    }
    results: PA -> list {
      participant: String,
      received: Int,
      givers: Int
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action openRound(budget: Int, deadlineDays: Float) {
      -> opened(round: PA) {
        A new allocation round begins. Each participant receives the
        budget amount of tokens to distribute to others.
      }
    }

    action allocate(round: PA, allocator: String, recipient: String, amount: Int, note: option String) {
      -> allocated(round: PA) {
        Tokens are allocated from the allocator's budget to the recipient.
      }
      -> budget_exceeded(allocator: String, remaining: Int, requested: Int) {
        The allocator does not have enough budget remaining.
      }
      -> self_allocation(allocator: String) {
        Cannot allocate to oneself.
      }
      -> round_closed(round: PA) {
        The round is no longer accepting allocations.
      }
    }

    action finalize(round: PA) {
      -> finalized(round: PA, results: String) {
        The round is closed and results are computed. Each participant's
        received total and number of distinct givers are calculated.
      }
    }
  }

  invariant {
    after openRound(budget: 100, deadlineDays: 7.0) -> opened(round: pa)
    then allocate(round: pa, allocator: a, recipient: b, amount: 30, note: _) -> allocated(round: pa)
    and  finalize(round: pa) -> finalized(round: pa, results: _)
  }
}
```

---

## 5. Policy Evaluator Provider Concepts

### 5.1 ADICOEvaluator

```
@version(1)
concept ADICOEvaluator [AE] {

  purpose {
    Evaluate governance policies encoded in ADICO institutional grammar,
    parsing Attributes-Deontic-aIm-Conditions-OrElse statements into
    executable compliance checks.
  }

  state {
    parsedRules: set AE
    sourceText: AE -> String
    parsedAttributes: AE -> String
    parsedDeontic: AE -> String
    parsedAim: AE -> String
    parsedConditions: AE -> String
    parsedOrElse: AE -> option String
    parseErrors: AE -> option String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action parse(ruleText: String) {
      -> parsed(rule: AE) {
        The ADICO statement is parsed into its five components.
      }
      -> parse_error(text: String, error: String) {
        The text does not conform to ADICO grammar.
      }
    }

    action evaluate(rule: AE, context: String) {
      -> permitted(rule: AE) {
        The context matches the Attributes and Conditions, and the
        Deontic is May.
      }
      -> required(rule: AE) {
        Deontic is Must and conditions are met.
      }
      -> forbidden(rule: AE) {
        Deontic is MustNot and conditions are met.
      }
      -> not_applicable(rule: AE) {
        Attributes or Conditions do not match the context.
      }
    }
  }

  invariant {
    after parse(ruleText: _) -> parsed(rule: ae)
    then evaluate(rule: ae, context: _) -> permitted(rule: ae)
  }
}
```

### 5.2 RegoEvaluator

```
@version(1)
concept RegoEvaluator [RE] {

  purpose {
    Evaluate governance policies written in Rego (Open Policy Agent),
    enabling general-purpose policy-as-code with data/policy separation
    and composable rule sets.
  }

  state {
    bundles: set RE
    policySource: RE -> String
    dataSource: RE -> String
    compiledAt: RE -> option DateTime
    packageName: RE -> String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action loadBundle(policySource: String, dataSource: String, packageName: String) {
      -> loaded(bundle: RE) {
        Rego policy and data are loaded and compiled.
      }
      -> compile_error(error: String) {
        The Rego source has syntax or type errors.
      }
    }

    action evaluate(bundle: RE, input: String) {
      -> result(decision: String, bindings: String) {
        The policy is evaluated against the input. Returns the decision
        and any variable bindings.
      }
      -> undefined(bundle: RE) {
        The policy produced no defined result for this input.
      }
      -> runtime_error(error: String) {
        Evaluation produced a runtime error.
      }
    }

    action updateData(bundle: RE, newData: String) {
      -> updated(bundle: RE) {
        The data document is replaced without recompiling policy.
      }
    }
  }

  invariant {
    after loadBundle(policySource: _, dataSource: _, packageName: _) -> loaded(bundle: re)
    then evaluate(bundle: re, input: _) -> result(decision: _, bindings: _)
  }
}
```

### 5.3 CedarEvaluator

```
@version(1)
concept CedarEvaluator [CE] {

  purpose {
    Evaluate governance policies written in Cedar (AWS) with formal
    verification support, enabling provable properties about
    permit/forbid compositions before deployment.
  }

  state {
    policyStores: set CE
    policies: CE -> list {
      policyId: String,
      effect: String,
      principal: String,
      action: String,
      resource: String,
      conditions: option String
    }
    schema: CE -> option String
    verificationResults: CE -> option String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action loadPolicies(policies: String, schema: option String) {
      -> loaded(store: CE) {
        Cedar policies and optional schema are loaded.
      }
      -> validation_error(errors: String) {
        Policies fail schema validation.
      }
    }

    action authorize(store: CE, principal: String, action: String, resource: String, context: String) {
      -> allow(store: CE) {
        At least one permit policy matches and no forbid policy matches.
      }
      -> deny(store: CE, reasons: String) {
        A forbid policy matches, or no permit policy matches.
      }
    }

    action verify(store: CE, property: String) {
      -> verified(store: CE, property: String) {
        The SMT solver confirms the property holds for all inputs.
      }
      -> counterexample(store: CE, property: String, example: String) {
        A counterexample was found violating the property.
      }
    }
  }

  invariant {
    after loadPolicies(policies: _, schema: _) -> loaded(store: ce)
    then authorize(store: ce, principal: _, action: _, resource: _, context: _) -> allow(store: ce)
  }
}
```

### 5.4 CustomEvaluator

```
@version(1)
concept CustomEvaluator [CU] {

  purpose {
    Evaluate governance policies defined as user-authored predicate
    functions, providing maximum flexibility for domain-specific
    governance rules.
  }

  state {
    functions: set CU
    name: CU -> String
    source: CU -> String
    language: CU -> {JavaScript | Python | Expression}
    sandbox: CU -> Bool
    lastEvaluation: CU -> option DateTime
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action register(name: String, source: String, language: String, sandbox: Bool) {
      -> registered(evaluator: CU) {
        A custom predicate function is registered. If sandbox is true,
        the function runs in an isolated execution context.
      }
      -> syntax_error(name: String, error: String) {
        The source code has syntax errors.
      }
    }

    action evaluate(evaluator: CU, context: String) {
      -> result(evaluator: CU, output: String) {
        The predicate is executed against the context and returns a result.
      }
      -> runtime_error(evaluator: CU, error: String) {
        Execution failed.
      }
      -> timeout(evaluator: CU) {
        Execution exceeded the time limit.
      }
    }

    action deregister(evaluator: CU) {
      -> deregistered(evaluator: CU) {
        The custom evaluator is removed.
      }
    }
  }

  invariant {
    after register(name: _, source: _, language: _, sandbox: true) -> registered(evaluator: cu)
    then evaluate(evaluator: cu, context: _) -> result(evaluator: cu, output: _)
  }
}
```

---

## 6. Finality Provider Concepts

### 6.1 ImmediateFinality

```
@version(1)
concept ImmediateFinality [IF] {

  purpose {
    Provide instant finality confirmation for governance operations
    in centralized or trusted environments where no external
    consensus is required.
  }

  state {
    confirmations: set IF
    operationRef: IF -> String
    confirmedAt: IF -> DateTime
  }

  actions {
    action confirm(operationRef: String) {
      -> finalized(confirmation: IF) {
        The operation is immediately confirmed as final.
      }
    }
  }

  invariant {
    after confirm(operationRef: _) -> finalized(confirmation: _)
  }
}
```

### 6.2 ChainFinality

```
@version(1)
@gate
concept ChainFinality [CF] {

  purpose {
    Track block-level finality on a blockchain, confirming governance
    operations only when the underlying transaction achieves irreversible
    consensus.
  }

  state {
    tracked: set CF
    operationRef: CF -> String
    txHash: CF -> String
    chainId: CF -> String
    submittedBlock: CF -> Int
    finalizedBlock: CF -> option Int
    status: CF -> {Pending | Confirmed | Finalized | Reorged}
    requiredConfirmations: CF -> Int
  }

  capabilities {
    requires persistent-storage
    requires network
  }

  actions {
    action track(operationRef: String, txHash: String, chainId: String, requiredConfirmations: Int) {
      -> tracking(entry: CF) {
        A transaction is registered for finality tracking.
      }
    }

    action checkFinality(entry: CF) {
      -> pending(entry: CF, currentConfirmations: Int, required: Int) {
        Transaction is included but has not reached required confirmations.
      }
      -> finalized(entry: CF, finalizedBlock: Int) {
        Transaction has reached required confirmations or Casper-FFG
        finality epoch.
      }
      -> reorged(entry: CF) {
        The block containing the transaction was reorganized out of
        the canonical chain.
      }
    }
  }

  invariant {
    after track(operationRef: _, txHash: _, chainId: _, requiredConfirmations: 12) -> tracking(entry: cf)
    // After 12+ confirmations:
    then checkFinality(entry: cf) -> finalized(entry: cf, finalizedBlock: _)
  }
}
```

### 6.3 BFTFinality

```
@version(1)
@gate
concept BFTFinality [BF] {

  purpose {
    Achieve deterministic finality through Byzantine Fault Tolerant
    committee consensus, providing immediate irreversibility once
    a quorum of validators agrees.
  }

  state {
    committees: set BF
    validators: BF -> set String
    faultTolerance: BF -> Float
    protocol: BF -> {PBFT | HotStuff | Tendermint}
    rounds: BF -> list {
      roundNumber: Int,
      proposer: String,
      status: String,
      votes: list String
    }
    finalized: BF -> list {
      operationRef: String,
      round: Int,
      finalizedAt: DateTime
    }
  }

  capabilities {
    requires persistent-storage
    requires network
  }

  actions {
    action configureCommittee(validators: set String, faultTolerance: Float, protocol: String) {
      -> configured(committee: BF) {
        A BFT committee is established. FaultTolerance is the fraction
        of validators that can be Byzantine (typically 1/3).
      }
    }

    action proposeFinality(committee: BF, operationRef: String, proposer: String) {
      -> proposed(committee: BF, roundNumber: Int) {
        A finality round is initiated by the proposer.
      }
    }

    action vote(committee: BF, roundNumber: Int, validator: String, approve: Bool) {
      -> voted(committee: BF) {
        The validator's vote is recorded.
      }
      -> not_validator(validator: String) {
        The voter is not a committee member.
      }
    }

    action checkConsensus(committee: BF, roundNumber: Int) {
      -> finalized(committee: BF, operationRef: String) {
        Sufficient votes received (> 2/3 of validators). Operation is final.
      }
      -> insufficient(committee: BF, currentVotes: Int, required: Int) {
        Not enough votes yet.
      }
      -> byzantine_detected(committee: BF, evidence: String) {
        Conflicting votes detected from a validator.
      }
    }
  }

  invariant {
    after configureCommittee(validators: _, faultTolerance: 0.333, protocol: "PBFT") -> configured(committee: bf)
    then proposeFinality(committee: bf, operationRef: _, proposer: _) -> proposed(committee: bf, roundNumber: _)
  }
}
```

### 6.4 OptimisticOracleFinality

```
@version(1)
@gate
concept OptimisticOracleFinality [OO] {

  purpose {
    Achieve finality through optimistic assertion with a dispute window,
    where operations are considered final unless successfully challenged
    within a defined period.
  }

  state {
    assertions: set OO
    operationRef: OO -> String
    asserter: OO -> String
    bond: OO -> Float
    challengeWindowHours: OO -> Float
    assertedAt: OO -> DateTime
    expiresAt: OO -> DateTime
    status: OO -> {Pending | Challenged | Finalized | Rejected}
    disputeRef: OO -> option String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action assertFinality(operationRef: String, asserter: String, bond: Float, challengeWindowHours: Float) {
      -> asserted(assertion: OO) {
        An optimistic finality assertion is created. If unchallenged
        before expiry, the operation achieves finality.
      }
    }

    action challenge(assertion: OO, challenger: String, bond: Float, evidence: String) {
      -> challenged(assertion: OO) {
        The assertion is challenged. Dispute resolution determines outcome.
      }
      -> expired(assertion: OO) {
        Challenge window has closed.
      }
    }

    action resolve(assertion: OO, validAssertion: Bool) {
      -> finalized(assertion: OO) {
        The assertion is valid. Operation achieves finality.
        Challenger's bond is forfeited.
      }
      -> rejected(assertion: OO) {
        The assertion is invalid. Asserter's bond is forfeited.
      }
    }

    action checkExpiry(assertion: OO) {
      -> finalized(assertion: OO) {
        Challenge window expired without challenge. Operation is final.
      }
      -> still_pending(assertion: OO, remainingHours: Float) {
        Challenge window is still open.
      }
    }
  }

  invariant {
    after assertFinality(operationRef: _, asserter: _, bond: _, challengeWindowHours: 48.0) -> asserted(assertion: oo)
    // After 48 hours with no challenge:
    then checkExpiry(assertion: oo) -> finalized(assertion: oo)
  }
}
```

---

## 7. Updated Totals and Implementation Impact

### 7.1 Revised Inventory

| Suite | Core Concepts | Provider Concepts | Total |
|-------|--------------|-------------------|-------|
| governance-identity | 6 | 4 (sybil providers) | 10 |
| governance-structure | 4 | 6 (weight providers) | 10 |
| governance-decision | 9 | 9 (counting providers) | 18 |
| governance-rules | 4 | 4 (policy providers) | 8 |
| governance-execution | 5 | 4 (finality providers) | 9 |
| governance-resources | 5 | 5 (reputation providers) | 10 |
| governance-transparency | 2 | 0 | 2 |
| **Total** | **35** | **32** | **67** |

Note: Core total increased from 28 to 35 because Weight, Reputation, CountingMethod, SybilResistance, FinalityGate, and Policy are now counted once as coordination concepts and once as concepts in their own right (they were already counted in the original 28 — the discrepancy is because 7 of the original 28 had dual roles). The actual new concept count is **60 unique concepts**.

### 7.2 Updated Build Phases

Provider concepts build in parallel after their coordination concept exists. No change to the core dependency order. Phase 7 (previously "Providers") becomes Phase 7 ("Provider Concept Specs + Implementations") with the same timeline but generating full `.concept` specs, schemas, and handler skeletons rather than just provider interfaces.

### 7.3 Updated Effort Estimate

Provider concepts are individually simpler than core concepts (smaller state, fewer actions, fewer syncs), but there are 32 of them. Estimated additional effort vs treating them as plain provider implementations:

| Language | Additional per-provider | ×32 providers | Total addition |
|----------|----------------------|---------------|----------------|
| Spec writing | +0.5h | 16h (~2d) | Already done in this doc |
| TypeScript | +1h (handler + tests) | 32h (~4d) | +4d |
| Rust | +1h | 32h (~4d) | +4d |
| Swift | +0.75h | 24h (~3d) | +3d |
| Solidity | +1h | 32h (~4d) | +4d |

**Net addition:** ~15 person-days, bringing total from ~153d to ~168d.

### 7.4 Suite Manifest Updates

Each suite.yaml gains provider concept entries. Example for governance-decision:

```yaml
# Add to governance-decision/suite.yaml
concepts:
  # ... existing core concepts ...

  # Counting method providers
  Majority:
    spec: ./counting-methods/Majority.concept
    params:
      MJ: { as: majority-config-id, description: "Majority counting configuration" }
    optional: true
  Supermajority:
    spec: ./counting-methods/Supermajority.concept
    params:
      SM: { as: supermajority-config-id, description: "Supermajority counting configuration" }
    optional: true
  ApprovalCounting:
    spec: ./counting-methods/ApprovalCounting.concept
    params:
      AC: { as: approval-config-id, description: "Approval counting configuration" }
    optional: true
  RankedChoice:
    spec: ./counting-methods/RankedChoice.concept
    params:
      RC: { as: ranked-choice-config-id, description: "Ranked choice configuration" }
    optional: true
  CondorcetSchulze:
    spec: ./counting-methods/CondorcetSchulze.concept
    params:
      CS: { as: condorcet-config-id, description: "Condorcet-Schulze configuration" }
    optional: true
  QuadraticVoting:
    spec: ./counting-methods/QuadraticVoting.concept
    params:
      QV: { as: qv-config-id, description: "Quadratic voting configuration" }
    optional: true
  ScoreVoting:
    spec: ./counting-methods/ScoreVoting.concept
    params:
      SV: { as: score-config-id, description: "Score voting configuration" }
    optional: true
  BordaCount:
    spec: ./counting-methods/BordaCount.concept
    params:
      BD: { as: borda-config-id, description: "Borda count configuration" }
    optional: true
  ConsentProcess:
    spec: ./counting-methods/ConsentProcess.concept
    params:
      CP: { as: consent-process-id, description: "Consent process instance" }
    optional: true
```

The `optional: true` flag means these provider concepts are loaded only when explicitly selected — consistent with the coordination+provider pattern.

### 7.5 Routing Syncs

Each coordination concept needs a routing sync that dispatches to the correct provider. Example:

```
sync CountingMethodRouting [eager]
when {
  CountingMethod/aggregate: [ method: ?method; ballots: ?ballots; weights: ?weights ]
    => [ provider_error: ?method; error: _ ]
}
where {
  CountingMethod: { ?method provider: ?providerName }
  PluginRegistry: { ?p name: ?providerName; resolved: ?providerConcept }
}
then {
  // Dispatched to the resolved provider concept's count action
  // The specific routing target is determined by providerName
}
```

In practice, the sync engine resolves `?providerConcept` to one of Majority, Supermajority, QuadraticVoting, etc., and invokes its `count` or `configure` action.
