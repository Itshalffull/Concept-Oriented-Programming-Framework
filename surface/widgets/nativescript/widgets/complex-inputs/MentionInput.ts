// ============================================================
// Clef Surface NativeScript Widget — MentionInput
//
// Text input that supports @-mention autocomplete. Displays a
// suggestion dropdown when the user types a trigger character,
// shows matched user/entity items with avatar and name, and
// renders accepted mentions as styled inline chips.
//
// Adapts the mention-input.widget spec: anatomy (root, input,
// suggestionList, suggestionItem, mentionChip), states (idle,
// suggesting, loading, empty), and connect attributes to
// NativeScript text fields and overlay lists.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  TextField,
  ScrollView,
  ContentView,
} from '@nativescript/core';

// --------------- Props ---------------

export interface MentionItem {
  id: string;
  name: string;
  avatar?: string;
  subtitle?: string;
}

export interface MentionInputProps {
  value?: string;
  trigger?: string;
  items?: MentionItem[];
  placeholder?: string;
  enabled?: boolean;
  onTextChange?: (text: string) => void;
  onMention?: (item: MentionItem) => void;
}

// --------------- Component ---------------

/**
 * Creates a NativeScript mention input with an autocomplete
 * suggestion list, avatar display, chip rendering for accepted
 * mentions, and configurable trigger character.
 */
export function createMentionInput(props: MentionInputProps = {}): StackLayout {
  const {
    value = '',
    trigger = '@',
    items = [],
    placeholder = 'Type @ to mention...',
    enabled = true,
    onTextChange,
    onMention,
  } = props;

  const acceptedMentions: MentionItem[] = [];

  const container = new StackLayout();
  container.className = 'clef-widget-mention-input';
  container.padding = 8;

  // -- Mention chips display --
  const chipRow = new StackLayout();
  chipRow.className = 'clef-mention-chips';
  chipRow.orientation = 'horizontal';
  chipRow.marginBottom = 4;
  container.addChild(chipRow);

  function renderChips(): void {
    chipRow.removeChildren();
    acceptedMentions.forEach((m) => {
      const chip = new GridLayout();
      chip.columns = 'auto, auto, auto';
      chip.rows = 'auto';
      chip.backgroundColor = '#E3F2FD' as any;
      chip.borderRadius = 12;
      chip.padding = 4;
      chip.marginRight = 4;
      chip.marginBottom = 4;

      const avatar = new ContentView();
      avatar.width = 20;
      avatar.height = 20;
      avatar.borderRadius = 10;
      avatar.backgroundColor = '#90CAF9' as any;
      avatar.col = 0;
      avatar.marginRight = 4;
      chip.addChild(avatar);

      const nameLabel = new Label();
      nameLabel.text = m.name;
      nameLabel.fontSize = 12;
      nameLabel.color = '#1565C0' as any;
      nameLabel.verticalAlignment = 'middle';
      nameLabel.col = 1;
      chip.addChild(nameLabel);

      const removeLabel = new Label();
      removeLabel.text = ' \u2715';
      removeLabel.fontSize = 12;
      removeLabel.opacity = 0.6;
      removeLabel.verticalAlignment = 'middle';
      removeLabel.col = 2;
      removeLabel.marginLeft = 4;
      if (enabled) {
        removeLabel.on('tap', () => {
          const idx = acceptedMentions.indexOf(m);
          if (idx >= 0) acceptedMentions.splice(idx, 1);
          renderChips();
        });
      }
      chip.addChild(removeLabel);

      chipRow.addChild(chip);
    });
  }

  // -- Text input --
  const input = new TextField();
  input.text = value;
  input.hint = placeholder;
  input.isEnabled = enabled;
  input.borderWidth = 1;
  input.borderColor = '#CCCCCC';
  input.borderRadius = 4;
  input.padding = 8;
  input.fontSize = 14;
  input.marginBottom = 4;
  container.addChild(input);

  // -- Suggestion list --
  const suggestionContainer = new StackLayout();
  suggestionContainer.className = 'clef-mention-suggestions';
  suggestionContainer.visibility = 'collapse';
  suggestionContainer.borderWidth = 1;
  suggestionContainer.borderColor = '#E0E0E0';
  suggestionContainer.borderRadius = 4;
  suggestionContainer.backgroundColor = '#FFFFFF' as any;

  const suggestionScroll = new ScrollView();
  suggestionScroll.height = 160;

  const suggestionList = new StackLayout();
  suggestionScroll.content = suggestionList;
  suggestionContainer.addChild(suggestionScroll);
  container.addChild(suggestionContainer);

  function showSuggestions(query: string): void {
    suggestionList.removeChildren();
    const filtered = items.filter(
      (item) => item.name.toLowerCase().includes(query.toLowerCase()),
    );

    if (filtered.length === 0) {
      const emptyLabel = new Label();
      emptyLabel.text = 'No matches found';
      emptyLabel.opacity = 0.5;
      emptyLabel.padding = 12;
      emptyLabel.horizontalAlignment = 'center';
      suggestionList.addChild(emptyLabel);
      suggestionContainer.visibility = 'visible';
      return;
    }

    filtered.forEach((item) => {
      const row = new GridLayout();
      row.columns = 'auto, *';
      row.rows = 'auto, auto';
      row.padding = 8;
      row.borderBottomWidth = 1;
      row.borderBottomColor = '#F0F0F0' as any;

      const avatar = new ContentView();
      avatar.width = 32;
      avatar.height = 32;
      avatar.borderRadius = 16;
      avatar.backgroundColor = '#90CAF9' as any;
      avatar.col = 0;
      avatar.rowSpan = 2;
      avatar.marginRight = 8;

      const avatarLetter = new Label();
      avatarLetter.text = item.name.charAt(0).toUpperCase();
      avatarLetter.fontSize = 14;
      avatarLetter.fontWeight = 'bold';
      avatarLetter.color = '#FFFFFF' as any;
      avatarLetter.horizontalAlignment = 'center';
      avatarLetter.verticalAlignment = 'middle';
      avatar.content = avatarLetter;

      row.addChild(avatar);

      const nameLabel = new Label();
      nameLabel.text = item.name;
      nameLabel.fontSize = 14;
      nameLabel.fontWeight = 'bold';
      nameLabel.col = 1;
      nameLabel.row = 0;
      row.addChild(nameLabel);

      if (item.subtitle) {
        const subLabel = new Label();
        subLabel.text = item.subtitle;
        subLabel.fontSize = 11;
        subLabel.opacity = 0.6;
        subLabel.col = 1;
        subLabel.row = 1;
        row.addChild(subLabel);
      }

      row.on('tap', () => {
        acceptedMentions.push(item);
        renderChips();
        const text = input.text;
        const lastTrigger = text.lastIndexOf(trigger);
        input.text = lastTrigger >= 0 ? text.substring(0, lastTrigger) : text;
        suggestionContainer.visibility = 'collapse';
        if (onMention) onMention(item);
      });

      suggestionList.addChild(row);
    });

    suggestionContainer.visibility = 'visible';
  }

  input.on('textChange', () => {
    const text = input.text;
    if (onTextChange) onTextChange(text);

    const lastTriggerIdx = text.lastIndexOf(trigger);
    if (lastTriggerIdx >= 0) {
      const query = text.substring(lastTriggerIdx + trigger.length);
      if (query.length >= 0 && !query.includes(' ')) {
        showSuggestions(query);
        return;
      }
    }
    suggestionContainer.visibility = 'collapse';
  });

  renderChips();

  if (!enabled) {
    container.opacity = 0.38;
  }

  return container;
}

createMentionInput.displayName = 'MentionInput';
export default createMentionInput;
