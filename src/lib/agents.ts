import agents from '../../agents.json';

export type AgentConfig = {
  agentId: string;
  name: string;
  purpose?: string;
  pin?: boolean;
};

export function getAgents(): AgentConfig[] {
  const list = (agents as AgentConfig[]) ?? [];
  // Friday always on top: pin=true first, then name.
  return [...list].sort((a, b) => {
    const ap = a.pin ? 0 : 1;
    const bp = b.pin ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name);
  });
}
