// ProcessEvent — route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import type { ProcessEventHandler, ProcessEventError } from './handler.js';
import type { ProcessEventStorage } from './types.js';

const errorResponse = (error: ProcessEventError, status = 422): NextResponse =>
  NextResponse.json({ errors: [{ code: error.code, message: error.message }] }, { status });

const successResponse = <T>(data: T, status = 200): NextResponse =>
  NextResponse.json(data, { status });

export const createProcessEventRoutes = (
  handler: ProcessEventHandler,
  storage: ProcessEventStorage,
) => {
  const dispatch = async (action: string, input: Record<string, unknown>): Promise<NextResponse> => {
    switch (action) {
      case 'append': {
        const result = await handler.append(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'query': {
        const result = await handler.query(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'queryByType': {
        const result = await handler.queryByType(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'getCursor': {
        const result = await handler.getCursor(input as any, storage)();
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
    const action = searchParams.get('action') ?? 'getCursor';
    const input: Record<string, unknown> = {};
    searchParams.forEach((value, key) => { if (key !== 'action') input[key] = value; });
    return dispatch(action, input);
  };

  return { POST, GET };
};
