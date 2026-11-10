import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Editorial layout shared by public content pages. */
export function ContentPage({ eyebrow, title, intro, sections, cta }: { eyebrow: string; title: string; intro: string; sections: { title: string; body: string | string[] }[]; cta?: { href: string; label: string }[] }) {
  return (
    <article className="mx-auto max-w-5xl px-4 pt-32 pb-24 sm:px-6 sm:pt-40">
      <p className="eyebrow mb-4">{eyebrow}</p>
      <h1 className="editorial text-balance text-4xl font-extrabold sm:text-6xl">{title}</h1>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted sm:text-xl">{intro}</p>
      <div className="mt-16 grid gap-10 md:grid-cols-2">
        {sections.map((s, i) => (
          <section key={s.title} className="border-t pt-6">
            <p className="ltr-nums text-sm font-bold text-primary dark:text-lavender">0{i + 1}</p>
            <h2 className="mt-2 text-2xl font-extrabold">{s.title}</h2>
            {Array.isArray(s.body) ? <ul className="mt-3 list-disc space-y-1.5 ps-5 text-muted">{s.body.map((b) => <li key={b}>{b}</li>)}</ul> : <p className="mt-3 leading-relaxed text-muted">{s.body}</p>}
          </section>
        ))}
      </div>
      {cta && <div className="mt-16 flex flex-wrap gap-3">{cta.map((c, i) => <Button key={c.href} asChild size="lg" variant={i ? "outline" : "primary"}><Link href={c.href}>{c.label}</Link></Button>)}</div>}
    </article>
  );
}
