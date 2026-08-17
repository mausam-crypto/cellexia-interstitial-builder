import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { Page, Card, IndexTable, Text, BlockStack, InlineStack, Select, Layout, Box } from "@shopify/polaris";
import { requireAdmin } from "../lib/auth.server";
import { listPages, getPageStats } from "../lib/pages.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireAdmin(request);
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") || 30);
  const pages = await listPages(shop);
  const stats = await Promise.all(pages.map((p) => getPageStats(shop, p.id, days)));
  const focus = url.searchParams.get("page");
  return {
    days,
    focus,
    rows: pages.map((p, i) => ({ id: p.id, title: p.title, slug: p.slug, status: p.status, cards: (p.draft.sections.find((s) => s.type === "pricing")?.data?.cards || []).map((c: any) => c.title), ...stats[i] })),
  };
};

export default function Analytics() {
  const { rows, days, focus } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const detail = rows.find((r) => r.id === focus) || rows[0];
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  return (
    <Page title="Analytics" subtitle="First-party numbers per page: visits, CTA clicks, clicks on each pricing card and add-to-carts. Compare funnels and iterate on the sections that own the money.">
      <BlockStack gap="400">
        <InlineStack gap="200" blockAlign="center">
          <Select label="Range" labelHidden options={[{ label: "Last 7 days", value: "7" }, { label: "Last 30 days", value: "30" }, { label: "Last 90 days", value: "90" }, { label: "All time (365 days)", value: "365" }]} value={String(days)} onChange={(v) => { sp.set("days", v); setSp(sp); }} />
        </InlineStack>
        <Card padding="0">
          <IndexTable resourceName={{ singular: "page", plural: "pages" }} itemCount={rows.length} selectable={false} headings={[{ title: "Page" }, { title: "Visits" }, { title: "Visitors" }, { title: "CTA clicks" }, { title: "Card 1 / 2 / 3" }, { title: "Add to cart" }, { title: "ATC rate" }]}>
            {rows.map((r, i) => (
              <IndexTable.Row id={r.id} key={r.id} position={i} onClick={() => { sp.set("page", r.id); setSp(sp); }}>
                <IndexTable.Cell><Text as="span" fontWeight={r.id === detail?.id ? "bold" : "regular"}>{r.title}</Text><br /><Text as="span" tone="subdued" variant="bodySm">/{r.slug} · {r.status}</Text></IndexTable.Cell>
                <IndexTable.Cell>{r.views}</IndexTable.Cell>
                <IndexTable.Cell>{r.visitors}</IndexTable.Cell>
                <IndexTable.Cell>{r.ctaClicks}</IndexTable.Cell>
                <IndexTable.Cell>{r.cardClicks.slice(0, Math.max(3, r.cards.length)).join(" / ")}</IndexTable.Cell>
                <IndexTable.Cell>{r.addToCarts}</IndexTable.Cell>
                <IndexTable.Cell>{pct(r.ctr)}</IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
        {detail && (
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">{detail.title}</Text>
                    <a href={`/app/pages/${detail.id}`} onClick={(e) => { e.preventDefault(); navigate(`/app/pages/${detail.id}`); }}>Edit page</a>
                  </InlineStack>
                  <InlineStack gap="600">
                    <div><div className="ib-stat">{detail.views}</div><div className="ib-stat-label">visits</div></div>
                    <div><div className="ib-stat">{detail.visitors}</div><div className="ib-stat-label">unique visitors</div></div>
                    <div><div className="ib-stat">{detail.ctaClicks}</div><div className="ib-stat-label">CTA clicks (to offer)</div></div>
                    <div><div className="ib-stat">{detail.addToCarts}</div><div className="ib-stat-label">add to cart</div></div>
                    <div><div className="ib-stat">{pct(detail.ctr)}</div><div className="ib-stat-label">ATC per visitor</div></div>
                  </InlineStack>
                  <Text as="h3" variant="headingSm">Clicks per pricing card</Text>
                  <InlineStack gap="600">
                    {detail.cardClicks.map((n, i) => (
                      <div key={i}><div className="ib-stat">{n}</div><div className="ib-stat-label">Card {i + 1}{detail.cards[i] ? ` · ${detail.cards[i]}` : ""}</div></div>
                    ))}
                  </InlineStack>
                  <Text as="h3" variant="headingSm">By day</Text>
                  <Box>
                    <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                      <thead><tr style={{ textAlign: "left", color: "#6d7175" }}><th>Day</th><th>Visits</th><th>Add to cart</th></tr></thead>
                      <tbody>{detail.byDay.slice(-30).map((d) => (<tr key={d.day} style={{ borderTop: "1px solid #eee" }}><td>{d.day}</td><td>{d.views}</td><td>{d.addToCarts}</td></tr>))}</tbody>
                    </table>
                    {!detail.byDay.length && <Text as="p" tone="subdued">No events yet. Events are recorded once the page is live and visited.</Text>}
                  </Box>
                </BlockStack>
              </Card>
            </Layout.Section>
            <Layout.Section variant="oneThird">
              <BlockStack gap="400">
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">By traffic source (utm_source)</Text>
                    {detail.bySource.map((s) => (<InlineStack key={s.source} align="space-between"><Text as="span">{s.source}</Text><Text as="span">{s.views} · {s.addToCarts} ATC</Text></InlineStack>))}
                    {!detail.bySource.length && <Text as="p" tone="subdued">—</Text>}
                  </BlockStack>
                </Card>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">By market</Text>
                    {detail.byMarket.map((s) => (<InlineStack key={s.market} align="space-between"><Text as="span">{s.market}</Text><Text as="span">{s.views} · {s.addToCarts} ATC</Text></InlineStack>))}
                    {!detail.byMarket.length && <Text as="p" tone="subdued">—</Text>}
                  </BlockStack>
                </Card>
              </BlockStack>
            </Layout.Section>
          </Layout>
        )}
      </BlockStack>
    </Page>
  );
}
