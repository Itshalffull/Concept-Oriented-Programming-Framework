// ============================================================
// Clef Surface Ink Widget — Icon
//
// Renders a named icon as a Unicode symbol in the terminal.
// Maps common icon names to their Unicode equivalents. Unknown
// names fall back to a generic diamond glyph. When a label is
// provided, the icon is treated as meaningful (not decorative).
//
// Adapts the icon.widget spec: anatomy (root), states (static),
// and connect attributes (data-part, data-icon, data-size,
// role, aria-hidden, aria-label) to terminal rendering.
// ============================================================

import React from 'react';
import { Text } from 'ink';

// --------------- Props ---------------

export interface IconProps {
  /** Named icon to render. */
  name?: string;
  /** Size of the icon (affects no terminal layout, retained for API parity). */
  size?: 'sm' | 'md' | 'lg';
  /** Color of the icon text. */
  color?: string;
  /** Accessible label — when set the icon is semantic, not decorative. */
  label?: string;
  /** Whether the icon is purely decorative. */
  decorative?: boolean;
  /** data-part attribute. */
  dataPart?: string;
}

// --------------- Icon Map ---------------

const ICON_MAP: Record<string, string> = {
  'check': '\u2713',        // checkmark
  'close': '\u2715',        // multiplication x
  'x': '\u2715',
  'arrow-right': '\u2192',  // rightwards arrow
  'arrow-left': '\u2190',   // leftwards arrow
  'arrow-up': '\u2191',     // upwards arrow
  'arrow-down': '\u2193',   // downwards arrow
  'chevron-right': '\u203A',// single right-pointing angle quotation
  'chevron-left': '\u2039', // single left-pointing angle quotation
  'chevron-up': '\u2303',   // up arrowhead
  'chevron-down': '\u2304', // down arrowhead
  'plus': '+',
  'minus': '\u2212',        // minus sign
  'search': '\u2315',       // telephone recorder
  'star': '\u2605',         // black star
  'star-outline': '\u2606', // white star
  'heart': '\u2665',        // black heart
  'heart-outline': '\u2661',// white heart
  'info': '\u2139',         // information source
  'warning': '\u26A0',      // warning sign
  'error': '\u2718',        // heavy ballot x
  'success': '\u2714',      // heavy check mark
  'home': '\u2302',         // house
  'settings': '\u2699',     // gear
  'edit': '\u270E',         // lower right pencil
  'delete': '\u2421',       // symbol for delete
  'trash': '\u2421',
  'copy': '\u2398',         // next page
  'link': '\u26D3',         // chains (link)
  'external-link': '\u2197',// north east arrow
  'mail': '\u2709',         // envelope
  'lock': '\u26BF',         // squared key (closest to lock)
  'unlock': '\u26BF',
  'eye': '\u25C9',          // fisheye
  'eye-off': '\u25CE',      // bullseye
  'menu': '\u2630',         // trigram for heaven (hamburger)
  'more': '\u2026',         // horizontal ellipsis
  'refresh': '\u21BB',      // clockwise open circle arrow
  'download': '\u2913',     // downwards arrow to bar
  'upload': '\u2912',       // upwards arrow to bar
  'filter': '\u25BD',       // white down-pointing triangle
  'sort': '\u2195',         // up down arrow
  'spinner': '\u25E6',      // white bullet
  'calendar': '\u25A1',     // white square
  'clock': '\u25F7',        // white circle with upper right quadrant
  'user': '\u2603',         // snowman (common fallback)
  'folder': '\u25A1',       // white square
  'file': '\u25A0',         // black square
};

const FALLBACK_GLYPH = '\u25C6'; // black diamond

// --------------- Component ---------------

export const Icon: React.FC<IconProps> = ({
  name = '',
  size = 'md',
  color,
  label,
  decorative = true,
  dataPart,
}) => {
  const glyph = ICON_MAP[name.toLowerCase()] ?? FALLBACK_GLYPH;

  return (
    <Text color={color} bold={size === 'lg'}>
      {glyph}
      {label && !decorative ? ` ${label}` : ''}
    </Text>
  );
};

Icon.displayName = 'Icon';
export default Icon;
