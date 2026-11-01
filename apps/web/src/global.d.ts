import type en from "../messages/en.json";
import type { AppLocale, formats } from "./i18n/config";

declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof en;
    Formats: typeof formats;
  }
}
