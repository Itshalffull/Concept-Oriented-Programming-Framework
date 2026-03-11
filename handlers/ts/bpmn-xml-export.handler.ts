// ============================================================
// BpmnXmlExportProvider Handler
//
// Export provider for BPMN 2.0 XML format. Generates process
// definitions with BPMN Diagram Interchange (BPMNDI) layout
// data. Supports import of BPMN XML documents.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const bpmnXmlExportHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    const existing = await storage.get('export-provider', 'bpmn-xml');
    if (existing) {
      return { variant: 'ok', name: 'bpmn-xml', category: 'diagram_export' };
    }

    await storage.put('export-provider', 'bpmn-xml', {
      id: 'bpmn-xml',
      name: 'bpmn-xml',
      category: 'diagram_export',
      mime_type: 'application/xml',
      supports_import: true,
    });

    return { variant: 'ok', name: 'bpmn-xml', category: 'diagram_export' };
  },

  async export(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const options = (input.options as Record<string, unknown>) ?? {};

    const processId = (options.process_id as string) ?? `process_${canvasId}`;
    const processName = (options.process_name as string) ?? 'Exported Process';

    const items = await storage.find('canvas-item', { canvas: canvasId });
    const connectors = await storage.find('canvas-connector', { canvas: canvasId });

    const parts: string[] = [];

    // XML declaration and BPMN definitions root
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"');
    parts.push('                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"');
    parts.push('                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"');
    parts.push('                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"');
    parts.push(`                  id="Definitions_1" targetNamespace="http://clef.dev/bpmn">`);

    // Process definition
    parts.push(`  <bpmn:process id="${escapeXml(processId)}" name="${escapeXml(processName)}" isExecutable="false">`);

    // Build id map
    const idMap = new Map<string, string>();
    let idx = 0;
    for (const item of items) {
      const bpmnId = toBpmnId(item.id as string, idx++);
      idMap.set(item.id as string, bpmnId);
    }

    // Emit BPMN elements from canvas items
    for (const item of items) {
      const bpmnId = idMap.get(item.id as string)!;
      const label = (item.label as string) ?? '';
      const shape = (item.shape as string) ?? 'rectangle';
      const bpmnType = mapShapeToBpmnType(shape);

      parts.push(`    <bpmn:${bpmnType} id="${bpmnId}" name="${escapeXml(label)}" />`);
    }

    // Emit sequence flows from connectors
    let flowIdx = 0;
    for (const conn of connectors) {
      const sourceRef = idMap.get(conn.source as string);
      const targetRef = idMap.get(conn.target as string);
      if (!sourceRef || !targetRef) continue;

      const flowId = `Flow_${flowIdx++}`;
      const label = (conn.label as string) ?? '';
      parts.push(`    <bpmn:sequenceFlow id="${flowId}" name="${escapeXml(label)}" sourceRef="${sourceRef}" targetRef="${targetRef}" />`);
    }

    parts.push('  </bpmn:process>');

    // BPMN Diagram Interchange
    parts.push(`  <bpmndi:BPMNDiagram id="BPMNDiagram_1">`);
    parts.push(`    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${escapeXml(processId)}">`);

    // Shape bounds
    for (const item of items) {
      const bpmnId = idMap.get(item.id as string)!;
      const x = (item.x as number) ?? 0;
      const y = (item.y as number) ?? 0;
      const w = (item.width as number) ?? 100;
      const h = (item.height as number) ?? 80;

      parts.push(`      <bpmndi:BPMNShape id="${bpmnId}_di" bpmnElement="${bpmnId}">`);
      parts.push(`        <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />`);
      parts.push('      </bpmndi:BPMNShape>');
    }

    // Edge waypoints
    flowIdx = 0;
    for (const conn of connectors) {
      const sourceItem = items.find((i) => i.id === conn.source);
      const targetItem = items.find((i) => i.id === conn.target);
      if (!sourceItem || !targetItem) { flowIdx++; continue; }

      const flowId = `Flow_${flowIdx++}`;
      const sx = ((sourceItem.x as number) ?? 0) + (((sourceItem.width as number) ?? 100) / 2);
      const sy = ((sourceItem.y as number) ?? 0) + (((sourceItem.height as number) ?? 80) / 2);
      const tx = ((targetItem.x as number) ?? 0) + (((targetItem.width as number) ?? 100) / 2);
      const ty = ((targetItem.y as number) ?? 0) + (((targetItem.height as number) ?? 80) / 2);

      parts.push(`      <bpmndi:BPMNEdge id="${flowId}_di" bpmnElement="${flowId}">`);
      parts.push(`        <di:waypoint x="${sx}" y="${sy}" />`);
      parts.push(`        <di:waypoint x="${tx}" y="${ty}" />`);
      parts.push('      </bpmndi:BPMNEdge>');
    }

    parts.push('    </bpmndi:BPMNPlane>');
    parts.push('  </bpmndi:BPMNDiagram>');
    parts.push('</bpmn:definitions>');

    const output = parts.join('\n');
    return { variant: 'ok', data: output, mime_type: 'application/xml' };
  },

  async importData(input: Record<string, unknown>, storage: ConceptStorage) {
    const data = input.data as string;
    const targetCanvas = (input.target_canvas as string) ?? 'canvas-import';

    let itemsCreated = 0;
    let connectorsCreated = 0;

    // Parse BPMN elements (task, event, gateway, etc.)
    const elementPattern = /<bpmn:(\w+)\s[^>]*id="([^"]*)"[^>]*(?:name="([^"]*)")?[^>]*\/?>/g;
    const bpmnElements = new Map<string, { id: string; name: string; type: string }>();
    let match: RegExpExecArray | null;

    while ((match = elementPattern.exec(data)) !== null) {
      const [, type, id, name] = match;
      // Skip non-element types
      if (['process', 'definitions', 'sequenceFlow'].includes(type)) continue;
      bpmnElements.set(id, { id, name: name ?? id, type });
    }

    // Parse bounds from BPMNDI
    const boundsPattern = /<bpmndi:BPMNShape[^>]*bpmnElement="([^"]*)"[^>]*>[\s\S]*?<dc:Bounds\s+x="([^"]*)" y="([^"]*)" width="([^"]*)" height="([^"]*)"/g;
    const boundsMap = new Map<string, { x: number; y: number; w: number; h: number }>();

    while ((match = boundsPattern.exec(data)) !== null) {
      const [, elId, x, y, w, h] = match;
      boundsMap.set(elId, {
        x: parseFloat(x),
        y: parseFloat(y),
        w: parseFloat(w),
        h: parseFloat(h),
      });
    }

    // Create canvas items from BPMN elements
    for (const [bpmnId, el] of bpmnElements) {
      const bounds = boundsMap.get(bpmnId);
      await storage.put('canvas-item', bpmnId, {
        id: bpmnId,
        canvas: targetCanvas,
        kind: 'bpmn-element',
        x: bounds?.x ?? itemsCreated * 150,
        y: bounds?.y ?? 0,
        width: bounds?.w ?? 100,
        height: bounds?.h ?? 80,
        label: el.name,
        shape: mapBpmnTypeToShape(el.type),
        data: { bpmn_type: el.type },
      });
      itemsCreated++;
    }

    // Parse sequence flows
    const flowPattern = /<bpmn:sequenceFlow\s[^>]*id="([^"]*)"[^>]*(?:name="([^"]*)")?[^>]*sourceRef="([^"]*)"[^>]*targetRef="([^"]*)"[^>]*\/?>/g;

    while ((match = flowPattern.exec(data)) !== null) {
      const [, flowId, name, sourceRef, targetRef] = match;
      await storage.put('canvas-connector', flowId, {
        id: flowId,
        canvas: targetCanvas,
        source: sourceRef,
        target: targetRef,
        label: name ?? null,
        style: 'solid',
      });
      connectorsCreated++;
    }

    return {
      variant: 'ok',
      canvas_id: targetCanvas,
      items_created: itemsCreated,
      connectors_created: connectorsCreated,
    };
  },
};

function toBpmnId(rawId: string, index: number): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || `Element_${index}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function mapShapeToBpmnType(shape: string): string {
  const typeMap: Record<string, string> = {
    circle: 'startEvent',
    ellipse: 'startEvent',
    diamond: 'exclusiveGateway',
    rectangle: 'task',
    rounded: 'task',
  };
  return typeMap[shape] ?? 'task';
}

function mapBpmnTypeToShape(bpmnType: string): string {
  const shapeMap: Record<string, string> = {
    startEvent: 'circle',
    endEvent: 'circle',
    intermediateCatchEvent: 'circle',
    intermediateThrowEvent: 'circle',
    task: 'rectangle',
    userTask: 'rectangle',
    serviceTask: 'rectangle',
    scriptTask: 'rectangle',
    manualTask: 'rectangle',
    sendTask: 'rectangle',
    receiveTask: 'rectangle',
    exclusiveGateway: 'diamond',
    parallelGateway: 'diamond',
    inclusiveGateway: 'diamond',
    eventBasedGateway: 'diamond',
  };
  return shapeMap[bpmnType] ?? 'rectangle';
}

export default bpmnXmlExportHandler;
