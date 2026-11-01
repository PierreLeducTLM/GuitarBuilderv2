import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { formats, LOCALE_COOKIE, resolveLocale, resolveTimeZone, TIME_ZONE_COOKIE } from "./config";
import { loadMessages } from "./messages";

// next-intl without locale-prefixed URLs: the language comes from a cookie.
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: resolveTimeZone(store.get(TIME_ZONE_COOKIE)?.value),
    formats,
  };
});
