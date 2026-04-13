'use client';

/**
 * UserSyncEditor — React adapter for the user-sync-editor.widget spec.
 *
 * Connects to SyncAutomationProvider through the Clef kernel exclusively
 * via useKernelInvoke. Routes lifecycle actions to:
 *   SyncAutomationProvider/define    — create/update a sync definition
 *   SyncAutomationProvider/validate  — validate and scope-check
 *   SyncAutomationProvider/activate  — register with SyncEngine
 *   SyncAutomationProvider/suspend   — remove from SyncEngine
 *
 * Widget spec: surface/widgets/user-sync-editor.widget
 * Anatomy parts (data-part): root, nameInput, sourceTextarea, statusBadge,
 *   validateButton, activateButton, suspendButton, scopeViolationsPanel,
 *   violationRow, authorField
 *
 * FSM states (data-state on root): draft, validating, validated, activating,
 *   active, suspending, suspended, validation-failed, scope-violation
 *
 * ActionBinding seeds referenced: user-sync-define, user-sync-validate,
 *   user-sync-activate, user-sync-suspend
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { ActionButton } from './ActionButton';
import { Badge } from './Badge';
import { KeybindingHint } from './KeybindingHint';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SyncLifecycleState =
  | 'draft'
  | 'validating'
  | 'validated'
  | 'activating'
  | 'active'
  | 'suspending'
  | 'suspended'
  | 'validation-failed'
  | 'scope-violation';

interface Violation {
  actionRef: string;
  reason: string;
}

export interface UserSyncEditorProps {
  /** Existing sync definition ID — undefined when creating new */
  syncId?: string;
  /** Initial name value */
  initialName?: string;
  /** Initial source text value */
  initialSource?: string;
  /** Initial status (drives FSM initial state) */
  initialStatus?: string;
  /** Initial author */
  initialAuthor?: string;
  /** Called after successful define/save */
  onSaved?: (syncId: string) => void;
  /** Called after successful activate */
  onActivated?: (syncId: string) => void;
  /** Called after successful suspend */
  onSuspended?: (syncId: string) => void;
  mode?: 'create' | 'edit';
  context?: { syncId?: string; name?: string; source?: string; status?: string; author?: string } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusToFsmState(status: string): SyncLifecycleState {
  switch (status?.toLowerCase()) {
    case 'validated':  return 'validated';
    case 'active':     return 'active';
    case 'suspended':  return 'suspended';
    default:           return 'draft';
  }
}

function statusBadgeVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (status?.toLowerCase()) {
    case 'active':     return 'success';
    case 'validated':  return 'info';
    case 'suspended':  return 'warning';
    case 'draft':      return 'default';
    default:           return 'default';
  }
}

// ---------------------------------------------------------------------------
// UserSyncEditor
// ---------------------------------------------------------------------------

export const UserSyncEditor: React.FC<UserSyncEditorProps> = ({
  syncId: syncIdProp,
  initialName = '',
  initialSource = '',
  initialStatus = 'draft',
  initialAuthor = '',
  onSaved,
  onActivated,
  onSuspended,
  mode = 'edit',
  context,
}) => {
  const isCreate = mode === 'create';
  const invoke = useKernelInvoke();

  // ------- form fields --------
  const [name, setName] = useState(initialName);
  const [sourceText, setSourceText] = useState(initialSource);
  const [author, setAuthor] = useState(initialAuthor);
  const [syncId, setSyncId] = useState<string | undefined>(syncIdProp);

  // ------- FSM state --------
  const [fsmState, setFsmState] = useState<SyncLifecycleState>(
    statusToFsmState(initialStatus),
  );

  // ------- display status --------
  const [displayStatus, setDisplayStatus] = useState(initialStatus || 'draft');

  // ------- validation / scope state --------
  const [validationError, setValidationError] = useState<string>('');
  const [violations, setViolations] = useState<Violation[]>([]);

  // ------- advanced field disclosure --------
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Keep name/source refs stable for async callbacks
  const nameRef = useRef(name);
  const sourceRef = useRef(sourceText);
  const authorRef = useRef(author);
  useEffect(() => { nameRef.current = name; }, [name]);
  useEffect(() => { sourceRef.current = sourceText; }, [sourceText]);
  useEffect(() => { authorRef.current = author; }, [author]);

  // Sync external prop changes
  useEffect(() => { setName(initialName); }, [initialName]);
  useEffect(() => { setSourceText(initialSource); }, [initialSource]);
  useEffect(() => { setAuthor(initialAuthor); }, [initialAuthor]);
  useEffect(() => {
    if (syncIdProp !== undefined) setSyncId(syncIdProp);
  }, [syncIdProp]);

  // ---------------------------------------------------------------------------
  // DEFINE (save)
  // ---------------------------------------------------------------------------

  const handleDefine = useCallback(async (): Promise<string | null> => {
    try {
      const result = await invoke('SyncAutomationProvider', 'define', {
        name: nameRef.current,
        source_text: sourceRef.current,
        author: authorRef.current,
      });
      if (result.variant === 'ok' && result.sync_def) {
        const id = result.sync_def as string;
        setSyncId(id);
        onSaved?.(id);
        return id;
      }
      return null;
    } catch {
      return null;
    }
  }, [invoke, onSaved]);

  // ---------------------------------------------------------------------------
  // VALIDATE
  // ---------------------------------------------------------------------------

  const handleValidate = useCallback(async () => {
    if (
      fsmState === 'validating' ||
      fsmState === 'activating' ||
      fsmState === 'suspending' ||
      fsmState === 'active'
    ) return;

    setFsmState('validating');
    setValidationError('');
    setViolations([]);

    try {
      // Ensure we have a saved definition first
      let id = syncId;
      if (!id) {
        id = await handleDefine() ?? undefined;
        if (!id) {
          setValidationError('Could not save sync definition before validating.');
          setFsmState('validation-failed');
          return;
        }
      }

      const result = await invoke('SyncAutomationProvider', 'validate', {
        sync_def: id,
      });

      if (result.variant === 'ok') {
        if (result.action_ref) {
          // Scope violation response
          const vs: Violation[] = [];
          if (typeof result.action_ref === 'string') {
            vs.push({ actionRef: result.action_ref as string, reason: (result.reason as string) ?? '' });
          }
          setViolations(vs);
          setDisplayStatus('Draft');
          setFsmState('scope-violation');
        } else if (result.message) {
          // Compilation failure
          setValidationError(result.message as string);
          setDisplayStatus('Draft');
          setFsmState('validation-failed');
        } else {
          // Success
          setDisplayStatus('Validated');
          setFsmState('validated');
        }
      } else {
        setValidationError(`Validation returned: ${result.variant}`);
        setFsmState('validation-failed');
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Unexpected error during validation.');
      setFsmState('validation-failed');
    }
  }, [fsmState, syncId, invoke, handleDefine]);

  // ---------------------------------------------------------------------------
  // ACTIVATE
  // ---------------------------------------------------------------------------

  const handleActivate = useCallback(async () => {
    if (fsmState !== 'validated') return;

    setFsmState('activating');

    try {
      const result = await invoke('SyncAutomationProvider', 'activate', {
        sync_def: syncId,
      });

      if (result.variant === 'ok') {
        setDisplayStatus('Active');
        setFsmState('active');
        if (syncId) onActivated?.(syncId);
      } else {
        setFsmState('validated');
      }
    } catch {
      setFsmState('validated');
    }
  }, [fsmState, syncId, invoke, onActivated]);

  // ---------------------------------------------------------------------------
  // SUSPEND
  // ---------------------------------------------------------------------------

  const handleSuspend = useCallback(async () => {
    if (fsmState !== 'active') return;

    setFsmState('suspending');

    try {
      const result = await invoke('SyncAutomationProvider', 'suspend', {
        sync_def: syncId,
      });

      if (result.variant === 'ok') {
        setDisplayStatus('Suspended');
        setFsmState('suspended');
        if (syncId) onSuspended?.(syncId);
      } else {
        setFsmState('active');
      }
    } catch {
      setFsmState('active');
    }
  }, [fsmState, syncId, invoke, onSuspended]);

  // ---------------------------------------------------------------------------
  // Keyboard bindings (widget spec: Ctrl+S / Ctrl+V → validate, Ctrl+Enter → activate)
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's' || e.key === 'v') {
        e.preventDefault();
        handleValidate();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (fsmState === 'validated') handleActivate();
      }
    }
    if (e.key === 'Escape') {
      if (fsmState === 'validation-failed' || fsmState === 'scope-violation') {
        setFsmState('draft');
        setValidationError('');
        setViolations([]);
      }
    }
  }, [fsmState, handleValidate, handleActivate]);

  // ---------------------------------------------------------------------------
  // Derived booleans
  // ---------------------------------------------------------------------------

  const isTransitioning =
    fsmState === 'validating' ||
    fsmState === 'activating' ||
    fsmState === 'suspending';

  const isEditable =
    !isTransitioning &&
    fsmState !== 'active';

  const validateDisabled =
    isTransitioning ||
    fsmState === 'active';

  const activateDisabled = fsmState !== 'validated';

  const showSuspendButton = fsmState === 'active';

  const showScopePanel = fsmState === 'scope-violation';

  const showValidationError =
    fsmState === 'validation-failed' && validationError.length > 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      data-part="root"
      data-state={fsmState}
      data-advanced={advancedOpen ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md, 16px)',
        padding: 'var(--spacing-lg, 24px)',
        background: 'var(--palette-surface)',
        borderRadius: 'var(--radius-lg, 8px)',
        border: '1px solid var(--palette-outline-variant)',
      }}
    >
      {/* Header row: status badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--spacing-sm, 8px)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 'var(--typography-heading-sm-size, 1rem)', fontWeight: 600 }}>
          {isCreate ? 'Create Sync' : syncId ? 'Edit User Sync' : 'New User Sync'}
        </h2>
        <span data-part="statusBadge">
          <Badge variant={statusBadgeVariant(displayStatus)}>{displayStatus}</Badge>
        </span>
      </div>

      {/* Name input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs, 4px)' }}>
        <label
          htmlFor="user-sync-name"
          style={{ fontSize: 'var(--typography-body-sm-size, 0.875rem)', fontWeight: 500 }}
        >
          Name
        </label>
        <input
          data-part="nameInput"
          id="user-sync-name"
          type="text"
          value={name}
          disabled={!isEditable}
          placeholder="e.g. auto-tag-on-publish"
          aria-label="Sync name"
          aria-required="true"
          onChange={(e) => { setName(e.target.value); if (fsmState !== 'draft') setFsmState('draft'); }}
          style={{
            padding: 'var(--spacing-sm, 8px) var(--spacing-md, 12px)',
            borderRadius: 'var(--radius-md, 6px)',
            border: '1px solid var(--palette-outline)',
            fontSize: 'var(--typography-body-size, 0.9375rem)',
            fontFamily: 'inherit',
            background: isEditable ? 'var(--palette-surface)' : 'var(--palette-surface-dim)',
          }}
        />
      </div>

      {/* Source textarea */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs, 4px)' }}>
        <label
          htmlFor="user-sync-source"
          style={{ fontSize: 'var(--typography-body-sm-size, 0.875rem)', fontWeight: 500 }}
        >
          Sync Source
        </label>
        <textarea
          data-part="sourceTextarea"
          id="user-sync-source"
          value={sourceText}
          disabled={!isEditable}
          rows={16}
          spellCheck={false}
          aria-label="Sync source text"
          aria-multiline="true"
          aria-required="true"
          placeholder={'sync MySyncName [eager]\nwhen {\n  Concept/action: [ field: ?var ] => [ result: ?res ]\n}\nthen {\n  Target/action: [ field: ?var ]\n}'}
          onChange={(e) => { setSourceText(e.target.value); if (fsmState !== 'draft') setFsmState('draft'); }}
          style={{
            padding: 'var(--spacing-sm, 8px) var(--spacing-md, 12px)',
            borderRadius: 'var(--radius-md, 6px)',
            border: '1px solid var(--palette-outline)',
            fontFamily: 'var(--typography-mono-family, monospace)',
            fontSize: 'var(--typography-mono-size, 0.875rem)',
            lineHeight: 1.6,
            resize: 'vertical',
            background: isEditable ? 'var(--palette-surface)' : 'var(--palette-surface-dim)',
          }}
        />
      </div>

      {/* Scope violations panel — shown only in scope-violation state */}
      {showScopePanel && violations.length > 0 && (
        <div
          data-part="scopeViolationsPanel"
          role="region"
          aria-label="Scope violations"
          aria-live="assertive"
          style={{
            padding: 'var(--spacing-md, 12px)',
            borderRadius: 'var(--radius-md, 6px)',
            background: 'var(--palette-error-container, #fef2f2)',
            border: '1px solid var(--palette-error, #ef4444)',
          }}
        >
          <p style={{
            margin: '0 0 var(--spacing-sm, 8px)',
            fontWeight: 600,
            color: 'var(--palette-on-error-container, #7f1d1d)',
            fontSize: 'var(--typography-body-sm-size, 0.875rem)',
          }}>
            Scope violations — these actions are blocked by the active AutomationScope:
          </p>
          {violations.map((v, i) => (
            <div
              key={i}
              data-part="violationRow"
              style={{
                display: 'flex',
                gap: 'var(--spacing-sm, 8px)',
                padding: 'var(--spacing-xs, 4px) 0',
                borderTop: i > 0 ? '1px solid var(--palette-error-dim, #fca5a5)' : undefined,
                fontSize: 'var(--typography-body-sm-size, 0.875rem)',
              }}
            >
              <code style={{ fontWeight: 600, color: 'var(--palette-error, #dc2626)' }}>
                {v.actionRef}
              </code>
              <span style={{ color: 'var(--palette-on-error-container, #7f1d1d)' }}>
                {v.reason}
              </span>
            </div>
          ))}
          <p style={{
            margin: 'var(--spacing-sm, 8px) 0 0',
            fontSize: 'var(--typography-body-sm-size, 0.875rem)',
            color: 'var(--palette-on-error-container, #7f1d1d)',
          }}>
            Edit the sync source to remove or replace blocked action references,
            then validate again. Use the Scope Browser below to see which actions are allowed.
          </p>
        </div>
      )}

      {/* Validation error panel */}
      {showValidationError && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: 'var(--spacing-md, 12px)',
            borderRadius: 'var(--radius-md, 6px)',
            background: 'var(--palette-error-container, #fef2f2)',
            border: '1px solid var(--palette-error, #ef4444)',
            fontSize: 'var(--typography-body-sm-size, 0.875rem)',
            color: 'var(--palette-on-error-container, #7f1d1d)',
          }}
        >
          <strong>Validation failed: </strong>{validationError}
        </div>
      )}

      {/* Advanced fields toggle */}
      <button
        type="button"
        aria-expanded={advancedOpen}
        aria-controls="user-sync-advanced"
        onClick={() => setAdvancedOpen((v) => !v)}
        style={{
          alignSelf: 'flex-start',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 'var(--typography-body-sm-size, 0.875rem)',
          color: 'var(--palette-primary)',
          padding: 0,
        }}
      >
        {advancedOpen ? '▾ Hide advanced' : '▸ Show advanced'}
      </button>

      {/* Advanced section: author field */}
      <div
        id="user-sync-advanced"
        hidden={!advancedOpen}
        style={{
          display: advancedOpen ? 'flex' : 'none',
          flexDirection: 'column',
          gap: 'var(--spacing-xs, 4px)',
        }}
      >
        <label
          htmlFor="user-sync-author"
          style={{ fontSize: 'var(--typography-body-sm-size, 0.875rem)', fontWeight: 500 }}
        >
          Author
        </label>
        <input
          data-part="authorField"
          id="user-sync-author"
          type="text"
          value={author}
          disabled={!isEditable}
          placeholder="e.g. admin"
          aria-label="Author"
          onChange={(e) => setAuthor(e.target.value)}
          style={{
            padding: 'var(--spacing-sm, 8px) var(--spacing-md, 12px)',
            borderRadius: 'var(--radius-md, 6px)',
            border: '1px solid var(--palette-outline)',
            fontSize: 'var(--typography-body-size, 0.9375rem)',
            fontFamily: 'inherit',
            background: isEditable ? 'var(--palette-surface)' : 'var(--palette-surface-dim)',
          }}
        />
      </div>

      {/* Action row */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-sm, 8px)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* Create mode: primary save button dispatches define to create the entity */}
        {isCreate && (
          <ActionButton
            binding="user-sync-define"
            context={{ name, sourceText, author }}
            label="Create Sync"
            buttonVariant="primary"
            disabled={!name.trim() || !sourceText.trim()}
            onSuccess={() => handleDefine().then(() => { /* created */ })}
            onError={() => { /* handled inside handleDefine */ }}
          />
        )}

        {/* Validate — ActionButton wired to user-sync-validate seed */}
        <ActionButton
          binding="user-sync-validate"
          context={{ syncId, name, sourceText, author }}
          label={fsmState === 'validating' ? 'Validating…' : 'Validate'}
          buttonVariant="default"
          disabled={validateDisabled}
          onSuccess={() => handleValidate()}
          onError={() => { /* handled inside handleValidate */ }}
        />

        {/* Activate and Suspend — only shown in edit mode after a sync exists */}
        {!isCreate && (
          <>
            {/* Activate — ActionButton wired to user-sync-activate seed */}
            <ActionButton
              binding="user-sync-activate"
              context={{ syncId }}
              label={fsmState === 'activating' ? 'Activating…' : 'Activate'}
              buttonVariant="primary"
              disabled={activateDisabled}
              onSuccess={() => handleActivate()}
              onError={() => { /* no-op */ }}
            />

            {/* Suspend — only shown when active */}
            {showSuspendButton && (
              <ActionButton
                binding="user-sync-suspend"
                context={{ syncId }}
                label={fsmState === 'suspending' ? 'Suspending…' : 'Suspend'}
                buttonVariant="destructive"
                disabled={fsmState === 'suspending'}
                onSuccess={() => handleSuspend()}
                onError={() => { /* no-op */ }}
              />
            )}
          </>
        )}

        {/* Keyboard hint — TODO KB-16+: seed "user-sync-validate-kbd" and "user-sync-activate-kbd" bindings */}
        <span style={{
          marginLeft: 'auto',
          fontSize: 'var(--typography-body-sm-size, 0.75rem)',
          color: 'var(--palette-on-surface-variant)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25em',
          flexWrap: 'wrap',
        }}>
          <KeybindingHint actionBindingId="user-sync-validate-kbd" variant="keycap-only" />
          {' '}to validate
          {' ·'}
          {' '}
          <KeybindingHint actionBindingId="user-sync-activate-kbd" variant="keycap-only" />
          {' '}to activate · Esc to reset
        </span>
      </div>
    </div>
  );
};

export default UserSyncEditor;
