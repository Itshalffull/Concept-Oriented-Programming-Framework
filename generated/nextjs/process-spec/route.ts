// ProcessSpec — route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import type { ProcessSpecHandler, ProcessSpecError } from './handler.js';
import type { ProcessSpecStorage } from './types.js';

const errorResponse = (error: ProcessSpecError, status = 422): NextResponse =>
  NextResponse.json({ errors: [{ code: error.code, message: error.message }] }, { status });

const successResponse = <T>(data: T, status = 200): NextResponse =>
  NextResponse.json(data, { status });

export const createProcessSpecRoutes = (
  handler: ProcessSpecHandler,
  storage: ProcessSpecStorage,
) => {
  const dispatch = async (action: string, input: Record<string, unknown>): Promise<NextResponse> => {
    switch (action) {
      case 'create': {
        const result = await handler.create(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'publish': {
        const result = await handler.publish(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'deprecate': {
        const result = await handler.deprecate(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'update': {
        const result = await handler.update(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'get': {
        const result = await handler.get(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      default:
        return NextResponse.json(
          { errors: [{ code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` }] },
          { status: 404 },
        );
    }
  };

  const POST = async (request: NextRequest): Promise<NextResponse> => {
    const body = await request.json() as { action: string; input: Record<string, unknown> };
    return dispatch(body.action, body.input);
  };

  const GET = async (request: NextRequest): Promise<NextResponse> => {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') ?? 'get';
    const input: Record<string, unknown> = {};
    searchParams.forEach((value, key) => { if (key !== 'action') input[key] = value; });
    return dispatch(action, input);
  };

  return { POST, GET };
};
