// @clef-handler style=functional
// ============================================================
// ReviewCoverage Handler
//
// Track code review process quality across the codebase. Measure
// coverage, depth, turnaround, and participation. Identify review
// gaps where code ships without adequate human verification.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `review-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const _reviewCoverageHandler: FunctionalConceptHandler = {

  // ── record ───────────────────────────────────────────────────
  record(input: Record<string, unknown>) {
    const changeId = input.changeId as string;
    const target = input.target as string;
    const author = input.author as string;
    const linesChanged = input.linesChanged as number;

    if (!changeId || changeId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'changeId is required' });
    }

    let p = createProgram();
    p = find(p, 'review', { changeId }, 'existing');

    return branch(p,
      (bindings) => {
        const arr = bindings.existing as unknown[];
        return arr && arr.length > 0;
      },
      // duplicate
      complete(createProgram(), 'duplicate', { changeId }),
      // ok — create new review record
      (() => {
        const id = nextId();
        let b = createProgram();
        b = put(b, 'review', id, {
          id,
          changeId,
          target,
          author,
          submittedAt: new Date().toISOString(),
          reviewed: false,
          reviewers: [],
          reviewRounds: 0,
          firstResponseAt: null,
          completedAt: null,
          linesChanged,
          linesReviewed: 0,
          commentCount: 0,
          substantiveComments: 0,
          timeInvestment: null,
          defectsFound: 0,
          suggestionsAccepted: 0,
        });
        return complete(b, 'ok', { review: id });
      })(),
    );
  },

  // ── recordReview ─────────────────────────────────────────────
  recordReview(input: Record<string, unknown>) {
    const changeId = input.changeId as string;
    const reviewer = input.reviewer as string;
    const commentCount = input.commentCount as number;
    const substantiveComments = input.substantiveComments as number;
    const defectsFound = input.defectsFound as number;
    const suggestionsAccepted = input.suggestionsAccepted as number;

    let p = createProgram();
    p = find(p, 'review', { changeId }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      // changeNotFound
      complete(createProgram(), 'changeNotFound', { changeId }),
      // found — record review round
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.matches as Record<string, unknown>[];
          return arr[0];
        }, '_review');

        b = mapBindings(b, (bindings) => {
          const review = bindings._review as Record<string, unknown>;
          const submittedAt = new Date(review.submittedAt as string).getTime();
          const now = Date.now();
          const turnaroundHours = (now - submittedAt) / (1000 * 60 * 60);

          const existingReviewers = (review.reviewers as string[]) || [];
          const updatedReviewers = existingReviewers.includes(reviewer)
            ? existingReviewers
            : [...existingReviewers, reviewer];

          return {
            review: {
              ...review,
              reviewed: true,
              reviewers: updatedReviewers,
              reviewRounds: (review.reviewRounds as number) + 1,
              firstResponseAt: review.firstResponseAt ?? new Date().toISOString(),
              commentCount: (review.commentCount as number) + commentCount,
              substantiveComments: (review.substantiveComments as number) + substantiveComments,
              defectsFound: (review.defectsFound as number) + defectsFound,
              suggestionsAccepted: (review.suggestionsAccepted as number) + suggestionsAccepted,
              linesReviewed: review.linesChanged as number,
            },
            turnaround: Math.round(turnaroundHours * 100) / 100,
          };
        }, '_result');

        b = mapBindings(b, (bindings) => {
          const result = bindings._result as Record<string, unknown>;
          const review = result.review as Record<string, unknown>;
          return review.id as string;
        }, '_reviewId');

        // Persist updated review
        b = mapBindings(b, (bindings) => {
          const result = bindings._result as Record<string, unknown>;
          return result.review as Record<string, unknown>;
        }, '_updatedReview');

        return completeFrom(b, 'ok', (bindings) => {
          const result = bindings._result as Record<string, unknown>;
          const review = result.review as Record<string, unknown>;
          return {
            review: review.id as string,
            turnaround: result.turnaround as number,
          };
        });
      })(),
    );
  },

  // ── complete ─────────────────────────────────────────────────
  complete(input: Record<string, unknown>) {
    const changeId = input.changeId as string;

    let p = createProgram();
    p = find(p, 'review', { changeId }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      // changeNotFound
      complete(createProgram(), 'changeNotFound', { changeId }),
      // found — mark complete
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.matches as Record<string, unknown>[];
          return arr[0];
        }, '_review');

        b = mapBindings(b, (bindings) => {
          const review = bindings._review as Record<string, unknown>;
          const submittedAt = new Date(review.submittedAt as string).getTime();
          const now = Date.now();
          const totalTurnaroundHours = (now - submittedAt) / (1000 * 60 * 60);

          return {
            review: {
              ...review,
              completedAt: new Date().toISOString(),
            },
            totalTurnaround: Math.round(totalTurnaroundHours * 100) / 100,
            totalRounds: review.reviewRounds as number,
          };
        }, '_result');

        return completeFrom(b, 'ok', (bindings) => {
          const result = bindings._result as Record<string, unknown>;
          const review = result.review as Record<string, unknown>;
          return {
            review: review.id as string,
            totalTurnaround: result.totalTurnaround as number,
            totalRounds: result.totalRounds as number,
          };
        });
      })(),
    );
  },

  // ── metrics ──────────────────────────────────────────────────
  metrics(input: Record<string, unknown>) {
    const period = (input.period as string) ?? null;
    const targets = (input.targets as string[]) ?? null;

    let p = createProgram();
    p = find(p, 'review', {}, 'allReviews');

    p = mapBindings(p, (bindings) => {
      let reviews = (bindings.allReviews as Record<string, unknown>[]) || [];

      // Filter by targets if provided
      if (targets && targets.length > 0) {
        reviews = reviews.filter(r => targets.includes(r.target as string));
      }

      // Filter by period if provided (ISO date string prefix match)
      if (period) {
        reviews = reviews.filter(r => {
          const submittedAt = r.submittedAt as string;
          return submittedAt && submittedAt.startsWith(period);
        });
      }

      const totalChanges = reviews.length;
      const reviewedChanges = reviews.filter(r => r.reviewed === true);
      const totalReviewed = reviewedChanges.length;
      const coverageRate = totalChanges > 0 ? totalReviewed / totalChanges : 0;

      // Turnaround for completed reviews
      const completedReviews = reviews.filter(r => r.completedAt != null);
      const turnarounds = completedReviews.map(r => {
        const submitted = new Date(r.submittedAt as string).getTime();
        const completed = new Date(r.completedAt as string).getTime();
        return (completed - submitted) / (1000 * 60 * 60);
      });
      const sortedTurnarounds = [...turnarounds].sort((a, b) => a - b);
      const medianTurnaroundHours = sortedTurnarounds.length > 0
        ? (sortedTurnarounds.length % 2 === 0
          ? (sortedTurnarounds[sortedTurnarounds.length / 2 - 1] + sortedTurnarounds[sortedTurnarounds.length / 2]) / 2
          : sortedTurnarounds[Math.floor(sortedTurnarounds.length / 2)])
        : 0;

      // Review depth (substantive comments per review)
      const totalSubstantive = reviews.reduce((sum, r) => sum + ((r.substantiveComments as number) || 0), 0);
      const meanReviewDepth = totalReviewed > 0 ? totalSubstantive / totalReviewed : 0;

      // Defects per review
      const totalDefects = reviews.reduce((sum, r) => sum + ((r.defectsFound as number) || 0), 0);
      const meanDefectsPerReview = totalReviewed > 0 ? totalDefects / totalReviewed : 0;

      // Participation: unique authors who also appear as reviewers
      const authors = new Set(reviews.map(r => r.author as string));
      const allReviewers = new Set(
        reviews.flatMap(r => (r.reviewers as string[]) || []),
      );
      const participatingAuthors = [...authors].filter(a => allReviewers.has(a));
      const participationRate = authors.size > 0 ? participatingAuthors.length / authors.size : 0;

      // Unreviewed changes
      const now = Date.now();
      const unreviewed = reviews
        .filter(r => r.reviewed !== true)
        .map(r => ({
          changeId: r.changeId as string,
          target: r.target as string,
          ageHours: Math.round(((now - new Date(r.submittedAt as string).getTime()) / (1000 * 60 * 60)) * 100) / 100,
        }));

      return {
        coverageRate: Math.round(coverageRate * 1000) / 1000,
        medianTurnaroundHours: Math.round(medianTurnaroundHours * 100) / 100,
        meanReviewDepth: Math.round(meanReviewDepth * 100) / 100,
        meanDefectsPerReview: Math.round(meanDefectsPerReview * 100) / 100,
        participationRate: Math.round(participationRate * 1000) / 1000,
        totalChanges,
        totalReviewed,
        unreviewed,
      };
    }, '_metrics');

    return completeFrom(p, 'ok', (bindings) => ({
      metrics: bindings._metrics as Record<string, unknown>,
    }));
  },

  // ── authorStats ──────────────────────────────────────────────
  authorStats(input: Record<string, unknown>) {
    const author = input.author as string;

    let p = createProgram();
    p = find(p, 'review', {}, 'allReviews');

    p = mapBindings(p, (bindings) => {
      const reviews = (bindings.allReviews as Record<string, unknown>[]) || [];

      // Changes submitted by this author
      const submitted = reviews.filter(r => r.author === author);
      const changesSubmitted = submitted.length;

      // Reviews conducted by this author (appears in reviewers list)
      const reviewedByAuthor = reviews.filter(r => {
        const reviewers = (r.reviewers as string[]) || [];
        return reviewers.includes(author);
      });
      const reviewsConducted = reviewedByAuthor.length;

      // Average turnaround as reviewer
      const turnaroundsAsReviewer = reviewedByAuthor
        .filter(r => r.firstResponseAt != null)
        .map(r => {
          const submitted = new Date(r.submittedAt as string).getTime();
          const firstResponse = new Date(r.firstResponseAt as string).getTime();
          return (firstResponse - submitted) / (1000 * 60 * 60);
        });
      const avgTurnaroundAsReviewer = turnaroundsAsReviewer.length > 0
        ? turnaroundsAsReviewer.reduce((a, b) => a + b, 0) / turnaroundsAsReviewer.length
        : 0;

      // Average comment depth
      const totalComments = reviewedByAuthor.reduce((sum, r) => sum + ((r.substantiveComments as number) || 0), 0);
      const avgCommentDepth = reviewsConducted > 0 ? totalComments / reviewsConducted : 0;

      // Defects found as reviewer
      const defectsFoundAsReviewer = reviewedByAuthor.reduce(
        (sum, r) => sum + ((r.defectsFound as number) || 0), 0,
      );

      return {
        changesSubmitted,
        reviewsConducted,
        avgTurnaroundAsReviewer: Math.round(avgTurnaroundAsReviewer * 100) / 100,
        avgCommentDepth: Math.round(avgCommentDepth * 100) / 100,
        defectsFoundAsReviewer,
      };
    }, '_stats');

    return completeFrom(p, 'ok', (bindings) => ({
      stats: bindings._stats as Record<string, unknown>,
    }));
  },
};

export const reviewCoverageHandler = autoInterpret(_reviewCoverageHandler);

export function resetReviewCoverageCounter(): void {
  idCounter = 0;
}
