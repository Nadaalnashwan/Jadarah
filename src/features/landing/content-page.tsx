import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Editorial layout shared by public content pages. */
export function ContentPage({
  eyebrow,
  title,
  intro,
  sections,
  cta,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: { title: string; body: string | string[] }[];
  cta?: { href: string; label: string }[];
}) {
  return (
    <article className="mx-auto max-w-5xl px-4 pt-32 pb-24 sm:px-6 sm:pt-40">
      <p className="eyebrow mb-4">{eyebrow}</p>
      <h1 className="editorial text-4xl font-extrabold text-balance sm:text-6xl">{title}</h1>
      <p className="text-muted mt-6 max-w-3xl text-lg leading-relaxed sm:text-xl">{intro}</p>
      <div className="mt-16 grid gap-10 md:grid-cols-2">
        {sections.map((s, i) => (
          <section key={s.title} className="border-t pt-6">
            <p className="ltr-nums text-primary dark:text-lavender text-sm font-bold">0{i + 1}</p>
            <h2 className="mt-2 text-2xl font-extrabold">{s.title}</h2>
            {Array.isArray(s.body) ? (
              <ul className="text-muted mt-3 list-disc space-y-1.5 ps-5">
                {s.body.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted mt-3 leading-relaxed">{s.body}</p>
            )}
          </section>
        ))}
      </div>
      {cta && (
        <div className="mt-16 flex flex-wrap gap-3">
          {cta.map((c, i) => (
            <Button key={c.href} asChild size="lg" variant={i ? "outline" : "primary"}>
              <Link href={c.href}>{c.label}</Link>
            </Button>
          ))}
        </div>
      )}
    </article>
  );
}
