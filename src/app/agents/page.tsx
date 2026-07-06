"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Play, Loader2, Trash2, ArrowRightLeft, Check } from "lucide-react";
import { useMirrl } from "@/lib/store";
import { SignInGate } from "@/components/MemoryStatus";
import { Markdown } from "@/components/Markdown";
import { AGENTS, agentById, stepPrompt, type Task, type Observation } from "@/lib/agents";

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now()}-${Math.random()}`);

export default function AgentsPage() {
  const { signedIn, model, network } = useMirrl();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goal, setGoal] = useState("");
  const [assign, setAssign] = useState(AGENTS[0].id);
  const [running, setRunning] = useState<string | null>(null);
  const [stream, setStream] = useState<{ id: string; text: string } | null>(null);
  const modelRef = useRef(model);
  modelRef.current = model;

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      const d = await fetch("/api/tasks").then((r) => r.json());
      setTasks(d.tasks ?? []);
    } catch {}
  }, [signedIn]);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (t: Task) => {
    await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t) }).catch(() => {});
  };

  async function createTask() {
    const g = goal.trim();
    if (!g) return;
    const t: Task = { id: uuid(), goal: g, assigned: assign, status: "open", observations: [] };
    setTasks((ts) => [t, ...ts]);
    setGoal("");
    await save(t);
  }

  async function runStep(task: Task) {
    setRunning(task.id);
    setStream({ id: task.id, text: "" });
    const agent = agentById(task.assigned);
    let acc = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: agent.system, messages: [{ role: "user", content: stepPrompt(task) }], model: modelRef.current, network }),
      });
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      let buf = "";
      if (reader)
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const ev = JSON.parse(line);
              if (ev.type === "delta" && ev.text) {
                acc += ev.text;
                setStream({ id: task.id, text: acc });
              }
            } catch {}
          }
        }
    } catch {}
    const obs: Observation = { agent: task.assigned, text: acc.trim() || "(no output)", at: Date.now() };
    const updated: Task = { ...task, status: "in_progress", observations: [...task.observations, obs] };
    setTasks((ts) => ts.map((t) => (t.id === task.id ? updated : t)));
    setStream(null);
    setRunning(null);
    await save(updated);
  }

  async function handoff(task: Task, to: string) {
    const updated = { ...task, assigned: to };
    setTasks((ts) => ts.map((t) => (t.id === task.id ? updated : t)));
    await save(updated);
  }
  async function setStatus(task: Task, status: Task["status"]) {
    const updated = { ...task, status };
    setTasks((ts) => ts.map((t) => (t.id === task.id ? updated : t)));
    await save(updated);
  }
  async function del(id: string) {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    await fetch(`/api/tasks?id=${id}`, { method: "DELETE" }).catch(() => {});
  }

  if (!signedIn) {
    return <SignInGate title="Your agent team" subtitle="A team of agents that reason over your own 0G memory and hand work to each other. Sign in to put them to work." />;
  }

  return (
    <main className="flex flex-1 flex-col overflow-y-auto px-6 py-6">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-3xl font-bold">Agents</h1>
        <p className="mt-1 text-sm text-muted">A team grounded in your own memory on 0G — each step is real inference, cited from what Mirrl remembers.</p>

        {/* team */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AGENTS.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.accent }} />
                <span className="text-sm font-semibold">{a.name}</span>
              </div>
              <p className="mt-1 text-[11px] capitalize text-muted-2">{a.role}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted">{a.blurb}</p>
            </div>
          ))}
        </div>

        {/* new task */}
        <div className="mt-5 rounded-2xl border border-border bg-surface p-3">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="Give the team a goal — e.g. “Summarize what you know about me and suggest what to work on next.”"
            className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted-2 focus:border-border-strong"
          />
          <div className="mt-2 flex items-center gap-2">
            <select value={assign} onChange={(e) => setAssign(e.target.value)} className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm">
              {AGENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.role}
                </option>
              ))}
            </select>
            <button onClick={createTask} disabled={!goal.trim()} className="ml-auto flex items-center gap-1.5 rounded-lg brand-grad px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              <Plus size={15} /> New task
            </button>
          </div>
        </div>

        {/* tasks */}
        <div className="mt-6 space-y-4">
          {tasks.length === 0 && <p className="py-10 text-center text-sm text-muted">No tasks yet. Give the team a goal above.</p>}
          {tasks.map((t) => {
            const agent = agentById(t.assigned);
            const isRunning = running === t.id;
            return (
              <div key={t.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{t.goal}</p>
                  <button onClick={() => del(t.id)} className="shrink-0 rounded-md p-1 text-muted-2 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: agent.accent }} /> {agent.name}
                  </span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs capitalize text-muted">{t.status}</span>
                </div>

                {(t.observations.length > 0 || (stream && stream.id === t.id)) && (
                  <div className="mt-3 space-y-3 border-l border-border pl-3">
                    {t.observations.map((o, i) => (
                      <div key={i}>
                        <div className="mb-0.5 flex items-center gap-1.5 text-xs" style={{ color: agentById(o.agent).accent }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: agentById(o.agent).accent }} /> {agentById(o.agent).name}
                        </div>
                        <div className="text-sm text-foreground">
                          <Markdown>{o.text}</Markdown>
                        </div>
                      </div>
                    ))}
                    {stream && stream.id === t.id && (
                      <div>
                        <div className="mb-0.5 flex items-center gap-1.5 text-xs" style={{ color: agent.accent }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: agent.accent }} /> {agent.name}
                        </div>
                        <div className="text-sm text-foreground">
                          <Markdown>{stream.text || "…"}</Markdown>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={() => runStep(t)} disabled={isRunning} className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-60">
                    {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    Run {agent.name}
                  </button>
                  <div className="flex items-center gap-1 text-xs text-muted-2">
                    <ArrowRightLeft size={13} /> hand to
                    {AGENTS.filter((a) => a.id !== t.assigned).map((a) => (
                      <button key={a.id} onClick={() => handoff(t, a.id)} className="rounded px-1.5 py-0.5 hover:bg-surface-2 hover:text-foreground" style={{ color: a.accent }}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                  {t.status !== "done" && (
                    <button onClick={() => setStatus(t, "done")} className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-emerald-400">
                      <Check size={13} /> Done
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
