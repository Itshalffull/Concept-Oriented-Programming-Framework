// Conduit Example App — In-Process Transport
// Default mode: all concepts run in the same Node.js process.
// This is the zero-config mode used by the standard server.

export const transportConfig = {
  mode: 'in-process' as const,
  description: 'All 10 concepts run in a single process via direct function calls',
};
