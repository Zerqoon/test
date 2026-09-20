import { config } from './config.js';

export function staffTier(i) {
  const roles = i.member?.roles?.cache;
  if (i.user.id === i.guild.ownerId || roles?.has(config.roles.chief)) return 3;
  if (roles?.has(config.roles.moderator)) return 2;
  if (roles?.has(config.roles.helper)) return 1;
  return 0;
}
export const tierName = tier => ['Użytkownik', 'Helper (Strażnik)', 'Moderator (Namiestnik)', 'Szef'][tier];
export function actorCanTarget(i, target) {
  if (!target || target.id === i.guild.ownerId || target.id === i.user.id || target.user.bot) return false;
  if (i.user.id !== i.guild.ownerId && i.member.roles.highest.comparePositionTo(target.roles.highest) <= 0) return false;
  return true;
}
export function canModerate(i, target) {
  if(!actorCanTarget(i,target))return false;
  return Boolean(i.guild.members.me && i.guild.members.me.roles.highest.comparePositionTo(target.roles.highest) > 0);
}
