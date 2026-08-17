import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { login } from "../shopify.server";
import { loginErrorMessage } from "./auth.login.error";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));
  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));
  return { errors };
};

export default function Auth() {
  return null;
}
