import type { FieldDef } from "../../lib/types";

/** Serialisable subset of a SectionDef sent to the client. */
export interface ClientSectionDef {
  type: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  singleton?: boolean;
  fields: FieldDef[];
  defaults: Record<string, any>;
}

export interface LocaleInfo {
  locale: string;
  name: string;
  primary: boolean;
}
export interface MarketInfo {
  code: string; // country ISO
  name: string;
}
export interface LibraryImage {
  id: string;
  url: string;
  alt: string | null;
  source: string;
}

export function fieldPath(prefix: string, key: string) {
  return prefix ? `${prefix}.${key}` : key;
}
