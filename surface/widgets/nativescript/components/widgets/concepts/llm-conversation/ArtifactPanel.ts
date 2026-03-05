export type ArtifactPanelState = 'open' | 'copied' | 'fullscreen' | 'closed';
export type ArtifactPanelEvent =
  | { type: 'COPY' }
  | { type: 'FULLSCREEN' }
  | { type: 'CLOSE' }
  | { type: 'VERSION_CHANGE' }
  | { type: 'COPY_TIMEOUT' }
  | { type: 'EXIT_FULLSCREEN' }
  | { type: 'OPEN' };

export function artifactPanelReducer(state: ArtifactPanelState, event: ArtifactPanelEvent): ArtifactPanelState {
  switch (state) {
    case 'open':
      if (event.type === 'COPY') return 'copied';
      if (event.type === 'FULLSCREEN') return 'fullscreen';
      if (event.type === 'CLOSE') return 'closed';
      if (event.type === 'VERSION_CHANGE') return 'open';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'open';
      return state;
    case 'fullscreen':
      if (event.type === 'EXIT_FULLSCREEN') return 'open';
      if (event.type === 'CLOSE') return 'closed';
      return state;
    case 'closed':
      if (event.type === 'OPEN') return 'open';
      return state;
    default:
      return state;
  }
}

export interface ArtifactPanelProps { [key: string]: unknown; }

export function createArtifactPanel(props: ArtifactPanelProps) {
  let state: ArtifactPanelState = 'open';

  function send(type: string) {
    state = artifactPanelReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createArtifactPanel;
