// @migrated dsl-constructs 2026-03-18
// JavaSdkTarget Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _javaSdkTargetHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const groupId = (parsedConfig.groupId as string) || 'com.clef.sdk';
    const artifactId = (parsedConfig.artifactId as string) || 'clef-java-sdk';
    const javaVersion = (parsedConfig.javaVersion as string) || '17';

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '');
    const className = conceptName.charAt(0).toUpperCase() + conceptName.slice(1);
    const packagePath = groupId.replace(/\./g, '/');

    const files = [
      `src/main/java/${packagePath}/model/${className}.java`,
      `src/main/java/${packagePath}/model/Create${className}Input.java`,
      `src/main/java/${packagePath}/result/${className}Result.java`,
      `src/main/java/${packagePath}/${className}Client.java`,
      `pom.xml`,
    ];

    const artifactIdentifier = `java-sdk-${conceptName}-${Date.now()}`;

    let p = createProgram();
    p = put(p, 'artifact', artifactIdentifier, {
      artifactId: artifactIdentifier,
      groupId,
      artifactName: artifactId,
      javaVersion,
      projection,
      config,
      files: JSON.stringify(files),
      modelFile: '',
      createInputFile: '',
      resultFile: '',
      clientFile: '',
      pomFile: '',
      generatedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      artifact: artifactIdentifier,
      files,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const javaSdkTargetHandler = autoInterpret(_javaSdkTargetHandler);

