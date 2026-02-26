// PySdkTarget Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const pySdkTargetHandler: ConceptHandler = {
  async generate(input, storage) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const packageName = (parsedConfig.packageName as string) || 'clef_sdk';
    const asyncSupport = (parsedConfig.asyncSupport as boolean) ?? true;

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '_');
    const className = conceptName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

    const modelsFile = [
      `"""Models for ${className} SDK."""`,
      `from __future__ import annotations`,
      ``,
      `from dataclasses import dataclass`,
      `from datetime import datetime`,
      `from typing import Optional, Literal`,
      ``,
      ``,
      `@dataclass`,
      `class ${className}:`,
      `    """${className} entity."""`,
      `    id: str`,
      `    name: str`,
      `    created_at: datetime`,
      `    updated_at: datetime`,
      ``,
      ``,
      `@dataclass`,
      `class Create${className}Input:`,
      `    """Input for creating a ${className}."""`,
      `    name: str`,
      ``,
      ``,
      `@dataclass`,
      `class Update${className}Input:`,
      `    """Input for updating a ${className}."""`,
      `    name: Optional[str] = None`,
      ``,
      ``,
      `@dataclass`,
      `class ${className}ResultOk:`,
      `    """Successful result."""`,
      `    variant: Literal["ok"] = "ok"`,
      `    value: Optional[${className}] = None`,
      ``,
      ``,
      `@dataclass`,
      `class ${className}ResultError:`,
      `    """Error result."""`,
      `    variant: Literal["error"] = "error"`,
      `    message: str = ""`,
      ``,
      ``,
      `${className}Result = ${className}ResultOk | ${className}ResultError`,
    ].join('\n');

    const asyncPrefix = asyncSupport ? 'async ' : '';
    const awaitPrefix = asyncSupport ? 'await ' : '';
    const httpLib = asyncSupport ? 'httpx' : 'requests';

    const clientFile = [
      `"""Client for ${className} SDK."""`,
      `from __future__ import annotations`,
      ``,
      asyncSupport ? `import httpx` : `import requests`,
      `from typing import List, Optional`,
      ``,
      `from .models import (`,
      `    ${className},`,
      `    Create${className}Input,`,
      `    Update${className}Input,`,
      `)`,
      ``,
      ``,
      `class ${className}Client:`,
      `    """Client for ${className} operations."""`,
      ``,
      `    def __init__(self, base_url: str, api_key: Optional[str] = None) -> None:`,
      `        self.base_url = base_url`,
      `        self.api_key = api_key`,
      asyncSupport
        ? `        self._client = httpx.AsyncClient(base_url=base_url)`
        : `        self._session = requests.Session()`,
      ``,
      `    ${asyncPrefix}def create(self, input: Create${className}Input) -> ${className}:`,
      `        """Create a new ${className}."""`,
      asyncSupport
        ? `        response = await self._client.post("/${conceptName}", json={"name": input.name})`
        : `        response = self._session.post(f"{self.base_url}/${conceptName}", json={"name": input.name})`,
      `        response.raise_for_status()`,
      `        return ${className}(**response.json())`,
      ``,
      `    ${asyncPrefix}def get(self, id: str) -> ${className}:`,
      `        """Get a ${className} by ID."""`,
      asyncSupport
        ? `        response = await self._client.get(f"/${conceptName}/{id}")`
        : `        response = self._session.get(f"{self.base_url}/${conceptName}/{id}")`,
      `        response.raise_for_status()`,
      `        return ${className}(**response.json())`,
      ``,
      `    ${asyncPrefix}def list(self) -> List[${className}]:`,
      `        """List all ${className} entries."""`,
      asyncSupport
        ? `        response = await self._client.get("/${conceptName}")`
        : `        response = self._session.get(f"{self.base_url}/${conceptName}")`,
      `        response.raise_for_status()`,
      `        return [${className}(**item) for item in response.json()]`,
      ``,
      `    ${asyncPrefix}def update(self, id: str, input: Update${className}Input) -> ${className}:`,
      `        """Update a ${className}."""`,
      asyncSupport
        ? `        response = await self._client.put(f"/${conceptName}/{id}", json={"name": input.name})`
        : `        response = self._session.put(f"{self.base_url}/${conceptName}/{id}", json={"name": input.name})`,
      `        response.raise_for_status()`,
      `        return ${className}(**response.json())`,
      ``,
      `    ${asyncPrefix}def delete(self, id: str) -> None:`,
      `        """Delete a ${className}."""`,
      asyncSupport
        ? `        response = await self._client.delete(f"/${conceptName}/{id}")`
        : `        response = self._session.delete(f"{self.base_url}/${conceptName}/{id}")`,
      `        response.raise_for_status()`,
    ].join('\n');

    const initFile = [
      `"""${packageName} - Generated Python SDK."""`,
      `from .client import ${className}Client`,
      `from .models import (`,
      `    ${className},`,
      `    Create${className}Input,`,
      `    Update${className}Input,`,
      `)`,
      ``,
      `__all__ = [`,
      `    "${className}Client",`,
      `    "${className}",`,
      `    "Create${className}Input",`,
      `    "Update${className}Input",`,
      `]`,
    ].join('\n');

    const pyprojectFile = [
      `[build-system]`,
      `requires = ["setuptools>=68.0"]`,
      `build-backend = "setuptools.build_meta"`,
      ``,
      `[project]`,
      `name = "${packageName}"`,
      `version = "1.0.0"`,
      `description = "Generated Python SDK for ${className}"`,
      `requires-python = ">=3.10"`,
      `dependencies = [`,
      asyncSupport ? `    "httpx>=0.24.0",` : `    "requests>=2.31.0",`,
      `]`,
    ].join('\n');

    const files = [
      `${packageName}/__init__.py`,
      `${packageName}/client.py`,
      `${packageName}/models.py`,
      `${packageName}/py.typed`,
      `pyproject.toml`,
    ];

    const packageId = `py-sdk-${conceptName}-${Date.now()}`;

    await storage.put('package', packageId, {
      packageId,
      packageName,
      asyncSupport,
      projection,
      config,
      files: JSON.stringify(files),
      modelsFile,
      clientFile,
      initFile,
      pyprojectFile,
      generatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      package: packageId,
      files,
    };
  },
};
