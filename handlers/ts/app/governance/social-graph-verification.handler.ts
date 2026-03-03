// SocialGraphVerification Sybil Resistance Provider
// Vouch-based identity: participants vouch for each other, trust score from vouch network.
import type { ConceptHandler } from '@clef/runtime';

export const socialGraphVerificationHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `sg-cfg-${Date.now()}`;
    await storage.put('sg_cfg', id, {
      id,
      minimumVouchers: input.minimumVouchers ?? 3,
      trustAlgorithm: input.trustAlgorithm ?? 'count',
    });

    await storage.put('plugin-registry', `sybil-method:${id}`, {
      id: `sybil-method:${id}`,
      pluginKind: 'sybil-method',
      provider: 'SocialGraphVerification',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async addVouch(input, storage) {
    const { config, voucher, candidate } = input;
    if (voucher === candidate) return { variant: 'self_vouch', voucher };

    const edgeKey = `${config}:${voucher}:${candidate}`;
    const existing = await storage.get('sg_vouch', edgeKey);
    if (existing) return { variant: 'already_vouched', voucher, candidate };

    await storage.put('sg_vouch', edgeKey, {
      config,
      voucher,
      candidate,
      vouchedAt: new Date().toISOString(),
    });

    return { variant: 'vouched', voucher, candidate };
  },

  async revokeVouch(input, storage) {
    const { config, voucher, candidate } = input;
    const edgeKey = `${config}:${voucher}:${candidate}`;
    const existing = await storage.get('sg_vouch', edgeKey);
    if (!existing) return { variant: 'not_found', voucher, candidate };

    await storage.del('sg_vouch', edgeKey);
    return { variant: 'revoked', voucher, candidate };
  },

  async verify(input, storage) {
    const { config, candidate } = input;
    const cfg = await storage.get('sg_cfg', config as string);
    const minimumVouchers = cfg ? (cfg.minimumVouchers as number) : 3;
    const algorithm = cfg ? (cfg.trustAlgorithm as string) : 'count';

    const vouches = await storage.find('sg_vouch', { config: config as string, candidate: candidate as string });
    const voucherCount = vouches.length;

    let trustScore: number;
    if (algorithm === 'count') {
      trustScore = voucherCount / minimumVouchers;
    } else {
      // normalized: cap at 1.0
      trustScore = Math.min(1.0, voucherCount / minimumVouchers);
    }

    if (voucherCount >= minimumVouchers) {
      return { variant: 'verified', candidate, voucherCount, trustScore };
    }
    return { variant: 'insufficient', candidate, voucherCount, required: minimumVouchers, trustScore };
  },
};
