import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "../lib/auth.server";
import prisma from "../db.server";
import { uploadFileBuffer } from "../lib/integrations/shopify-files.server";

/** POST multipart {file} → uploads to Shopify Files, returns { image: { src, alt, width, height } } */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin } = await requireAdmin(request);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return Response.json({ error: "Max 20 MB" }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const alt = String(form.get("alt") || file.name.replace(/\.\w+$/, "").replace(/[-_]/g, " "));
    if (!admin) {
      // Dev mode: keep as data URL so the editor still works without Shopify.
      const src = `data:${file.type};base64,${buf.toString("base64")}`;
      return Response.json({ image: { src, alt } });
    }
    const up = await uploadFileBuffer(admin, buf, file.name, file.type || "application/octet-stream", alt);
    await prisma.imageAsset.create({ data: { shop, url: up.url, source: "upload", alt, width: up.width, height: up.height } });
    return Response.json({ image: { src: up.url, alt, width: up.width, height: up.height } });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
};
