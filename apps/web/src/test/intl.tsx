import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { formats } from "../i18n/config";

export type TestLocale = "en" | "fr";

/** Renders `ui` with the app's real message catalogs. */
export function renderWithIntl(ui: ReactElement, { locale = "en" }: { locale?: TestLocale } = {}) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
      timeZone="UTC"
      formats={formats}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}
