/* ---------------------------------------------------------------------------
 * TraceStepControls — Vanilla widget
 * States: paused (initial), playing
 * ------------------------------------------------------------------------- */

export type TraceStepControlsState = 'paused' | 'playing';
export type TraceStepControlsEvent =
  | { type: 'PLAY' }
  | { type: 'STEP_FWD' }
  | { type: 'STEP_BACK' }
  | { type: 'JUMP_START' }
  | { type: 'JUMP_END' }
  | { type: 'PAUSE' }
  | { type: 'REACH_END' };

export function traceStepControlsReducer(state: TraceStepControlsState, event: TraceStepControlsEvent): TraceStepControlsState {
  switch (state) {
    case 'paused':
      if (event.type === 'PLAY') return 'playing';
      if (event.type === 'STEP_FWD') return 'paused';
      if (event.type === 'STEP_BACK') return 'paused';
      if (event.type === 'JUMP_START') return 'paused';
      if (event.type === 'JUMP_END') return 'paused';
      return state;
    case 'playing':
      if (event.type === 'PAUSE') return 'paused';
      if (event.type === 'REACH_END') return 'paused';
      return state;
    default:
      return state;
  }
}

const SPEED_OPTIONS = [1, 2, 4] as const;

export interface TraceStepControlsProps {
  currentStep: number; totalSteps: number; playing: boolean;
  speed?: number; showSpeed?: boolean;
  onStepForward?: () => void; onStepBack?: () => void;
  onPlay?: () => void; onPause?: () => void;
  onSeek?: (step: number) => void; onFirst?: () => void; onLast?: () => void;
  onSpeedChange?: (speed: number) => void;
  className?: string; [key: string]: unknown;
}
export interface TraceStepControlsOptions { target: HTMLElement; props: TraceStepControlsProps; }
let _uid = 0;

export class TraceStepControls {
  private el: HTMLElement;
  private props: TraceStepControlsProps;
  private state: TraceStepControlsState;
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private playInterval: ReturnType<typeof setInterval> | null = null;
  private rovingIdx = 2;

  constructor(private options: TraceStepControlsOptions) {
    this.props = { ...options.props };
    this.state = this.props.playing ? 'playing' : 'paused';
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', ''); this.el.setAttribute('data-widget-name', 'trace-step-controls');
    this.el.setAttribute('data-part', 'root'); this.el.setAttribute('role', 'toolbar');
    this.el.setAttribute('aria-label', 'Trace step controls'); this.el.setAttribute('tabindex', '0');
    this.el.id = 'trace-step-controls-' + this.uid;
    const kd = (e: KeyboardEvent) => this.onKey(e);
    this.el.addEventListener('keydown', kd); this.disposers.push(() => this.el.removeEventListener('keydown', kd));
    this.syncPlayback(); this.render(); options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  private sm(ev: TraceStepControlsEvent): void { this.state = traceStepControlsReducer(this.state, ev); this.el.setAttribute('data-state', this.state); }

  update(props: Partial<TraceStepControlsProps>): void {
    Object.assign(this.props, props);
    if (props.playing !== undefined) {
      if (props.playing && this.state === 'paused') this.sm({ type: 'PLAY' });
      else if (!props.playing && this.state === 'playing') this.sm({ type: 'PAUSE' });
    }
    this.syncPlayback(); this.render();
  }

  destroy(): void { this.stopPlayback(); this.disposers.forEach(d => d()); this.el.remove(); }

  private get atFirst(): boolean { return this.props.currentStep <= 0; }
  private get atLast(): boolean { return this.props.currentStep >= this.props.totalSteps - 1; }
  private get progressPct(): number { return this.props.totalSteps > 0 ? ((this.props.currentStep + 1) / this.props.totalSteps) * 100 : 0; }

  private stopPlayback(): void { if (this.playInterval !== null) { clearInterval(this.playInterval); this.playInterval = null; } }
  private startPlayback(): void {
    this.stopPlayback();
    const ms = 1000 / (this.props.speed ?? 1);
    this.playInterval = setInterval(() => {
      if (this.atLast) { this.sm({ type: 'REACH_END' }); this.props.onPause?.(); this.stopPlayback(); this.render(); return; }
      this.props.onStepForward?.();
    }, ms);
  }
  private syncPlayback(): void { if (this.state === 'playing') this.startPlayback(); else this.stopPlayback(); }

  private doPlay(): void { if (this.atLast) return; this.sm({ type: 'PLAY' }); this.props.onPlay?.(); this.syncPlayback(); this.render(); }
  private doPause(): void { this.sm({ type: 'PAUSE' }); this.props.onPause?.(); this.syncPlayback(); this.render(); }
  private doStepFwd(): void { if (this.atLast) return; this.sm({ type: 'STEP_FWD' }); this.props.onStepForward?.(); this.render(); }
  private doStepBack(): void { if (this.atFirst) return; this.sm({ type: 'STEP_BACK' }); this.props.onStepBack?.(); this.render(); }
  private doJumpStart(): void { if (this.atFirst) return; this.sm({ type: 'JUMP_START' }); this.props.onFirst?.(); this.render(); }
  private doJumpEnd(): void { if (this.atLast) return; this.sm({ type: 'JUMP_END' }); this.props.onLast?.(); this.render(); }

  private onKey(e: KeyboardEvent): void {
    switch (e.key) {
      case ' ': e.preventDefault(); if (this.state === 'playing') this.doPause(); else this.doPlay(); break;
      case 'ArrowRight': e.preventDefault(); this.doStepFwd(); break;
      case 'ArrowLeft': e.preventDefault(); this.doStepBack(); break;
      case 'Home': e.preventDefault(); this.doJumpStart(); break;
      case 'End': e.preventDefault(); this.doJumpEnd(); break;
    }
  }

  private render(): void {
    this.el.innerHTML = '';
    const p = this.props;
    this.el.setAttribute('data-state', this.state);
    if (p.className) this.el.className = p.className;

    // Transport buttons
    const tr = document.createElement('div'); tr.setAttribute('data-part', 'transport'); tr.setAttribute('data-state', this.state);
    const btns: { part: string; label: string; text: string; disabled: boolean; handler: () => void }[] = [
      { part: 'jump-start', label: 'Jump to start', text: '\u25C4\u2502', disabled: this.atFirst, handler: () => this.doJumpStart() },
      { part: 'step-back', label: 'Step backward', text: '\u25C4', disabled: this.atFirst, handler: () => this.doStepBack() },
      { part: 'play-pause', label: this.state === 'playing' ? 'Pause' : 'Play', text: this.state === 'playing' ? '\u23F8' : '\u25B6', disabled: false, handler: () => { if (this.state === 'playing') this.doPause(); else this.doPlay(); } },
      { part: 'step-fwd', label: 'Step forward', text: '\u25BA', disabled: this.atLast, handler: () => this.doStepFwd() },
      { part: 'jump-end', label: 'Jump to end', text: '\u2502\u25BA', disabled: this.atLast, handler: () => this.doJumpEnd() },
    ];
    btns.forEach((b, i) => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('data-part', b.part); btn.setAttribute('data-state', this.state);
      btn.setAttribute('aria-label', b.label); btn.disabled = b.disabled;
      if (b.disabled) btn.setAttribute('aria-disabled', 'true');
      btn.tabIndex = i === this.rovingIdx ? 0 : -1; btn.textContent = b.text;
      btn.addEventListener('click', b.handler); tr.appendChild(btn);
    });
    this.el.appendChild(tr);

    // Step counter
    const sc = document.createElement('span'); sc.setAttribute('data-part', 'step-counter'); sc.setAttribute('data-state', this.state);
    sc.setAttribute('role', 'status'); sc.setAttribute('aria-live', 'polite');
    sc.setAttribute('aria-label', `Step ${p.currentStep + 1} of ${p.totalSteps}`);
    sc.textContent = `Step ${p.currentStep + 1} of ${p.totalSteps}`; this.el.appendChild(sc);

    // Progress bar
    const pb = document.createElement('div'); pb.setAttribute('data-part', 'progress-bar'); pb.setAttribute('data-state', this.state);
    pb.setAttribute('role', 'progressbar'); pb.setAttribute('aria-valuenow', String(p.currentStep + 1));
    pb.setAttribute('aria-valuemin', '1'); pb.setAttribute('aria-valuemax', String(p.totalSteps));
    pb.setAttribute('aria-label', 'Trace progress'); pb.style.cssText = 'cursor:pointer;position:relative';
    pb.addEventListener('click', (e) => {
      if (p.totalSteps <= 0) return;
      const rect = pb.getBoundingClientRect(); const x = e.clientX - rect.left;
      const ratio = x / rect.width; const step = Math.max(0, Math.min(p.totalSteps - 1, Math.round(ratio * (p.totalSteps - 1))));
      p.onSeek?.(step);
    });
    const pf = document.createElement('div'); pf.setAttribute('data-part', 'progress-fill'); pf.setAttribute('data-state', this.state);
    pf.style.cssText = `width:${this.progressPct}%;height:100%;position:absolute;top:0;left:0`;
    pb.appendChild(pf); this.el.appendChild(pb);

    // Speed control
    if (p.showSpeed !== false) {
      const spd = document.createElement('div'); spd.setAttribute('data-part', 'speed-control'); spd.setAttribute('data-state', this.state); spd.setAttribute('data-visible', 'true');
      SPEED_OPTIONS.forEach(s => {
        const sb = document.createElement('button'); sb.type = 'button'; sb.setAttribute('data-part', 'speed-option'); sb.setAttribute('data-state', this.state);
        sb.setAttribute('data-selected', s === (p.speed ?? 1) ? 'true' : 'false');
        sb.setAttribute('aria-label', `Playback speed ${s}x`); sb.setAttribute('aria-pressed', s === (p.speed ?? 1) ? 'true' : 'false');
        sb.textContent = `${s}x`; sb.addEventListener('click', () => p.onSpeedChange?.(s));
        spd.appendChild(sb);
      });
      this.el.appendChild(spd);
    }
  }
}

export default TraceStepControls;
