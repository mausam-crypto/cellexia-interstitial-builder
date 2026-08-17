/**
 * Upload images to Shopify Files (the store's CDN) so every page asset is
 * hosted on cdn.shopify.com — fast, permanent, and reachable from the storefront.
 *
 * Two paths:
 *  - uploadFileBuffer(): stagedUploadsCreate → PUT/POST to the staged target → fileCreate
 *  - uploadFromUrl(): fileCreate with originalSource = public URL (Shopify fetches it)
 * Both poll until the file is READY and return the CDN URL.
 */

type Admin = { graphql: (query: string, opts?: { variables?: Record<string, any> }) => Promise<Response> };

async function gql<T = any>(admin: Admin, query: string, variables?: Record<string, any>): Promise<T> {
  const res = await admin.graphql(query, { variables });
  const json = (await res.json()) as any;
  if (json.errors?.length) throw new Error(json.errors.map((e: any) => e.message).join("; "));
  return json.data as T;
}

const FILE_FIELDS = `
  id fileStatus alt
  ... on MediaImage { image { url width height } }
  ... on GenericFile { url }
`;

export interface UploadedFile {
  id: string;
  url: string;
  width?: number;
  height?: number;
}

export async function uploadFileBuffer(admin: Admin, buffer: Buffer, filename: string, mimeType: string, alt?: string): Promise<UploadedFile> {
  const isImage = mimeType.startsWith("image/") && mimeType !== "image/svg+xml";
  const staged = await gql<any>(
    admin,
    `mutation staged($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } } }`,
    { input: [{ filename, mimeType, httpMethod: "POST", resource: isImage ? "IMAGE" : "FILE", fileSize: String(buffer.length) }] },
  );
  const errs = staged.stagedUploadsCreate.userErrors;
  if (errs?.length) throw new Error(errs.map((e: any) => e.message).join("; "));
  const target = staged.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
  const up = await fetch(target.url, { method: "POST", body: form });
  if (!up.ok && up.status !== 201 && up.status !== 204) throw new Error(`Staged upload failed: ${up.status} ${await up.text().catch(() => "")}`);
  return createFile(admin, target.resourceUrl, alt, isImage);
}

export async function uploadFromUrl(admin: Admin, url: string, alt?: string): Promise<UploadedFile> {
  const isSvg = /\.svg(\?|$)/i.test(url);
  return createFile(admin, url, alt, !isSvg);
}

async function createFile(admin: Admin, originalSource: string, alt: string | undefined, isImage: boolean): Promise<UploadedFile> {
  const created = await gql<any>(
    admin,
    `mutation fileCreate($files: [FileCreateInput!]!) { fileCreate(files: $files) { files { ${FILE_FIELDS} } userErrors { field message code } } }`,
    { files: [{ originalSource, alt: alt || "", contentType: isImage ? "IMAGE" : "FILE" }] },
  );
  const errs = created.fileCreate.userErrors;
  if (errs?.length) throw new Error(errs.map((e: any) => e.message).join("; "));
  const file = created.fileCreate.files[0];
  return waitForFile(admin, file);
}

async function waitForFile(admin: Admin, file: any): Promise<UploadedFile> {
  let current = file;
  for (let i = 0; i < 20; i++) {
    const url = current.image?.url || current.url;
    if (current.fileStatus === "READY" && url) return { id: current.id, url, width: current.image?.width, height: current.image?.height };
    if (current.fileStatus === "FAILED") throw new Error("Shopify could not process the file");
    await new Promise((r) => setTimeout(r, 1000 + i * 250));
    const data = await gql<any>(admin, `query file($id: ID!) { node(id: $id) { ${FILE_FIELDS} } }`, { id: current.id });
    current = data.node;
  }
  const url = current.image?.url || current.url;
  if (url) return { id: current.id, url, width: current.image?.width, height: current.image?.height };
  throw new Error("Timed out waiting for Shopify to process the file");
}

export function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop() || "";
  return (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
      avif: "image/avif",
    } as Record<string, string>
  )[ext] || "application/octet-stream";
}
