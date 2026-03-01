// Timer — route.ts
// Next.js App Router Route Handler — maps HTTP to Timer concept actions.
// Place at: app/api/timer/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import type { TimerHandler, TimerError } from './handler.js';
import type { TimerStorage } from './types.js';

const errorResponse = (error: TimerError, status = 422): NextResponse =>
  NextResponse.json({ errors: [{ code: error.code, message: error.message }] }, { status });

const successResponse = <T>(data: T, status = 200): NextResponse =>
  NextResponse.json(data, { status });

export const createTimerRoutes = (
  handler: TimerHandler,
  storage: TimerStorage,
) => {

  const dispatch = async (action: string, input: Record<string, unknown>): Promise<NextResponse> => {
    switch (action) {
      case 'set_timer': {
        const result = await handler.set_timer(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o, 201)));
      }
      case 'fire': {
        const result = await handler.fire(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'cancel': {
        const result = await handler.cancel(input as any, storage)();
        return pipe(result, E.fold((e) => errorResponse(e), (o) => successResponse(o)));
      }
      case 'reset': {
        const result = await handler.reset(input as any, storage)();
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
    const action = searchParams.get('action') ?? 'fire';
    const input: Record<string, unknown> = {};
    searchParams.forEach((value, key) => { if (key !== 'action') input[key] = value; });
    return dispatch(action, input);
  };

  return { POST, GET };
};
