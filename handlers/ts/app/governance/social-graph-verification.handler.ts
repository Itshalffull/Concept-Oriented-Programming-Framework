// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// SocialGraphVerification Sybil Resistance Provider
// Vouch-based identity: participants vouch for each other, trust score from vouch network.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _socialGraphVerificationHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `sg-cfg-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'sg_cfg', id, {
      id,
      minimumVouchers: input.minimumVouchers ?? 3,
      trustAlgorithm: input.trustAlgorithm ?? 'count',
    });
    p = put(p, 'plugin-registry', `sybil-method:${id}`, {
      id: `sybil-method:${id}`,
      pluginKind: 'sybil-method',
      provider: 'SocialGraphVerification',
      instanceId: id,
    });
    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  addVouch(input: Record<string, unknown>) {
    const { config, voucher, candidate } = input;
    if (voucher === candidate) {
      let p = createProgram();
      return complete(p, 'self_vouch', { voucher }) as StorageProgram<Result>;
    }

    const edgeKey = `${config}:${voucher}:${candidate}`;
    let p = createProgram();
    p = get(p, 'sg_vouch', edgeKey, 'existing');

    p = branch(p, 'existing',
      (b) => complete(b, 'already_vouched', { voucher, candidate }),
      (b) => {
        let b2 = put(b, 'sg_vouch', edgeKey, {
          config,
          voucher,
          candidate,
          vouchedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { voucher, candidate });
      },
    );

    return p as StorageProgram<Result>;
  },

  revokeVouch(input: Record<string, unknown>) {
    const { config, voucher, candidate } = input;
    const edgeKey = `${config}:${voucher}:${candidate}`;
    let p = createProgram();
    p = get(p, 'sg_vouch', edgeKey, 'existing');

    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'sg_vouch', edgeKey);
        return complete(b2, 'ok', { voucher, candidate });
      },
      (b) => complete(b, 'not_found', { voucher, candidate }),
    );

    return p as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>) {
    const { config, candidate } = input;
    let p = createProgram();
    p = get(p, 'sg_cfg', config as string, 'cfg');
    p = find(p, 'sg_vouch', { config: config as string, candidate: candidate as string }, 'vouches');

    p = mapBindings(p, (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const minimumVouchers = cfg ? (cfg.minimumVouchers as number) : 3;
      const algorithm = cfg ? (cfg.trustAlgorithm as string) : 'count';
      const vouches = bindings.vouches as Array<Record<string, unknown>>;
      const voucherCount = vouches.length;

      let trustScore: number;
      if (algorithm === 'count') {
        trustScore = voucherCount / minimumVouchers;
      } else {
        trustScore = Math.min(1.0, voucherCount / minimumVouchers);
      }

      if (voucherCount >= minimumVouchers) {
        return { variant: 'verified', candidate, voucherCount, trustScore };
      }
      return { variant: 'insufficient', candidate, voucherCount, required: minimumVouchers, trustScore };
    }, 'verifyResult');

    return completeFrom(p, 'verified', (bindings) => {
      return bindings.verifyResult as Record<string, unknown>;
    }) as StorageProgram<Result>;
  },
};

export const socialGraphVerificationHandler = autoInterpret(_socialGraphVerificationHandler);
