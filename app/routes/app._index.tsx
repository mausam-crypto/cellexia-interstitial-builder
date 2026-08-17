import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, useFetcher, useLoaderData, useNavigate } from "react-router";
import {
  Page,
  Card,
  IndexTable,
  Badge,
  Text,
  Button,
  ButtonGroup,
  InlineStack,
  BlockStack,
  Banner,
  Modal,
  TextField,
  EmptyState,
  Box,
} from "@shopify/polaris";
import { requireAdmin } from "../lib/auth.server";
import { listPages, getSettings, getPageStats, publishPage, unpublishPage, deletePage, duplicatePage } from "../lib/pages.server";
import { ensureSeeded } from "../lib/seed/seed.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, admin } = await requireAdmin(request);
  // Make sure the baseline pages exist even if afterAuth didn't run (e.g. re-install without OAuth).
  const settings = await getSettings(shop);
  if (!settings.seededAt) {
    try {
      await ensureSeeded(shop, { admin });
    } catch (e) {
      console.error("[seed]", e);
    }
  }
  const pages = await listPages(shop);
  const stats = await Promise.all(pages.map((p) => getPageStats(shop, p.id, 30)));
  const { defaults, brand } = await getSettings(shop);
  const storeUrl = (brand.storeUrl || `https://${defaults.storeDomain || shop}`).replace(/\/$/, "");
  return {
    shop,
    storeUrl,
    proxyPrefix: defaults.proxyPrefix,
    pages: pages.map((p, i) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      isTemplate: p.isTemplate,
      productTitle: p.productTitle,
      productHandle: p.productHandle,
      updatedAt: p.updatedAt.toISOString(),
      publishedAt: p.publishedAt?.toISOString() || null,
      hasUnpublishedChanges: p.hasUnpublishedChanges,
      previewToken: p.previewToken,
      funnelLabel: p.draft.funnelLabel || "",
      sections: p.draft.sections.length,
      stats: { views: stats[i].views, addToCarts: stats[i].addToCarts, ctr: stats[i].ctr },
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const id = String(form.get("id") || "");
  try {
    if (intent === "publish") {
      const r = await publishPage(shop, id);
      return { ok: true, message: `Published (${(r.bytes / 1024).toFixed(0)} KB)`, warnings: r.warnings };
    }
    if (intent === "unpublish") {
      await unpublishPage(shop, id);
      return { ok: true, message: "Unpublished — the URL now returns 404" };
    }
    if (intent === "delete") {
      await deletePage(shop, id);
      return { ok: true, message: "Page deleted" };
    }
    if (intent === "duplicate") {
      const title = String(form.get("title") || "Copy");
      const p = await duplicatePage(shop, id, { title, slug: String(form.get("slug") || title) });
      return { ok: true, message: `Duplicated as “${p.title}”`, redirect: `/app/pages/${p.id}` };
    }
    if (intent === "reseed") {
      const r = await ensureSeeded(shop, { force: true });
      return { ok: true, message: `Baseline pages re-seeded (${r.pages.join(", ")})` };
    }
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  }
  return { ok: false, message: "Unknown action" };
};

export default function PagesIndex() {
  const { pages, storeUrl, proxyPrefix } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const [dup, setDup] = useState<{ id: string; title: string } | null>(null);
  const [dupTitle, setDupTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data && (fetcher.data as any).redirect) navigate((fetcher.data as any).redirect);
  }, [fetcher.data, navigate]);

  const rows = pages.map((p, index) => {
    const url = `${storeUrl}${proxyPrefix}/${p.slug}`;
    return (
      <IndexTable.Row id={p.id} key={p.id} position={index}>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <InlineStack gap="200" blockAlign="center">
              <Link to={`/app/pages/${p.id}`} style={{ fontWeight: 600, textDecoration: "none" }}>
                {p.title}
              </Link>
              {p.isTemplate && <Badge tone="info">Template</Badge>}
            </InlineStack>
            <Text as="span" tone="subdued" variant="bodySm">
              {p.funnelLabel || p.productTitle || "—"} · {p.sections} sections
            </Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {p.status === "published" ? (
            <InlineStack gap="100">
              <Badge tone="success">Live</Badge>
              {p.hasUnpublishedChanges && <Badge tone="attention">Unpublished changes</Badge>}
            </InlineStack>
          ) : (
            <Badge>Draft</Badge>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <a href={url} target="_blank" rel="noreferrer" className="ib-mono" title={url}>
            {proxyPrefix}/{p.slug}
          </a>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">
            {p.stats.views} visits · {p.stats.addToCarts} ATC · {(p.stats.ctr * 100).toFixed(1)}%
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <ButtonGroup>
            <Button size="slim" onClick={() => navigate(`/app/pages/${p.id}`)}>
              Edit
            </Button>
            <Button size="slim" url={`/preview/${p.id}?token=${p.previewToken}`} target="_blank">
              Preview
            </Button>
            <Button
              size="slim"
              onClick={() => {
                setDup({ id: p.id, title: p.title });
                setDupTitle(`${p.title} (copy)`);
              }}
            >
              Duplicate
            </Button>
            {p.status === "published" ? (
              <Button size="slim" tone="critical" onClick={() => fetcher.submit({ intent: "unpublish", id: p.id }, { method: "post" })} disabled={busy}>
                Unpublish
              </Button>
            ) : (
              <Button size="slim" variant="primary" onClick={() => fetcher.submit({ intent: "publish", id: p.id }, { method: "post" })} disabled={busy}>
                Publish
              </Button>
            )}
            <Button size="slim" tone="critical" variant="plain" onClick={() => setConfirmDelete({ id: p.id, title: p.title })}>
              Delete
            </Button>
          </ButtonGroup>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Interstitial pages"
      subtitle="Every page is built from the same section library. Duplicate the template to launch a new funnel in minutes."
      primaryAction={{ content: "New page from template", onAction: () => navigate("/app/pages/new") }}
      secondaryActions={[
        { content: "Analytics", onAction: () => navigate("/app/analytics") },
        { content: "Settings", onAction: () => navigate("/app/settings") },
      ]}
    >
      <BlockStack gap="400">
        {fetcher.data && (
          <Banner tone={(fetcher.data as any).ok ? "success" : "critical"} onDismiss={() => {}}>
            <p>{(fetcher.data as any).message}</p>
            {(fetcher.data as any).warnings?.length ? (
              <ul>
                {(fetcher.data as any).warnings.map((w: string) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </Banner>
        )}
        <Card padding="0">
          {pages.length ? (
            <IndexTable
              resourceName={{ singular: "page", plural: "pages" }}
              itemCount={pages.length}
              selectable={false}
              headings={[{ title: "Page" }, { title: "Status" }, { title: "URL" }, { title: "Last 30 days" }, { title: "Actions" }]}
            >
              {rows}
            </IndexTable>
          ) : (
            <Box padding="400">
              <EmptyState heading="No pages yet" action={{ content: "Re-seed baseline pages", onAction: () => fetcher.submit({ intent: "reseed" }, { method: "post" }) }} image="">
                <p>The three baseline pages (Crepey Skin, Jawline, Dark Spots) are created automatically on install.</p>
              </EmptyState>
            </Box>
          )}
        </Card>
        <Card>
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">
              How pages go live
            </Text>
            <Text as="p" tone="subdued">
              Pages render on your own domain through the app proxy: <span className="ib-mono">{storeUrl}{proxyPrefix}/&lt;slug&gt;</span> — inside your real store header and footer,
              with prices localised per market. Publishing freezes the current draft; editing again never changes the live page until you publish again.
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>

      <Modal open={!!dup} onClose={() => setDup(null)} title={`Duplicate “${dup?.title}”`} primaryAction={{ content: "Duplicate", onAction: () => { if (dup) fetcher.submit({ intent: "duplicate", id: dup.id, title: dupTitle, slug: dupTitle }, { method: "post" }); setDup(null); } }} secondaryActions={[{ content: "Use the guided wizard instead", onAction: () => navigate(`/app/pages/new?from=${dup?.id}`) }]}>
        <Modal.Section>
          <TextField label="New page title" value={dupTitle} onChange={setDupTitle} autoComplete="off" helpText="Creates an exact copy as a draft. Use the guided wizard to also swap product, bundles, discount code and product-specific copy." />
        </Modal.Section>
      </Modal>
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={`Delete “${confirmDelete?.title}”?`} primaryAction={{ content: "Delete page", destructive: true, onAction: () => { if (confirmDelete) fetcher.submit({ intent: "delete", id: confirmDelete.id }, { method: "post" }); setConfirmDelete(null); } }} secondaryActions={[{ content: "Cancel", onAction: () => setConfirmDelete(null) }]}>
        <Modal.Section>
          <Text as="p">This removes the page and its analytics. The URL will return 404. This cannot be undone.</Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
