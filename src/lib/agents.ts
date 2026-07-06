// Mirrl's agent team — persona agents that reason over the user's OWN, semantically
// recalled 0G memory (via /api/chat with a custom system prompt). Each step is a
// real 0G Compute inference grounded in memory; agents hand work to each other.

export type Observation = { agent: string; text: string; at: number };
export type TaskStatus = "open" | "in_progress" | "done";
export type Task = {
  id: string;
  goal: string;
  assigned: string; // agent id
  status: TaskStatus;
  observations: Observation[];
  updatedAt?: number;
};

export type Agent = { id: string; name: string; role: string; blurb: string; system: string; accent: string };

const SHARED =
  "You are one of four Mirrl agents (a researcher, a curator, a planner, a critic) that share the user's own memory, stored and owned on 0G. Ground every claim in the recalled memories you're given; never invent facts they don't support. Be concise (3-5 sentences). End with exactly one concrete next action, or a handoff naming the teammate who should take it next.";

export const AGENTS: Agent[] = [
  {
    id: "agent_researcher", name: "Atlas", role: "researcher",
    blurb: "Gathers facts and angles, proposes what's worth remembering.",
    system: `You are Atlas, the researcher. You gather facts, sources and angles from the user's memory and surface what's worth keeping. ${SHARED}`,
    accent: "#3b82f6",
  },
  {
    id: "agent_curator", name: "Vesta", role: "curator",
    blurb: "Organizes, dedupes and tags memory; decides what to keep.",
    system: `You are Vesta, the curator. You organize, dedupe and tag the shared memory, deciding what's durable versus noise. ${SHARED}`,
    accent: "#10b981",
  },
  {
    id: "agent_planner", name: "Orion", role: "planner",
    blurb: "Breaks goals into ordered steps and assigns handoffs.",
    system: `You are Orion, the planner. You break a goal into ordered steps, sequence the work and assign handoffs to the right teammate. ${SHARED}`,
    accent: "#f59e0b",
  },
  {
    id: "agent_critic", name: "Juno", role: "critic",
    blurb: "Reviews outputs, flags gaps and unsupported claims.",
    system: `You are Juno, the critic. You review the team's outputs, flag gaps, contradictions and claims the memory doesn't support, and validate the work. ${SHARED}`,
    accent: "#ef4444",
  },
];

export const agentById = (id: string): Agent => AGENTS.find((a) => a.id === id) ?? AGENTS[0];

// The grounded user turn for one agent step: the goal + the thread so far.
export function stepPrompt(task: Task): string {
  const prior = task.observations.length
    ? task.observations.map((o) => `- ${agentById(o.agent).name}: ${o.text}`).join("\n")
    : "(nothing yet)";
  return `Goal: ${task.goal}\n\nWhat the team has said so far:\n${prior}\n\nDo your part now, grounded in the recalled memories.`;
}
