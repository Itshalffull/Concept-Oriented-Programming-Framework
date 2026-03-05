export type MessageActionsState = 'hidden' | 'visible' | 'copied';
export type MessageActionsEvent =
  | { type: 'SHOW' }
  | { type: 'HIDE' }
  | { type: 'COPY' }
  | { type: 'COPY_TIMEOUT' };

export function messageActionsReducer(state: MessageActionsState, event: MessageActionsEvent): MessageActionsState {
  switch (state) {
    case 'hidden':
      if (event.type === 'SHOW') return 'visible';
      return state;
    case 'visible':
      if (event.type === 'HIDE') return 'hidden';
      if (event.type === 'COPY') return 'copied';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'visible';
      return state;
    default:
      return state;
  }
}

import React, { useReducer } from 'react';
import { Box, Text } from 'ink';

export interface MessageActionsProps {
  messageId: string;
  showFeedback?: boolean;
  showRegenerate?: boolean;
  showEdit?: boolean;
  showShare?: boolean;
}

export function MessageActions(props: MessageActionsProps) {
  const [state, send] = useReducer(messageActionsReducer, 'hidden');

  return (
    <Box flexDirection="column" borderStyle="round" data-widget="message-actions" data-state={state}>
      <Text bold>{/* Hover-revealed toolbar for chat message  */} MessageActions</Text>
      <Box><Text data-part="thumbs-up">{/* Positive feedback button */}</Text></Box>
      <Box><Text data-part="thumbs-down">{/* Negative feedback button */}</Text></Box>
      <Box><Text data-part="copy-button">{/* Copy message content */}</Text></Box>
      <Box><Text data-part="regenerate">{/* Regenerate this response */}</Text></Box>
    </Box>
  );
}

export default MessageActions;
