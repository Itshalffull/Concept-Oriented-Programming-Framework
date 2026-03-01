// StepRun — route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import type { StepRunHandler, StepRunError } from './handler.js';
import type { StepRunStorage } from './types.js';

const errorResponse = (error: StepRunError, status = 422): NextResponse =>
  NextResponse.json({ errors: [{ code: error.code, message: error.message }] }, { status });

const successResponse = <T>(data: T, status = 200): NextResponse =>
  NextResponse.json(data, { status });

export const createStepRunRoutes = (
  handler: StepRunHandler,
  storage: StepRunStorage,
) => {
  const dispatch = async (action: string, input: Record<string, unknown>): Promise<NextResponse> => {
    switch (action) {
      case 'start': {
        const result = await handler.start(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'complete': {
        const result = await handler.complete(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'fail': {
        const result = await handler.fail(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'cancel': {
        const result = await handler.cancel(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'skip': {
        const result = await handler.skip(input as any, storage)();
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
