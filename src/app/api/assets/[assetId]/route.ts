import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // RLS decides whether this user can see a prompt or a released rationale.
  const { data: asset, error } = await supabase
    .from("question_assets")
    .select("storage_path")
    .eq("id", assetId)
    .single();
  if (error || !asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
  const { data: signed, error: signedError } = await admin.storage
    .from("question-assets")
    .createSignedUrl(asset.storage_path, 60);
  if (signedError) {
    return NextResponse.json({ error: signedError.message }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
