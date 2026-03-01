/* ---------------------------------------------------------------------------
 * PolicyEditor state machine
 * States: visual (initial), json, validating, validated, validationError,
 *         simulating, simulationResult
 * ------------------------------------------------------------------------- */

export type PEState = 'visual' | 'json' | 'validating' | 'validated' | 'validationError' | 'simulating' | 'simulationResult';
export type PEEvent =
  | { type: 'SWITCH_JSON' }
  | { type: 'SWITCH_VISUAL' }
  | { type: 'VALIDATE' }
  | { type: 'VALID' }
  | { type: 'INVALID' }
  | { type: 'SIMULATE' }
  | { type: 'SIMULATION_COMPLETE' }
  | { type: 'CANCEL' }
  | { type: 'DISMISS' }
  | { type: 'FIX' }
  | { type: 'CHANGE' };

export function peReducer(state: PEState, event: PEEvent): PEState {
  switch (state) {
    case 'visual':
      if (event.type === 'SWITCH_JSON') return 'json';
      if (event.type === 'VALIDATE') return 'validating';
      if (event.type === 'SIMULATE') return 'simulating';
      return state;
    case 'json':
      if (event.type === 'SWITCH_VISUAL') return 'visual';
      if (event.type === 'VALIDATE') return 'validating';
      if (event.type === 'SIMULATE') return 'simulating';
      return state;
    case 'validating':
      if (event.type === 'VALID') return 'validated';
      if (event.type === 'INVALID') return 'validationError';
      if (event.type === 'CANCEL') return 'visual';
      return state;
    case 'validated':
      if (event.type === 'DISMISS') return 'visual';
      if (event.type === 'SWITCH_JSON') return 'json';
      if (event.type === 'CHANGE') return 'visual';
      return state;
    case 'validationError':
      if (event.type === 'DISMISS') return 'visual';
      if (event.type === 'SWITCH_JSON') return 'json';
      if (event.type === 'FIX') return 'visual';
      return state;
    case 'simulating':
      if (event.type === 'SIMULATION_COMPLETE') return 'simulationResult';
      if (event.type === 'CANCEL') return 'visual';
      return state;
    case 'simulationResult':
      if (event.type === 'DISMISS') return 'visual';
      if (event.type === 'SIMULATE') return 'simulating';
      return state;
    default:
      return state;
  }
}
