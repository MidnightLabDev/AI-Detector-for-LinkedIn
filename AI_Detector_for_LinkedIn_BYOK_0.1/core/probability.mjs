export function probability(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid probability');
  return value;
}

export function percentages(ai) {
  const rounded = Math.round(probability(ai) * 100);
  return {ai: rounded, human: 100 - rounded};
}

export function distributionPercentages(ai, suspected, human) {
  const values = [probability(ai), probability(suspected), probability(human)];
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error('Invalid probability distribution');

  const normalized = values.map(value => value / total * 100);
  const rounded = normalized.map(value => Math.floor(value));
  let remaining = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const order = normalized
    .map((value, index) => ({index, fraction: value - Math.floor(value)}))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; i < remaining; i++) rounded[order[i % order.length].index]++;
  return {ai: rounded[0], suspected_ai: rounded[1], human: rounded[2]};
}
