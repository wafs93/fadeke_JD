import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadLatestKit } from "@/lib/kit";
import { cvToDocx, letterToDocx } from "@/lib/docx";

export const dynamic = "force-dynamic";

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "job";
}

export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kit = await loadLatestKit(supabase, user.id, params.jobId);
  if (!kit) return NextResponse.json({ error: "No kit for this job yet" }, { status: 404 });

  const { data: job } = await supabase.from("jobs").select("company, title").eq("id", params.jobId).maybeSingle();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
  const who = slug(profile?.full_name || "CV");
  const where = slug(job?.company || job?.title || "job");

  const doc = request.nextUrl.searchParams.get("doc") === "cover" ? "cover" : "cv";
  const buffer = doc === "cover" ? await letterToDocx(kit.cover_letter) : await cvToDocx(kit.cv_text);
  const filename = `${who}-${doc === "cover" ? "cover-letter" : "CV"}-${where}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
