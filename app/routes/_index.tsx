import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
};

export default function Index() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 40, maxWidth: 640, margin: "0 auto" }}>
      <h1>Cellexia Interstitial Builder</h1>
      <p>
        This is a Shopify embedded app. Open it from the Shopify admin (Apps →
        Cellexia Interstitial Builder), or install it with
        <code> /auth/login?shop=cellexia-labs.myshopify.com</code>.
      </p>
      <form method="post" action="/auth/login">
        <label>
          Shop domain <input type="text" name="shop" placeholder="my-shop.myshopify.com" />
        </label>
        <button type="submit">Log in</button>
      </form>
    </main>
  );
}
