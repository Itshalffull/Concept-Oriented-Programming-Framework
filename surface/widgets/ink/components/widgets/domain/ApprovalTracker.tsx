// ============================================================
// Clef Surface Ink Widget — ApprovalTracker
//
// M-of-N parallel approval display showing a threshold indicator,
// progress bar, and individual signer list with status, avatar,
// address, and timestamp. Supports sequential and parallel approval
// variants with an execute action gated on quorum completion.
//
// Adapts the approval-tracker.widget spec: anatomy (root,
// thresholdText, progressBar, signerList, signerItem,
// signerAvatar, signerName, signerStatus, signerTime,
// executeButton), states (pending, ready, executing, completed),
// and connect attributes.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Types ---------------

export interface Signer {
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp?: string;
}

// --------------- Props ---------------

export interface ApprovalTrackerProps {
  /** List of signers with their approval status. */
  signers: Signer[];
  /** Number of approvals required. */
  threshold: number;
  /** Current number of approvals. */
  current: number;
  /** Overall status of the tracker. */
  status?: 'pending' | 'ready' | 'executing' | 'completed';
  /** Variant: sequential or parallel approval flow. */
  variant?: 'sequential' | 'parallel';
  /** Whether to show approval timestamps. */
  showTimestamps?: boolean;
  /** Compact display mode. */
  compact?: boolean;
  /** Called when the execute action is triggered. */
  onExecute?: () => void;
}

// --------------- Component ---------------

export function ApprovalTracker({
  signers,
  threshold,
  current,
  status = 'pending',
  variant = 'parallel',
  showTimestamps = true,
  compact = false,
  onExecute,
}: ApprovalTrackerProps): React.ReactElement {
  const canExecute = current >= threshold && status === 'ready';

  return (
    <Box
      flexDirection="column"
      data-part="root"
      data-variant={variant}
      data-state={status}
    >
      <Text data-part="threshold-text">
        {current} of {threshold} approved
      </Text>

      <Box data-part="progress-bar">
        <Text>
          [{'='.repeat(Math.min(current, threshold))}
          {' '.repeat(Math.max(0, threshold - current))}]
        </Text>
      </Box>

      {!compact && (
        <Box flexDirection="column" data-part="signer-list">
          {signers.map((signer, i) => (
            <Box key={i} data-part="signer-item" data-status={signer.status}>
              <Text data-part="signer-name">{signer.name}</Text>
              <Text data-part="signer-status">
                {' '}
                [{signer.status}]
              </Text>
              {showTimestamps && signer.timestamp && (
                <Text data-part="signer-time"> {signer.timestamp}</Text>
              )}
            </Box>
          ))}
        </Box>
      )}

      <Text
        data-part="execute-button"
        dimColor={!canExecute}
      >
        {status === 'executing' ? '[Executing...]' : '[Execute]'}
      </Text>
    </Box>
  );
}

export default ApprovalTracker;
