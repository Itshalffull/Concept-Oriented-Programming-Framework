// ============================================================
// Clef Surface NativeScript Widget — CronEditor
//
// Cron expression editor with simple and advanced modes.
// Simple mode provides frequency, time, and day selectors.
// Advanced mode shows a raw cron expression input with
// validation feedback and next-run preview.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  TextField,
  Button,
  Color,
} from '@nativescript/core';

// --------------- Types ---------------

export interface CronEditorProps {
  cronExpression?: string;
  frequency?: 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  hour?: number;
  minute?: number;
  dayOfWeek?: number[];
  dayOfMonth?: number;
  timezone?: string;
  nextRunCount?: number;
  readOnly?: boolean;
  mode?: 'simple' | 'advanced';
  nextRuns?: string[];
  humanReadable?: string;
  valid?: boolean;
  accentColor?: string;
  onCronChange?: (expression: string) => void;
  onFrequencyChange?: (frequency: string) => void;
  onModeChange?: (mode: 'simple' | 'advanced') => void;
  onTimeChange?: (hour: number, minute: number) => void;
  onDayOfWeekChange?: (days: number[]) => void;
}

// --------------- Helpers ---------------

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FREQ_LABELS: Record<string, string> = {
  minutely: 'Every Minute', hourly: 'Hourly', daily: 'Daily',
  weekly: 'Weekly', monthly: 'Monthly',
};

// --------------- Component ---------------

export function createCronEditor(props: CronEditorProps = {}): StackLayout {
  const {
    cronExpression = '0 * * * *',
    frequency = 'hourly',
    hour = 0,
    minute = 0,
    dayOfWeek = [],
    dayOfMonth = 1,
    timezone = 'UTC',
    readOnly = false,
    mode = 'simple',
    nextRuns = [],
    humanReadable,
    valid = true,
    accentColor = '#06b6d4',
    onCronChange,
    onFrequencyChange,
    onModeChange,
    onTimeChange,
    onDayOfWeekChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-cron-editor';
  container.padding = 8;
  container.borderWidth = 1;
  container.borderColor = new Color('#333333');
  container.borderRadius = 6;

  // Mode tabs
  const tabRow = new StackLayout();
  tabRow.orientation = 'horizontal';
  tabRow.marginBottom = 8;

  const simpleTab = new Button();
  simpleTab.text = 'Simple';
  simpleTab.fontSize = 12;
  simpleTab.marginRight = 4;
  simpleTab.borderRadius = 4;
  if (mode === 'simple') {
    simpleTab.backgroundColor = new Color(accentColor);
    simpleTab.color = new Color('#000000');
  }
  simpleTab.on('tap', () => onModeChange?.('simple'));
  tabRow.addChild(simpleTab);

  const advancedTab = new Button();
  advancedTab.text = 'Advanced';
  advancedTab.fontSize = 12;
  advancedTab.borderRadius = 4;
  if (mode === 'advanced') {
    advancedTab.backgroundColor = new Color(accentColor);
    advancedTab.color = new Color('#000000');
  }
  advancedTab.on('tap', () => onModeChange?.('advanced'));
  tabRow.addChild(advancedTab);

  container.addChild(tabRow);

  if (mode === 'simple') {
    // Frequency selection
    const freqLabel = new Label();
    freqLabel.text = 'Frequency';
    freqLabel.fontSize = 11;
    freqLabel.opacity = 0.5;
    freqLabel.marginBottom = 4;
    container.addChild(freqLabel);

    const freqRow = new StackLayout();
    freqRow.orientation = 'horizontal';
    freqRow.marginBottom = 8;

    const freqs: Array<'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly'> =
      ['minutely', 'hourly', 'daily', 'weekly', 'monthly'];

    freqs.forEach((f) => {
      const btn = new Button();
      btn.text = FREQ_LABELS[f];
      btn.fontSize = 10;
      btn.marginRight = 4;
      btn.borderRadius = 3;
      if (f === frequency) {
        btn.backgroundColor = new Color(accentColor);
        btn.color = new Color('#000000');
      }
      btn.isEnabled = !readOnly;
      btn.on('tap', () => onFrequencyChange?.(f));
      freqRow.addChild(btn);
    });

    container.addChild(freqRow);

    // Time selector (visible for hourly+)
    if (frequency !== 'minutely') {
      const timeRow = new GridLayout();
      timeRow.columns = 'auto, auto, auto, auto, *';
      timeRow.marginBottom = 8;

      const timeLabel = new Label();
      timeLabel.text = 'At';
      timeLabel.fontSize = 12;
      timeLabel.marginRight = 8;
      timeLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(timeLabel, 0);
      timeRow.addChild(timeLabel);

      const hourField = new TextField();
      hourField.text = String(hour).padStart(2, '0');
      hourField.width = 40;
      hourField.fontSize = 14;
      hourField.fontFamily = 'monospace';
      hourField.textAlignment = 'center';
      hourField.keyboardType = 'number';
      hourField.isEnabled = !readOnly;
      hourField.on('textChange', (args: any) => {
        const h = parseInt(args.object.text, 10);
        if (!isNaN(h)) onTimeChange?.(h, minute);
      });
      GridLayout.setColumn(hourField, 1);
      timeRow.addChild(hourField);

      const colonLabel = new Label();
      colonLabel.text = ':';
      colonLabel.fontSize = 14;
      colonLabel.fontWeight = 'bold';
      colonLabel.marginLeft = 2;
      colonLabel.marginRight = 2;
      colonLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(colonLabel, 2);
      timeRow.addChild(colonLabel);

      const minuteField = new TextField();
      minuteField.text = String(minute).padStart(2, '0');
      minuteField.width = 40;
      minuteField.fontSize = 14;
      minuteField.fontFamily = 'monospace';
      minuteField.textAlignment = 'center';
      minuteField.keyboardType = 'number';
      minuteField.isEnabled = !readOnly;
      minuteField.on('textChange', (args: any) => {
        const m = parseInt(args.object.text, 10);
        if (!isNaN(m)) onTimeChange?.(hour, m);
      });
      GridLayout.setColumn(minuteField, 3);
      timeRow.addChild(minuteField);

      container.addChild(timeRow);
    }

    // Day of week selector
    if (frequency === 'weekly') {
      const dowLabel = new Label();
      dowLabel.text = 'On days';
      dowLabel.fontSize = 11;
      dowLabel.opacity = 0.5;
      dowLabel.marginBottom = 4;
      container.addChild(dowLabel);

      const dowRow = new StackLayout();
      dowRow.orientation = 'horizontal';
      dowRow.marginBottom = 8;

      DAYS_OF_WEEK.forEach((day, i) => {
        const btn = new Button();
        btn.text = day;
        btn.fontSize = 10;
        btn.width = 36;
        btn.marginRight = 2;
        btn.borderRadius = 3;
        const isSelected = dayOfWeek.includes(i);
        if (isSelected) {
          btn.backgroundColor = new Color(accentColor);
          btn.color = new Color('#000000');
        }
        btn.isEnabled = !readOnly;
        btn.on('tap', () => {
          const newDays = isSelected
            ? dayOfWeek.filter((d) => d !== i)
            : [...dayOfWeek, i];
          onDayOfWeekChange?.(newDays);
        });
        dowRow.addChild(btn);
      });

      container.addChild(dowRow);
    }

    // Day of month
    if (frequency === 'monthly') {
      const domLabel = new Label();
      domLabel.text = `On day ${dayOfMonth} of the month`;
      domLabel.fontSize = 12;
      domLabel.marginBottom = 8;
      container.addChild(domLabel);
    }
  } else {
    // Advanced: raw cron input
    const cronLabel = new Label();
    cronLabel.text = 'Cron Expression';
    cronLabel.fontSize = 11;
    cronLabel.opacity = 0.5;
    cronLabel.marginBottom = 4;
    container.addChild(cronLabel);

    const cronField = new TextField();
    cronField.text = cronExpression;
    cronField.hint = '* * * * *';
    cronField.fontFamily = 'monospace';
    cronField.fontSize = 16;
    cronField.color = new Color(valid ? '#e0e0e0' : '#ef4444');
    cronField.backgroundColor = new Color('#0d0d1a');
    cronField.borderRadius = 4;
    cronField.padding = 8;
    cronField.isEnabled = !readOnly;
    cronField.on('textChange', (args: any) => onCronChange?.(args.object.text));
    container.addChild(cronField);

    // Validation status
    const validLabel = new Label();
    validLabel.text = valid ? '\u2714 Valid expression' : '\u2716 Invalid expression';
    validLabel.color = new Color(valid ? '#22c55e' : '#ef4444');
    validLabel.fontSize = 11;
    validLabel.marginTop = 4;
    container.addChild(validLabel);

    // Format hint
    const hintLabel = new Label();
    hintLabel.text = 'Format: minute hour day-of-month month day-of-week';
    hintLabel.fontSize = 10;
    hintLabel.opacity = 0.3;
    hintLabel.marginTop = 2;
    container.addChild(hintLabel);
  }

  // Human-readable preview
  if (humanReadable) {
    const previewRow = new StackLayout();
    previewRow.marginTop = 8;
    previewRow.padding = 6;
    previewRow.backgroundColor = new Color('#1a1a2e');
    previewRow.borderRadius = 4;

    const previewLabel = new Label();
    previewLabel.text = humanReadable;
    previewLabel.fontSize = 13;
    previewLabel.color = new Color(accentColor);
    previewRow.addChild(previewLabel);

    container.addChild(previewRow);
  }

  // Next runs
  if (nextRuns.length > 0 && valid) {
    const runsLabel = new Label();
    runsLabel.text = `Next runs (${timezone}):`;
    runsLabel.fontSize = 11;
    runsLabel.opacity = 0.5;
    runsLabel.marginTop = 8;
    runsLabel.marginBottom = 2;
    container.addChild(runsLabel);

    nextRuns.forEach((run) => {
      const runRow = new Label();
      runRow.text = `  \u2022 ${run}`;
      runRow.fontSize = 11;
      runRow.color = new Color('#a0a0a0');
      container.addChild(runRow);
    });
  }

  return container;
}

export default createCronEditor;
