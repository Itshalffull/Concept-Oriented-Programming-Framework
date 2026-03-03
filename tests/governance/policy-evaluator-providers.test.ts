// ============================================================
// Policy Evaluator Provider Conformance Tests
//
// Tests for all 4 policy evaluator providers: CustomEvaluator,
// AdicoEvaluator, CedarEvaluator, and RegoEvaluator.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { customEvaluatorHandler } from '../../handlers/ts/app/governance/custom-evaluator.handler.js';
import { adicoEvaluatorHandler } from '../../handlers/ts/app/governance/adico-evaluator.handler.js';
import { cedarEvaluatorHandler } from '../../handlers/ts/app/governance/cedar-evaluator.handler.js';
import { regoEvaluatorHandler } from '../../handlers/ts/app/governance/rego-evaluator.handler.js';

describe('Policy Evaluator Providers', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ────────────────────────────────────────────────
  //  CustomEvaluator
  // ────────────────────────────────────────────────
  describe('CustomEvaluator', () => {
    it('evaluates a simple equality predicate', async () => {
      const reg = await customEvaluatorHandler.register({
        name: 'is-admin',
        source: { op: 'eq', field: 'role', value: 'admin' },
      }, storage);
      expect(reg.variant).toBe('registered');

      const allow = await customEvaluatorHandler.evaluate({
        evaluator: reg.evaluator,
        context: { role: 'admin' },
      }, storage);
      expect(allow.variant).toBe('result');
      expect(allow.output).toBe(true);
      expect(allow.decision).toBe('allow');

      const deny = await customEvaluatorHandler.evaluate({
        evaluator: reg.evaluator,
        context: { role: 'user' },
      }, storage);
      expect(deny.output).toBe(false);
      expect(deny.decision).toBe('deny');
    });

    it('evaluates compound and/or predicates', async () => {
      const reg = await customEvaluatorHandler.register({
        name: 'complex-rule',
        source: {
          op: 'and',
          args: [
            { op: 'eq', field: 'role', value: 'member' },
            { op: 'gte', field: 'reputation', value: 50 },
          ],
        },
      }, storage);

      const pass = await customEvaluatorHandler.evaluate({
        evaluator: reg.evaluator,
        context: { role: 'member', reputation: 75 },
      }, storage);
      expect(pass.output).toBe(true);

      const fail = await customEvaluatorHandler.evaluate({
        evaluator: reg.evaluator,
        context: { role: 'member', reputation: 25 },
      }, storage);
      expect(fail.output).toBe(false);
    });

    it('evaluates not/in/contains predicates', async () => {
      const reg = await customEvaluatorHandler.register({
        name: 'not-banned',
        source: {
          op: 'not',
          args: [{ op: 'in', field: 'user', value: ['banned1', 'banned2'] }],
        },
      }, storage);

      const allowed = await customEvaluatorHandler.evaluate({
        evaluator: reg.evaluator,
        context: { user: 'alice' },
      }, storage);
      expect(allowed.output).toBe(true);

      const blocked = await customEvaluatorHandler.evaluate({
        evaluator: reg.evaluator,
        context: { user: 'banned1' },
      }, storage);
      expect(blocked.output).toBe(false);
    });

    it('deregisters an evaluator', async () => {
      const reg = await customEvaluatorHandler.register({
        name: 'temp',
        source: { op: 'eq', field: 'x', value: 1 },
      }, storage);
      const dereg = await customEvaluatorHandler.deregister(
        { evaluator: reg.evaluator },
        storage,
      );
      expect(dereg.variant).toBe('deregistered');

      const missing = await customEvaluatorHandler.evaluate({
        evaluator: reg.evaluator,
        context: {},
      }, storage);
      expect(missing.variant).toBe('not_found');
    });
  });

  // ────────────────────────────────────────────────
  //  AdicoEvaluator
  // ────────────────────────────────────────────────
  describe('AdicoEvaluator', () => {
    it('parses an ADICO grammar rule', async () => {
      const result = await adicoEvaluatorHandler.parse({
        ruleText: 'A(member) D(must) I(vote) C(during-session)',
      }, storage);
      expect(result.variant).toBe('parsed');
      expect(result.rule).toBeDefined();
    });

    it('evaluates a must-obligation', async () => {
      const parse = await adicoEvaluatorHandler.parse({
        ruleText: 'A(member) D(must) I(vote) C(always)',
      }, storage);
      const result = await adicoEvaluatorHandler.evaluate({
        rule: parse.rule,
        context: { actor: 'alice', role: 'member', action: 'vote' },
      }, storage);
      expect(result.variant).toBe('obligated');
    });

    it('evaluates a must-not prohibition', async () => {
      const parse = await adicoEvaluatorHandler.parse({
        ruleText: 'A(guest) D(must not) I(vote) C(always)',
      }, storage);
      const result = await adicoEvaluatorHandler.evaluate({
        rule: parse.rule,
        context: { actor: 'bob', role: 'guest', action: 'vote' },
      }, storage);
      expect(result.variant).toBe('forbidden');
    });

    it('returns not_applicable for mismatched actor', async () => {
      const parse = await adicoEvaluatorHandler.parse({
        ruleText: 'A(admin) D(may) I(delete) C(always)',
      }, storage);
      const result = await adicoEvaluatorHandler.evaluate({
        rule: parse.rule,
        context: { actor: 'user', role: 'member', action: 'delete' },
      }, storage);
      expect(result.variant).toBe('not_applicable');
    });
  });

  // ────────────────────────────────────────────────
  //  CedarEvaluator
  // ────────────────────────────────────────────────
  describe('CedarEvaluator', () => {
    it('permits authorized action', async () => {
      const loaded = await cedarEvaluatorHandler.loadPolicies({
        policies: [
          { effect: 'permit', principal: 'alice', action: 'read', resource: 'doc-1' },
        ],
      }, storage);
      expect(loaded.variant).toBe('loaded');

      const result = await cedarEvaluatorHandler.authorize({
        store: loaded.store,
        principal: 'alice',
        action: 'read',
        resource: 'doc-1',
      }, storage);
      expect(result.variant).toBe('allow');
    });

    it('denies with no matching permit', async () => {
      const loaded = await cedarEvaluatorHandler.loadPolicies({
        policies: [
          { effect: 'permit', principal: 'alice', action: 'read', resource: 'doc-1' },
        ],
      }, storage);

      const result = await cedarEvaluatorHandler.authorize({
        store: loaded.store,
        principal: 'bob',
        action: 'read',
        resource: 'doc-1',
      }, storage);
      expect(result.variant).toBe('deny');
      expect(result.reason).toContain('No matching permit');
    });

    it('forbid overrides permit', async () => {
      const loaded = await cedarEvaluatorHandler.loadPolicies({
        policies: [
          { effect: 'permit', principal: '*', action: 'read', resource: '*' },
          { effect: 'forbid', principal: 'alice', action: 'read', resource: 'secret' },
        ],
      }, storage);

      const allowed = await cedarEvaluatorHandler.authorize({
        store: loaded.store,
        principal: 'bob',
        action: 'read',
        resource: 'secret',
      }, storage);
      expect(allowed.variant).toBe('allow');

      const denied = await cedarEvaluatorHandler.authorize({
        store: loaded.store,
        principal: 'alice',
        action: 'read',
        resource: 'secret',
      }, storage);
      expect(denied.variant).toBe('deny');
    });

    it('verifies no policy conflicts', async () => {
      const loaded = await cedarEvaluatorHandler.loadPolicies({
        policies: [
          { effect: 'permit', principal: 'alice', action: 'read', resource: 'doc' },
        ],
      }, storage);

      const verify = await cedarEvaluatorHandler.verify({
        store: loaded.store,
        property: 'no_conflicts',
      }, storage);
      expect(verify.variant).toBe('verified');
    });

    it('detects policy conflicts', async () => {
      const loaded = await cedarEvaluatorHandler.loadPolicies({
        policies: [
          { effect: 'permit', principal: 'alice', action: 'read', resource: 'doc' },
          { effect: 'forbid', principal: 'alice', action: 'read', resource: 'doc' },
        ],
      }, storage);

      const verify = await cedarEvaluatorHandler.verify({
        store: loaded.store,
        property: 'no_conflicts',
      }, storage);
      expect(verify.variant).toBe('conflict_found');
    });
  });

  // ────────────────────────────────────────────────
  //  RegoEvaluator
  // ────────────────────────────────────────────────
  describe('RegoEvaluator', () => {
    it('evaluates allow rule against input', async () => {
      const bundle = await regoEvaluatorHandler.loadBundle({
        policySource: [
          {
            name: 'allow',
            body: [
              { op: 'eq', path: 'role', value: 'admin' },
            ],
          },
        ],
        dataSource: {},
        packageName: 'authz',
      }, storage);
      expect(bundle.variant).toBe('loaded');

      const result = await regoEvaluatorHandler.evaluate({
        bundle: bundle.bundle,
        input: { role: 'admin' },
      }, storage);
      expect(result.variant).toBe('result');
      expect(result.decision).toBe('allow');
    });

    it('denies when rules do not match', async () => {
      const bundle = await regoEvaluatorHandler.loadBundle({
        policySource: [
          {
            name: 'allow',
            body: [{ op: 'eq', path: 'role', value: 'admin' }],
          },
        ],
        dataSource: {},
        packageName: 'authz',
      }, storage);

      const result = await regoEvaluatorHandler.evaluate({
        bundle: bundle.bundle,
        input: { role: 'guest' },
      }, storage);
      expect(result.decision).toBe('deny');
    });

    it('uses data lookups in rules', async () => {
      const bundle = await regoEvaluatorHandler.loadBundle({
        policySource: [
          {
            name: 'allow',
            body: [
              { op: 'in', path: 'user', dataPath: 'allowedUsers' },
            ],
          },
        ],
        dataSource: { allowedUsers: ['alice', 'bob'] },
        packageName: 'authz',
      }, storage);

      const allowed = await regoEvaluatorHandler.evaluate({
        bundle: bundle.bundle,
        input: { user: 'alice' },
      }, storage);
      expect(allowed.decision).toBe('allow');

      const denied = await regoEvaluatorHandler.evaluate({
        bundle: bundle.bundle,
        input: { user: 'charlie' },
      }, storage);
      expect(denied.decision).toBe('deny');
    });

    it('updates data in a bundle', async () => {
      const bundle = await regoEvaluatorHandler.loadBundle({
        policySource: [
          {
            name: 'allow',
            body: [{ op: 'in', path: 'user', dataPath: 'admins' }],
          },
        ],
        dataSource: { admins: ['alice'] },
        packageName: 'authz',
      }, storage);

      // Charlie is not in admins yet
      const before = await regoEvaluatorHandler.evaluate({
        bundle: bundle.bundle,
        input: { user: 'charlie' },
      }, storage);
      expect(before.decision).toBe('deny');

      // Add charlie to admins
      await regoEvaluatorHandler.updateData({
        bundle: bundle.bundle,
        newData: { admins: ['alice', 'charlie'] },
      }, storage);

      const after = await regoEvaluatorHandler.evaluate({
        bundle: bundle.bundle,
        input: { user: 'charlie' },
      }, storage);
      expect(after.decision).toBe('allow');
    });
  });
});
