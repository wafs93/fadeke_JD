import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadLatestKit } from "@/lib/kit";
import { PrintButton } from "@/components/kit/PrintButton";
import { findPlaceholders } from "@/lib/util";

export const dynamic = "force-dynamic";

function Marked({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]{2,60}\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <mark key={i} className="bg-yellow-200 font-bold text-black">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function CvPrint({ text }: { text: string }) {
  const lines = text.split("\n");
  const first = lines.findIndex((l) => l.trim());
  const name = first >= 0 ? lines[first].trim() : "";
  const contact = lines[first + 1]?.trim() && !lines[first + 1].trim().startsWith("#") ? lines[first + 1].trim() : "";
  const rest = lines.slice(first + (contact ? 2 : 1));

  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="mb-2 list-disc pl-5">
          {bullets.map((b, i) => (
            <li key={i}>
              <Marked text={b} />
            </li>
          ))}
        </ul>
      );
      bullets = [];
    }
  };

  rest.forEach((raw, i) => {
    const line = raw.trim();
    if (/^[-•]\s+/.test(line)) {
      bullets.push(line.replace(/^[-•]\s+/, ""));
      return;
    }
    flush();
    if (!line) return;
    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={i} className="mb-1 mt-4 border-b border-gray-400 pb-0.5 font-sans text-[13pt] font-bold">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={i} className="mt-2 font-bold">
          <Marked text={line.slice(4)} />
        </h3>
      );
    } else {
      blocks.push(
        <p key={i} className="mb-1">
          <Marked text={line} />
        </p>
      );
    }
  });
  flush();

  return (
    <article className="text-[11pt] leading-snug">
      <h1 className="text-center font-sans text-2xl font-bold">
        <Marked text={name} />
      </h1>
      {contact && (
        <p className="mb-3 text-center text-sm">
          <Marked text={contact} />
        </p>
      )}
      {blocks}
    </article>
  );
}

function ParagraphsPrint({ text }: { text: string }) {
  return (
    <article className="space-y-4 text-[11pt] leading-relaxed">
      {text
        .split(/\n\s*\n/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            <Marked text={p.trim()} />
          </p>
        ))}
    </article>
  );
}

export default async function KitPrintPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { doc?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const kit = await loadLatestKit(supabase, user.id, params.id);
  if (!kit) notFound();

  const doc = searchParams.doc === "cover" ? "cover" : searchParams.doc === "answers" ? "answers" : "cv";
  const text = doc === "cover" ? kit.cover_letter : doc === "answers" ? kit.answers_text : kit.cv_text;
  const placeholders = findPlaceholders(text);

  return (
    <div className="min-h-dvh bg-white text-black">
      <div className="no-print flex flex-wrap items-center gap-3 border-b border-line bg-tint px-4 py-3 text-ink">
        <PrintButton />
        <p className="text-sm font-semibold">
          In the print window, choose &quot;Save as PDF&quot; as the printer.
          {placeholders.length > 0 && ` Still to fill: ${placeholders.join(", ")}.`}
        </p>
      </div>
      <div className="mx-auto max-w-[800px] px-8 py-10 print:p-0">
        {doc === "cv" ? <CvPrint text={text} /> : <ParagraphsPrint text={text} />}
      </div>
    </div>
  );
}
