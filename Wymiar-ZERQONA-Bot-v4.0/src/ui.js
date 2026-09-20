import { EmbedBuilder, MessageFlags, escapeMarkdown } from 'discord.js';

export const BRAND = Object.freeze({
  name: 'Wymiar ZERQONA', wordmark: 'WYMIAR ZERQONA', version: '4.0.0',
  color: 0x9B6CFF, error: 0xE15D92,
});
export const fmt = n => new Intl.NumberFormat('pl-PL').format(Number(n) || 0);
export const safe = value => escapeMarkdown(String(value ?? '—')).replace(/@/g, '@\u200b');
export const stamp = (ms, style = 'R') => `<t:${Math.floor(ms / 1000)}:${style}>`;
export const duration = seconds => {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};
export function embed(title, description, { error = false } = {}) {
  const result = new EmbedBuilder().setColor(error ? BRAND.error : BRAND.color)
    .setAuthor({ name: BRAND.name }).setTitle(title)
    .setFooter({ text: `${BRAND.name} • Community` });
  if (description) result.setDescription(description);
  return result;
}
export async function respond(i, payload, privateReply = false) {
  const body = { ...payload, allowedMentions: { parse: [], repliedUser: false } };
  if (i.deferred) return i.editReply(body);
  if (i.replied) return i.followUp({ ...body, flags: MessageFlags.Ephemeral });
  return i.reply({ ...body, ...(privateReply ? { flags: MessageFlags.Ephemeral } : {}) });
}
export const notice = (i, title, description, privateReply = false, error = false) =>
  respond(i, { embeds: [embed(title, description, { error })] }, privateReply);

// Permission denials are deliberately public and mention only the caller.
export async function denyPermission(i, requirement, detail = '') {
  const command = i.commandName ? `/${i.commandName}` : 'ten panel';
  const body = {
    content: `<@${i.user.id}>, nie masz uprawnień do użycia **${command}**.`,
    embeds: [embed('Brak uprawnień', `**Wymagany dostęp:** ${requirement}${detail ? `\n${detail}` : ''}`, { error: true })],
    allowedMentions: { parse: [], users: [i.user.id], repliedUser: false },
  };
  if (!i.deferred && !i.replied) return i.reply(body);
  if(i.deferred&&!i.replied&&i.ephemeral)await i.editReply({content:'Nie wykonano działania z powodu braku uprawnień.',embeds:[],components:[]});
  return i.followUp({...body,flags:0});
}
