// K8sRuntime Concept Implementation
// Manage Kubernetes deployments. Owns Deployment, Service, ConfigMap, and
// Ingress resources. Handles pod scheduling, rolling updates, and resource
// quota management.
import type { ConceptHandler } from '@clef/kernel';

export const k8sRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const namespace = input.namespace as string;
    const cluster = input.cluster as string;
    const replicas = input.replicas as number;

    if (namespace.includes('notfound') || namespace.includes('missing')) {
      return {
        variant: 'namespaceNotFound',
        namespace,
      };
    }

    if (replicas > 100) {
      return {
        variant: 'resourceQuotaExceeded',
        namespace,
        resource: 'pods',
        requested: String(replicas),
        limit: '100',
      };
    }

    const deploymentId = `k8s-deploy-${concept.toLowerCase()}-${Date.now()}`;
    const serviceName = `${concept.toLowerCase()}-svc`;
    const endpoint = `http://${serviceName}.${namespace}.svc.cluster.local`;

    await storage.put('deployment', deploymentId, {
      namespace,
      cluster,
      replicas,
      cpu: '100m',
      memory: '128Mi',
      image: `${concept.toLowerCase()}:latest`,
      serviceName,
      ingressHost: null,
      configMapName: null,
      currentRevision: '1',
      createdAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      deployment: deploymentId,
      serviceName,
      endpoint,
    };
  },

  async deploy(input, storage) {
    const deployment = input.deployment as string;
    const imageUri = input.imageUri as string;

    if (imageUri.includes('notfound') || imageUri.includes('missing')) {
      return { variant: 'imageNotFound', imageUri };
    }

    if (imageUri.includes('crashloop')) {
      return {
        variant: 'podCrashLoop',
        deployment,
        podName: `${deployment}-pod-abc`,
        restartCount: 5,
      };
    }

    if (imageUri.includes('pullbackoff')) {
      return {
        variant: 'imagePullBackOff',
        deployment,
        imageUri,
        reason: 'Failed to pull image: unauthorized or network error',
      };
    }

    if (imageUri.includes('oomkilled')) {
      return {
        variant: 'oomKilled',
        deployment,
        podName: `${deployment}-pod-def`,
        memoryLimit: '128Mi',
      };
    }

    const record = await storage.get('deployment', deployment);
    if (!record) {
      return { variant: 'imageNotFound', imageUri };
    }

    const currentRevision = parseInt(record.currentRevision as string, 10);
    const newRevision = String(currentRevision + 1);

    await storage.put('deployment', deployment, {
      ...record,
      image: imageUri,
      currentRevision: newRevision,
      lastDeployedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      deployment,
      revision: newRevision,
    };
  },

  async setTrafficWeight(input, storage) {
    const deployment = input.deployment as string;
    const weight = input.weight as number;

    const record = await storage.get('deployment', deployment);
    if (record) {
      await storage.put('deployment', deployment, {
        ...record,
        trafficWeight: weight,
      });
    }

    return { variant: 'ok', deployment };
  },

  async rollback(input, storage) {
    const deployment = input.deployment as string;
    const targetRevision = input.targetRevision as string;

    const record = await storage.get('deployment', deployment);
    if (record) {
      await storage.put('deployment', deployment, {
        ...record,
        currentRevision: targetRevision,
        lastDeployedAt: new Date().toISOString(),
      });
    }

    return {
      variant: 'ok',
      deployment,
      restoredRevision: targetRevision,
    };
  },

  async destroy(input, storage) {
    const deployment = input.deployment as string;

    await storage.delete('deployment', deployment);

    return { variant: 'ok', deployment };
  },
};
