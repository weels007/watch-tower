import { Bot, Gavel, Globe, HandCoins, Satellite, Scale, ShieldCheck, Siren } from "lucide-react";

const STEPS = [
  {
    icon: Satellite,
    title: "Monitor",
    text: "Protocols register on-chain with slash conditions and evidence sources. Anyone can watch them.",
  },
  {
    icon: ShieldCheck,
    title: "Cover",
    text: "Users pay a premium into the shared pool and receive a policy with a coverage amount.",
  },
  {
    icon: Siren,
    title: "Report",
    text: "Anyone reports a suspected violation with an evidence URL. The incident goes pending.",
  },
  {
    icon: Gavel,
    title: "Adjudicate",
    text: "Validators independently fetch the evidence, an LLM judges it against the conditions, and consensus settles the verdict.",
  },
  {
    icon: HandCoins,
    title: "Payout",
    text: "Holders of confirmed violations claim from the pool, then withdraw. Every step is on-chain.",
  },
];

const WHY = [
  {
    icon: Bot,
    title: "Judgment, not just code",
    text: "LLM validators read evidence like an investigator — double-signs, downtime, SLA breaches — and decide against written conditions.",
  },
  {
    icon: Globe,
    title: "Live web, no oracle",
    text: "The contract fetches evidence itself at decision time. No middleman feed to trust, bribe, or break.",
  },
  {
    icon: Scale,
    title: "Consensus, appealable",
    text: "One leader proposes, validators independently verify. Disagreement rotates leadership instead of locking in a bad call.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 border-t border-border">
      <div className="mx-auto w-full max-w-[90rem] px-6 py-20 lg:px-10">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          How it works
        </p>
        <h2 className="mt-3 max-w-[24ch] text-3xl font-semibold tracking-tight sm:text-4xl">
          From suspicion to payout in five on-chain steps.
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-border bg-card p-5">
              <span className="font-mono text-xs text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <s.icon className="mt-3 size-5" />
              <h3 className="mt-3 font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {WHY.map((w) => (
            <article key={w.title} className="rounded-2xl border border-border bg-card p-6">
              <w.icon className="size-5 text-muted-foreground" />
              <h3 className="mt-3 font-medium">{w.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
