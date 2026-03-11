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
import { View, Text, Pressable } from 'react-native';

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
    <View
      accessibilityRole="none"
      accessibilityLabel="Hover-revealed toolbar for chat message "
      data-widget="message-actions"
      data-state={state}
    >
      <Pressable onPress={() => send({ type: 'SHOW' })} accessibilityRole="button">
        <Text>{/* Positive feedback button */}</Text>
      </Pressable>
      <Pressable onPress={() => send({ type: 'SHOW' })} accessibilityRole="button">
        <Text>{/* Negative feedback button */}</Text>
      </Pressable>
      <Pressable onPress={() => send({ type: 'SHOW' })} accessibilityRole="button">
        <Text>{/* Copy message content */}</Text>
      </Pressable>
      <Pressable onPress={() => send({ type: 'SHOW' })} accessibilityRole="button">
        <Text>{/* Regenerate this response */}</Text>
      </Pressable>
      <Pressable onPress={() => send({ type: 'SHOW' })} accessibilityRole="button">
        <Text>{/* Edit this message */}</Text>
      </Pressable>
    </View>
  );
}

export default MessageActions;
