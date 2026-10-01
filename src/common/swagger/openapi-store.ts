import type { OpenAPIObject } from '@nestjs/swagger';

let document: OpenAPIObject | null = null;

/** Set once in main.ts after `SwaggerModule.createDocument` so HTML pages can list routes. */
export function setOpenApiDocument(doc: OpenAPIObject): void {
  document = doc;
}

export function getOpenApiDocument(): OpenAPIObject | null {
  return document;
}

export type OpenApiOperation = {
  method: string;
  path: string;
  summary: string;
  tag: string;
  isPublic: boolean;
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

export function listOpenApiOperations(
  doc: OpenAPIObject | null,
): OpenApiOperation[] {
  if (!doc) return [];
  const ops: OpenApiOperation[] = [];
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      ops.push({
        method: method.toUpperCase(),
        path,
        summary: op.summary ?? '',
        tag: op.tags?.[0] ?? 'Other',
        isPublic: !op.security?.length,
      });
    }
  }
  return ops;
}
