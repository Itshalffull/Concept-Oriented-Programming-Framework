// ============================================================
// Clef Surface GTK Widget — StepIndicator
//
// Multi-step progress indicator showing numbered steps with
// complete, active, and pending states.
//
// Adapts the step-indicator.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface Step { id: string; label: string; }

// --------------- Props ---------------

export interface StepIndicatorProps {
  steps?: Step[];
  currentStep?: number;
  onStepClick?: (index: number) => void;
}

// --------------- Component ---------------

export function createStepIndicator(props: StepIndicatorProps = {}): Gtk.Widget {
  const { steps = [], currentStep = 0, onStepClick } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 0 });

  steps.forEach((step, idx) => {
    const isComplete = idx < currentStep;
    const isActive = idx === currentStep;

    const stepBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, halign: Gtk.Align.CENTER });

    const circle = new Gtk.Label({ label: isComplete ? '\u2713' : String(idx + 1) });
    if (isActive) circle.get_style_context().add_class('accent');
    else if (isComplete) circle.get_style_context().add_class('success');
    else circle.get_style_context().add_class('dim-label');
    stepBox.append(circle);

    const label = new Gtk.Label({ label: step.label });
    if (!isActive && !isComplete) label.get_style_context().add_class('dim-label');
    stepBox.append(label);

    const gesture = new Gtk.GestureClick();
    gesture.connect('released', () => onStepClick?.(idx));
    stepBox.add_controller(gesture);

    box.append(stepBox);

    if (idx < steps.length - 1) {
      const sep = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, hexpand: true });
      box.append(sep);
    }
  });

  return box;
}
