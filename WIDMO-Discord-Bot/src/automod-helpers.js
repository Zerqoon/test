// No network requests are made to links supplied by users.
export function normalizeLinkText(input) {
  let text = String(input || '').normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu, '')
    .replace(/[\u3002\uFF0E\uFF61]/gu, '.')
    .replace(/&(?:amp|#38|#x26);/giu, '&')
    .replace(/&(?:period|#46|#x2e);/giu, '.')
    .replace(/&(?:sol|#47|#x2f);/giu, '/')
    .replace(/\\([.:/\[\]()])/gu, '$1');
  for (let n = 0; n < 3; n += 1) {
    // Decode individual bytes without allowing malformed percent sequences to defeat normalization.
    const decoded = text.replace(/(?:%[a-f\d]{2})+/giu, (part) => { try { return decodeURIComponent(part); } catch { return part; } });
    if (decoded === text) break;
    text = decoded;
  }
  return text.normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu, '').replace(/[\u3002\uFF0E\uFF61]/gu, '.');
}

export function containsDiscordInvite(input) {
  const compact = normalizeLinkText(input).toLowerCase()
    .replace(/[\[({]\s*(?:\.|dot|kropka)\s*[\])}]/gu, '.')
    .replace(/\s+(?:dot|kropka)\s+/gu, '.')
    .replace(/\s+/gu, '').replace(/\\/gu, '/');
  // Removing formatting detects ordinary markdown/backtick concealment and separated letters.
  const plain = compact.replace(/[*_`|]/gu, '');
  return /(?:discord\.(?:gg|me|io|li)\b|discord(?:app)?\.com\/(?:invite|api\/(?:v\d+\/)?invites)(?:\/|\b)|discord\.com\/servers\/[^\s<>]+)/iu.test(plain);
}

export function extractLinks(input) {
  const text = normalizeLinkText(input);
  const candidates = [];
  // Explicit schemes include unusual schemes: those are links too and must not evade gating.
  for (const match of text.matchAll(/\b[a-z][a-z\d+.-]*:\/\/[^\s<>"`]+/giu)) {
    const raw = match[0].replace(/[),;!\]}]+$/gu, '');
    try {
      const parsed = new URL(raw);
      candidates.push({ raw, hostname: parsed.hostname.toLowerCase().replace(/\.$/u, ''), protocol: parsed.protocol });
    } catch { candidates.push({ raw, hostname: '', protocol: '' }); }
  }
  // Match naked domains, protocol-relative links and markdown destinations. URL hostname parsing
  // below deliberately prevents youtube.com.evil.test, username@evil.test and IDN lookalikes.
  const domains = /(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,62})\.)+(?:[\p{L}]{2,63}|xn--[a-z\d-]+)(?::\d{1,5})?(?:\/[^\s<>"`]*)?/giu;
  for (const match of text.matchAll(domains)) {
    const raw = match[0].replace(/[),;!\]}]+$/gu, '');
    try {
      const parsed = new URL(`https://${raw}`);
      candidates.push({ raw, hostname: parsed.hostname.toLowerCase().replace(/\.$/u, ''), protocol: 'https:' });
    } catch { candidates.push({ raw, hostname: '', protocol: '' }); }
  }
  // IPv4 / IPv6 URLs without schemes should be gated, too.
  for (const match of text.matchAll(/(?:\b(?:\d{1,3}\.){3}\d{1,3}|\[[a-f\d:]+\])(?::\d+)?(?:\/[^\s<>"`]*)?/giu)) {
    try { const parsed = new URL(`https://${match[0]}`); candidates.push({ raw: match[0], hostname: parsed.hostname, protocol: 'https:' }); }
    catch { candidates.push({ raw: match[0], hostname: '', protocol: '' }); }
  }
  return candidates;
}

export function allowedHostname(hostname, allowedDomains) {
  return allowedDomains.some((domain) => {
    const allowed = domain.toLowerCase().replace(/\.$/u, '');
    return hostname === allowed || hostname.endsWith(`.${allowed}`);
  });
}

export function assessMessage({ content = '', linkTexts = [], hasAttachments = false, hasStickers = false, veteran = false, level = 0 }, settings) {
  const combined = [content, ...linkTexts].join('\n');
  if (containsDiscordInvite(combined)) return { allowed: false, reason: 'Zaproszenia i linki do serwerów Discord są zabronione, także dla Weteranów.' };
  if ((hasAttachments || hasStickers) && !veteran && level < settings.imageMinLevel) {
    return { allowed: false, reason: `Zdjęcia, pliki i naklejki są dostępne od ${settings.imageMinLevel}. poziomu lub z rangą Weteran.` };
  }
  const links = extractLinks(combined);
  if (!links.length) return { allowed: true };
  if (!veteran && level < settings.linkMinLevel) return { allowed: false, reason: `Linki, także GIF-y z linków, są dostępne od ${settings.linkMinLevel}. poziomu lub z rangą Weteran.` };
  if (!veteran && links.some((link) => !['http:', 'https:'].includes(link.protocol) || !allowedHostname(link.hostname, settings.allowedDomains))) {
    return { allowed: false, reason: 'Dozwolone są tylko Giphy, Tenor, Roblox, YouTube, TikTok oraz klipy Twitch i Medal. Weteran może udostępniać inne linki poza zaproszeniami Discord.' };
  }
  return { allowed: true };
}
