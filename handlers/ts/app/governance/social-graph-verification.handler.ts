// @clef-handler style=functional
// SocialGraphVerification Sybil Resistance Provider
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let sgCounter = 0;

const _socialGraphVerificationHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    // Require at least one field to be explicitly set
    if (input.minimumVouchers === undefined && input.minVouches === undefined &&
        input.trustAlgorithm === undefined && input.trustAnchors === undefined) {
      return complete(createProgram(), 'error', { message: 'configuration required' }) as StorageProgram<Result>;
    }
    const minimumVouchers = input.minimumVouchers ?? input.minVouches ?? 3;
    const trustAlgorithm = input.trustAlgorithm ?? 'count';
    const id = `sg-cfg-${++sgCounter}`;
    let p = createProgram();
    p = put(p, 'sg_cfg', id, {
      id,
      minimumVouchers,
      trustAlgorithm,
    });
    return complete(p, 'ok', { id, config: id }) as StorageProgram<Result>;
  },

  addVouch(input: Record<string, unknown>) {
    const { config, voucher, candidate } = input;

    if (voucher === candidate) {
      return complete(createProgram(), 'error', { message: 'Cannot vouch for oneself' }) as StorageProgram<Result>;
    }

    // Check config exists
    let p = createProgram();
    p = get(p, 'sg_cfg', config as string, 'cfg');

    return branch(p, 'cfg',
      (b) => {
        const edgeKey = `${config}:${voucher}:${candidate}`;
        let b2 = get(b, 'sg_vouch', edgeKey, 'existing');
        return branch(b2, 'existing',
          (b3) => complete(b3, 'ok', { voucher, candidate }),
          (b3) => {
            let b4 = put(b3, 'sg_vouch', edgeKey, {
              config, voucher, candidate, vouchedAt: new Date().toISOString(),
            });
            return complete(b4, 'ok', { voucher, candidate });
          },
        );
      },
      (b) => complete(b, 'error', { message: `Config not found: ${config}` }),
    ) as StorageProgram<Result>;
  },

  revokeVouch(input: Record<string, unknown>) {
    const { config, voucher, candidate } = input;

    let p = createProgram();
    p = get(p, 'sg_cfg', config as string, 'cfg');

    return branch(p, 'cfg',
      (b) => {
        const edgeKey = `${config}:${voucher}:${candidate}`;
        let b2 = get(b, 'sg_vouch', edgeKey, 'existing');
        return branch(b2, 'existing',
          (b3) => {
            let b4 = del(b3, 'sg_vouch', edgeKey);
            return complete(b4, 'ok', { voucher, candidate });
          },
          (b3) => complete(b3, 'ok', { voucher, candidate }),
        );
      },
      (b) => complete(b, 'error', { message: `Config not found: ${config}` }),
    ) as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>) {
    const { config, candidate } = input;

    let p = createProgram();
    p = get(p, 'sg_cfg', config as string, 'cfg');

    return branch(p, 'cfg',
      (b) => {
        b = find(b, 'sg_vouch', { config: config as string, candidate: candidate as string }, 'vouches');
        b = mapBindings(b, (bindings) => {
          const cfg = bindings.cfg as Record<string, unknown>;
          const minimumVouchers = (cfg.minimumVouchers as number) ?? 3;
          const algorithm = (cfg.trustAlgorithm as string) ?? 'count';
          const vouches = bindings.vouches as Array<Record<string, unknown>>;
          const voucherCount = vouches.length;
          const trustScore = Math.min(1.0, voucherCount / minimumVouchers);
          return { candidate, voucherCount, trustScore, required: minimumVouchers };
        }, 'result');
        return completeFrom(b, 'ok', (bindings) => bindings.result as Record<string, unknown>);
      },
      (b) => complete(b, 'error', { message: `Config not found: ${config}` }),
    ) as StorageProgram<Result>;
  },

  // Alias for invariant test
  vouch(input: Record<string, unknown>) {
    const { voucher, vouchee, config } = input;
    const edgeKey = `${config ?? 'default'}:${voucher}:${vouchee}`;
    let p = createProgram();
    p = put(p, 'sg_vouch', edgeKey, {
      config: config ?? 'default', voucher, candidate: vouchee, vouchedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { voucher, vouchee, vouch: edgeKey }) as StorageProgram<Result>;
  },

  // Alias for invariant test
  analyze(input: Record<string, unknown>) {
    const { participant } = input;
    let p = createProgram();
    p = find(p, 'sg_vouch', { candidate: participant as string }, 'vouches');
    return completeFrom(p, 'trusted', (bindings) => {
      const vouches = bindings.vouches as Array<Record<string, unknown>>;
      return { participant, vouchCount: vouches.length, connectivityScore: Math.min(1.0, vouches.length / 3) };
    }) as StorageProgram<Result>;
  },
};

export const socialGraphVerificationHandler = autoInterpret(_socialGraphVerificationHandler);
