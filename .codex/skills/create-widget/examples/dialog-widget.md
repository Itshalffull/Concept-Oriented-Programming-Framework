# Worked Example: Dialog Widget

This document walks through the design of a Dialog widget step by step, explaining each decision. The final spec matches `repertoire/widgets/feedback/dialog.widget`.

## Design Rationale

A dialog is a modal overlay that:
- Captures focus and blocks interaction with the page behind it
- Supports both informational (`dialog`) and destructive confirmation (`alertdialog`) roles
- Manages focus trapping, scroll locking, and ARIA hidden management
- Restores state cleanly on close (focus returns, scroll unlocks)

## Step 1: Purpose

```
purpose {
  Modal overlay that captures focus and blocks interaction with the
  underlying page until dismissed. Supports both informational and
  alert-dialog roles with configurable backdrop, escape-to-close,
  and outside-click behaviours. Focus is trapped within the dialog
  content while open and restored to the trigger element on close.
}
```

Key decisions:
- Mentions "modal overlay" to distinguish from non-modal popovers
- Calls out the two ARIA roles it supports
- Explicitly states the focus management contract (trap + restore)
- Does NOT describe visual appearance

## Step 2: Anatomy

```
anatomy {
  root:         container  { top-level wrapper; provides stacking context }
  trigger:      action     { element that opens the dialog }
  backdrop:     overlay    { semi-transparent layer behind the dialog content }
  positioner:   container  { centres the dialog within the viewport }
  content:      container  { visible dialog surface holding all inner parts }
  title:        text       { heading that labels the dialog for sighted and AT users }
  description:  text       { supplementary text explaining the dialog purpose }
  closeTrigger: action     { explicit close button inside the dialog }
}
```

Key decisions:
- `backdrop` uses `overlay` role because it covers the viewport
- `positioner` is a separate container from `content` -- this allows the positioner to handle centering layout while content handles the visual surface
- `title` and `description` are separate `text` parts so they can be independently referenced by `aria-labelledby` and `aria-describedby`
- `closeTrigger` is distinct from `trigger` -- one opens, one closes

## Step 3: Slots

```
slots {
  header { before title }
  body   { after description }
  footer { end of content }
}
```

Dialogs need slots because consumers inject domain-specific content (forms, confirmation messages, action buttons) at specific structural positions.

## Step 4: State Machine

```
states {
  closed [initial] {
    on OPEN -> open;
  }

  open {
    on CLOSE            -> closed;
    on OUTSIDE_CLICK    -> closed;
    on ESCAPE           -> closed;
    entry [trapFocus, preventScroll, setAriaHidden];
    exit  [releaseFocus, restoreScroll, clearAriaHidden];
  }
}
```

Key decisions:
- Only two states needed -- a dialog is either open or closed
- Three distinct events can close: explicit close, outside click, and Escape key. Separating these allows the connect block to conditionally handle them based on props
- Entry actions handle all the side effects of opening: focus trap, scroll lock, ARIA hidden on siblings
- Exit actions cleanly reverse all entry actions

## Step 5: Accessibility

```
accessibility {
  role: dialog;
  modal: true;
  keyboard {
    Escape -> ESCAPE;
    Tab    -> FOCUS_NEXT;
  }
  focus {
    trap: true;
    initial: content;
    returnOnClose: trigger;
  }
  aria {
    labelledby: title;
    describedby: description;
  }
}
```

Key decisions:
- `role: dialog` is the primary role; the `alertdialog` variant is handled via the `role` prop
- `modal: true` signals that background content should be inert
- `trap: true` because dialog is modal -- Tab must cycle within the dialog
- `initial: content` focuses the content container, not a specific button, because the first focusable element varies by consumer content
- `returnOnClose: trigger` ensures focus returns to the element that opened the dialog
- ARIA uses the simple shorthand form since the mapping is straightforward

## Step 6: Props

```
props {
  open:                Bool                       = false;
  closeOnOutsideClick: Bool                       = true;
  closeOnEscape:       Bool                       = true;
  role:                "dialog" | "alertdialog"   = "dialog";
}
```

Key decisions:
- `open` is the controlled state prop (consumer manages open/close)
- `closeOnOutsideClick` and `closeOnEscape` are configurable behaviors, both defaulting to true
- `role` supports the two WAI-ARIA dialog roles as a union type
- No visual props (size, padding) -- those belong in themes/CSS, not the widget spec

## Step 7: Connect Block

```
connect {
  root -> {
    data-state: ?open ? "open" : "closed";
    data-role:  ?role;
  }

  trigger -> {
    aria-haspopup: "dialog";
    aria-expanded: ?open;
    onClick:       send(OPEN);
  }

  backdrop -> {
    data-state: ?open ? "open" : "closed";
    onClick:    ?closeOnOutsideClick ? send(OUTSIDE_CLICK) : noop;
  }

  positioner -> {
    data-state: ?open ? "open" : "closed";
  }

  content -> {
    role:             ?role;
    aria-modal:       true;
    aria-labelledby:  title;
    aria-describedby: description;
    data-state:       ?open ? "open" : "closed";
  }

  title -> {
    id: title;
  }

  description -> {
    id: description;
  }

  closeTrigger -> {
    aria-label: "Close";
    onClick:    send(CLOSE);
  }
}
```

Key decisions:
- `data-state` on multiple parts enables CSS transitions/animations per-part
- `backdrop.onClick` is conditional on the `closeOnOutsideClick` prop
- `content` gets the dynamic `role` from props, not hardcoded
- `title` and `description` get `id` attributes so `aria-labelledby` and `aria-describedby` can reference them
- `closeTrigger` gets `aria-label: "Close"` since it typically contains only an icon

## Step 8: Affordance

```
affordance {
  serves: overlay;
  specificity: 10;
  when {
    modal: true;
  }
}
```

The dialog serves the `overlay` purpose. Specificity 10 (maximum) because a modal dialog is the strongest overlay widget. The `when` condition distinguishes it from non-modal overlays like popovers.

## Step 9: Composition

```
compose {
  _portal:     widget("portal",     { target: "body" });
  _focusTrap:  widget("focus-trap",  { active: ?open });
  _scrollLock: widget("scroll-lock", { active: ?open });
  _presence:   widget("presence",    { present: ?open });
}
```

Four infrastructure widgets, all prefixed with `_`:
- `_portal` renders the dialog at the document root to escape stacking contexts
- `_focusTrap` handles Tab key cycling within the dialog
- `_scrollLock` prevents body scroll while the dialog is open
- `_presence` handles mount/unmount animations

## Step 10: Invariants

```
invariant {
  "Focus must be trapped inside content while open";
  "Backdrop must cover the entire viewport";
  "Trigger must regain focus after dialog closes";
  "aria-hidden must be set on sibling trees while open";
}
```

Four invariants covering the critical behavioral contracts:
1. Focus trapping (accessibility)
2. Backdrop coverage (modal behavior)
3. Focus restoration (accessibility)
4. Sibling inertness (accessibility)

## Complete Spec

```
@version(1)
widget dialog {

  purpose {
    Modal overlay that captures focus and blocks interaction with the
    underlying page until dismissed. Supports both informational and
    alert-dialog roles with configurable backdrop, escape-to-close,
    and outside-click behaviours. Focus is trapped within the dialog
    content while open and restored to the trigger element on close.
  }

  anatomy {
    root:         container  { top-level wrapper; provides stacking context }
    trigger:      action     { element that opens the dialog }
    backdrop:     overlay    { semi-transparent layer behind the dialog content }
    positioner:   container  { centres the dialog within the viewport }
    content:      container  { visible dialog surface holding all inner parts }
    title:        text       { heading that labels the dialog for sighted and AT users }
    description:  text       { supplementary text explaining the dialog purpose }
    closeTrigger: action     { explicit close button inside the dialog }
  }

  slots {
    header { before title }
    body   { after description }
    footer { end of content }
  }

  states {
    closed [initial] {
      on OPEN -> open;
    }

    open {
      on CLOSE            -> closed;
      on OUTSIDE_CLICK    -> closed;
      on ESCAPE           -> closed;
      entry [trapFocus, preventScroll, setAriaHidden];
      exit  [releaseFocus, restoreScroll, clearAriaHidden];
    }
  }

  accessibility {
    role: dialog;
    modal: true;
    keyboard {
      Escape -> ESCAPE;
      Tab    -> FOCUS_NEXT;
    }
    focus {
      trap: true;
      initial: content;
      returnOnClose: trigger;
    }
    aria {
      labelledby: title;
      describedby: description;
    }
  }

  props {
    open:                Bool                       = false;
    closeOnOutsideClick: Bool                       = true;
    closeOnEscape:       Bool                       = true;
    role:                "dialog" | "alertdialog"   = "dialog";
  }

  connect {
    root -> {
      data-state: ?open ? "open" : "closed";
      data-role:  ?role;
    }

    trigger -> {
      aria-haspopup: "dialog";
      aria-expanded: ?open;
      onClick:       send(OPEN);
    }

    backdrop -> {
      data-state: ?open ? "open" : "closed";
      onClick:    ?closeOnOutsideClick ? send(OUTSIDE_CLICK) : noop;
    }

    positioner -> {
      data-state: ?open ? "open" : "closed";
    }

    content -> {
      role:             ?role;
      aria-modal:       true;
      aria-labelledby:  title;
      aria-describedby: description;
      data-state:       ?open ? "open" : "closed";
    }

    title -> {
      id: title;
    }

    description -> {
      id: description;
    }

    closeTrigger -> {
      aria-label: "Close";
      onClick:    send(CLOSE);
    }
  }

  affordance {
    serves: overlay;
    specificity: 10;
    when {
      modal: true;
    }
  }

  compose {
    _portal:     widget("portal",     { target: "body" });
    _focusTrap:  widget("focus-trap",  { active: ?open });
    _scrollLock: widget("scroll-lock", { active: ?open });
    _presence:   widget("presence",    { present: ?open });
  }

  invariant {
    "Focus must be trapped inside content while open";
    "Backdrop must cover the entire viewport";
    "Trigger must regain focus after dialog closes";
    "aria-hidden must be set on sibling trees while open";
  }

}
```
