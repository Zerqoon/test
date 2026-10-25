export function slugify(value) {
  return String(value ?? '')
    .replace(/[łŁ]/g, 'l')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'dusza';
}

export function canOpenAnotherTicket(openCount, maxOpen = 1) {
  return Number.isInteger(openCount) && openCount >= 0
    && Number.isInteger(maxOpen) && maxOpen >= 1 && openCount < maxOpen;
}

export function suggestionVoteValue(direction) {
  if (direction === 'up') return 1;
  if (direction === 'down') return -1;
  return null;
}
