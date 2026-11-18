// Chỉ mở địa chỉ Google Maps HTTPS có đích đến, không chấp nhận domain giả hoặc URL tùy ý.
export function isGoogleMapsLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "www.google.com" &&
      !url.username && !url.password && !url.port &&
      /^\/maps\/(?:search|dir)\/?$/.test(url.pathname) &&
      url.searchParams.get("api") === "1" &&
      Boolean(url.searchParams.get("query")?.trim() || url.searchParams.get("destination")?.trim());
  } catch { return false; }
}
