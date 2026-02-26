// K8sRuntime Concept Implementation
// Kubernetes provider for the Runtime coordination concept. Manages
// Deployment, Service, ConfigMap, and Ingress resource lifecycle.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'k8s';

export const k8sRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const namespace = input.namespace as string;
    const cluster = input.cluster as string;
    const replicas = input.replicas as number;

    const deploymentId = `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const serviceName = `${concept}-svc`;
    const endpoint = `http://${serviceName}.${namespace}.svc.cluster.local`;

    await storage.put(RELATION, deploymentId, {
      deployment: deploymentId,
      concept,
      namespace,
      cluster,
      replicas,
      serviceName,
      endpoint,
      currentRevision: '',
      image: '',
      status: 'provisioned',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', deployment: deploymentId, serviceName, endpoint };
  },

  async deploy(input, storage) {
    const deployment = input.deployment as string;
    const imageUri = input.imageUri as string;

    const record = await storage.get(RELATION, deployment);
    if (!record) {
      return { variant: 'imageNotFound', imageUri };
    }

    // Simulate imagePullBackOff for private registries without auth
    if (input.simulatePullBackOff) {
      return {
        variant: 'imagePullBackOff',
        deployment,
        imageUri,
        reason: 'unauthorized: authentication required',
      };
    }

    // Simulate OOM kill when memory limit is exceeded
    if (input.simulateOomKill) {
      return {
        variant: 'oomKilled',
        deployment,
        podName: `${deployment}-pod-${Math.random().toString(36).slice(2, 8)}`,
        memoryLimit: (record.memory as string) || '512Mi',
      };
    }

    const prevRevision = record.currentRevision as string || '0';
    const revNum = prevRevision ? parseInt(prevRevision, 10) || 0 : 0;
    const revision = String(revNum + 1);

    await storage.put(RELATION, deployment, {
      ...record,
      currentRevision: revision,
      image: imageUri,
      status: 'deployed',
      deployedAt: new Date().toISOString(),
    });

    return { variant: 'ok', deployment, revision };
  },

  async setTrafficWeight(input, storage) {
    const deployment = input.deployment as string;
    const weight = input.weight as number;

    const record = await storage.get(RELATION, deployment);
    if (record) {
      await storage.put(RELATION, deployment, { ...record, trafficWeight: weight });
    }

    return { variant: 'ok', deployment };
  },

  async rollback(input, storage) {
    const deployment = input.deployment as string;
    const targetRevision = input.targetRevision as string;

    const record = await storage.get(RELATION, deployment);
    if (record) {
      await storage.put(RELATION, deployment, {
        ...record,
        currentRevision: targetRevision,
        status: 'rolledback',
      });
    }

    return { variant: 'ok', deployment, restoredRevision: targetRevision };
  },

  async destroy(input, storage) {
    const deployment = input.deployment as string;

    const record = await storage.get(RELATION, deployment);
    if (!record) {
      return { variant: 'ok', deployment };
    }

    await storage.del(RELATION, deployment);
    return { variant: 'ok', deployment };
  },
};
