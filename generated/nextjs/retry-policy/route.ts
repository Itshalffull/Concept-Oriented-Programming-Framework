// RetryPolicy — route.ts
// Next.js App Router Route Handler — maps HTTP to RetryPolicy concept actions.
// Place at: app/api/retry-policy/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import type { RetryPolicyHandler, RetryPolicyError } from './handler.js';
import type { RetryPolicyStorage } from './types.js';

const errorResponse = (error: RetryPolicyError, status = 422): NextResponse =>
  NextResponse.json({ errors: [{ code: error.code, message: error.message }] }, { status });

const successResponse = <T>(data: T, status = 200): NextResponse =>
  NextResponse.json(data, { status });

export const createRetryPolicyRoutes = (
  handler: RetryPolicyHandler,
  storage: RetryPolicyStorage,
) => {

  const dispatch = async (action: string, input: Record<string, unknown>): Promise<NextResponse> => {
    switch (action) {
      case 'create': {
        const result = await handler.create(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o, 201)));
      }
      case 'should_retry': {
        const result = await handler.should_retry(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'record_attempt': {
        const result = await handler.record_attempt(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'mark_succeeded': {
        const result = await handler.mark_succeeded(input as any, storage)();
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
    const action = searchParams.get('action') ?? 'should_retry';
    const input: Record<string, unknown> = {};
    searchParams.forEach((value, key) => { if (key !== 'action') input[key] = value; });
    return dispatch(action, input);
  };

  return { POST, GET };
};
