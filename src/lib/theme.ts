import { useEffect } from "react";
import type { ThemePref } from "../domain/types";

export function applyTheme(pref: ThemePref) {
  if (pref === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = pref;
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · FlowDesk`;
  }, [title]);
}
