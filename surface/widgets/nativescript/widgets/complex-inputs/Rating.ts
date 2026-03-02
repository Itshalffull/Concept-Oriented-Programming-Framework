// ============================================================
// Clef Surface NativeScript Widget — Rating
//
// Star-based rating input that displays a configurable number
// of star icons, supports half-star precision, shows a numeric
// value label, and provides tap-based selection. Includes a
// clear button and optional review count display.
//
// Adapts the rating.widget spec: anatomy (root, star, label,
// clearButton), states (empty, partial, full, hover, disabled),
// and connect attributes to NativeScript label-based star
// rendering with tap interaction.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Button,
} from '@nativescript/core';

// --------------- Props ---------------

export interface RatingProps {
  value?: number;
  maxStars?: number;
  allowHalf?: boolean;
  showValue?: boolean;
  showCount?: boolean;
  reviewCount?: number;
  size?: number;
  enabled?: boolean;
  onRatingChange?: (rating: number) => void;
}

// --------------- Component ---------------

/**
 * Creates a NativeScript rating widget with tappable star icons,
 * optional half-star precision, numeric value display, review
 * count, and a clear button.
 */
export function createRating(props: RatingProps = {}): StackLayout {
  const {
    value = 0,
    maxStars = 5,
    allowHalf = false,
    showValue = true,
    showCount = false,
    reviewCount = 0,
    size = 28,
    enabled = true,
    onRatingChange,
  } = props;

  let currentRating = value;

  const container = new StackLayout();
  container.className = 'clef-widget-rating';
  container.padding = 8;

  // -- Stars row --
  const starsRow = new GridLayout();
  const starCols = Array(maxStars).fill('auto').join(', ');
  starsRow.columns = starCols + ', auto, auto';
  starsRow.rows = 'auto';
  starsRow.horizontalAlignment = 'center';

  const starLabels: Label[] = [];

  function getStarText(index: number): string {
    const starNum = index + 1;
    if (currentRating >= starNum) return '\u2605';        // filled star
    if (allowHalf && currentRating >= starNum - 0.5) return '\u272F'; // half star approximation
    return '\u2606';                                       // empty star
  }

  function getStarColor(index: number): string {
    const starNum = index + 1;
    if (currentRating >= starNum) return '#FFC107';
    if (allowHalf && currentRating >= starNum - 0.5) return '#FFC107';
    return '#BDBDBD';
  }

  function updateStars(): void {
    starLabels.forEach((lbl, i) => {
      lbl.text = getStarText(i);
      lbl.color = getStarColor(i) as any;
    });
    if (showValue) {
      valueLabel.text = currentRating.toFixed(allowHalf ? 1 : 0);
    }
  }

  for (let i = 0; i < maxStars; i++) {
    const star = new Label();
    star.text = getStarText(i);
    star.fontSize = size;
    star.color = getStarColor(i) as any;
    star.col = i;
    star.marginRight = 2;

    if (enabled) {
      const starIndex = i;
      star.on('tap', () => {
        const newRating = starIndex + 1;
        if (allowHalf && currentRating === newRating) {
          currentRating = newRating - 0.5;
        } else if (currentRating === newRating) {
          currentRating = 0;
        } else {
          currentRating = newRating;
        }
        updateStars();
        if (onRatingChange) onRatingChange(currentRating);
      });
    }

    starLabels.push(star);
    starsRow.addChild(star);
  }

  // -- Numeric value label --
  const valueLabel = new Label();
  valueLabel.fontSize = 16;
  valueLabel.fontWeight = 'bold';
  valueLabel.verticalAlignment = 'middle';
  valueLabel.marginLeft = 8;
  valueLabel.col = maxStars;

  if (showValue) {
    valueLabel.text = currentRating.toFixed(allowHalf ? 1 : 0);
    starsRow.addChild(valueLabel);
  }

  // -- Review count --
  if (showCount) {
    const countLabel = new Label();
    countLabel.text = `(${reviewCount})`;
    countLabel.fontSize = 12;
    countLabel.opacity = 0.6;
    countLabel.verticalAlignment = 'middle';
    countLabel.marginLeft = 4;
    countLabel.col = maxStars + 1;
    starsRow.addChild(countLabel);
  }

  container.addChild(starsRow);

  // -- Descriptive text --
  const descriptionLabels = ['Terrible', 'Poor', 'Average', 'Good', 'Excellent'];
  const descLabel = new Label();
  descLabel.fontSize = 12;
  descLabel.opacity = 0.7;
  descLabel.horizontalAlignment = 'center';
  descLabel.marginTop = 4;

  function updateDescription(): void {
    const idx = Math.round(currentRating) - 1;
    if (idx >= 0 && idx < descriptionLabels.length) {
      descLabel.text = descriptionLabels[idx];
    } else {
      descLabel.text = 'Not rated';
    }
  }

  updateDescription();
  container.addChild(descLabel);

  // -- Clear button --
  if (enabled) {
    const clearBtn = new Button();
    clearBtn.text = 'Clear Rating';
    clearBtn.fontSize = 12;
    clearBtn.horizontalAlignment = 'center';
    clearBtn.marginTop = 8;
    clearBtn.backgroundColor = 'transparent' as any;
    clearBtn.borderWidth = 0;
    clearBtn.on('tap', () => {
      currentRating = 0;
      updateStars();
      updateDescription();
      if (onRatingChange) onRatingChange(0);
    });
    container.addChild(clearBtn);
  }

  // Hook star update into description update
  const origUpdateStars = updateStars;
  starLabels.forEach((star) => {
    star.on('tap', () => {
      updateDescription();
    });
  });

  if (!enabled) {
    container.opacity = 0.38;
  }

  return container;
}

createRating.displayName = 'Rating';
export default createRating;
