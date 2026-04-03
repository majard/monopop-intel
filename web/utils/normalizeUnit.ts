export function normalizeUnit(
  size: number,
  unit: string
): { size: number; unit: string; display: string } {
  if (unit === 'g' && size >= 1000) {
    const kg = size / 1000;
    const isClean = Number.isInteger(kg) || Number.isInteger(kg * 10);
    if (isClean) return { size: kg, unit: 'kg', display: `${kg} kg` };
  }
  if (unit === 'ml' && size >= 1000) {
    const liters = size / 1000;
    const isClean = Number.isInteger(liters) || Number.isInteger(liters * 10);
    if (isClean) return { size: liters, unit: 'l', display: `${liters} L` };
  }
  return { size, unit, display: `${size} ${unit}` };
}

export function denormalizeUnit(
  size: number,
  unit: string
): { size: number; unit: string; display: string } {
  if (unit === 'kg' && size >= 1) {
    const g = size * 1000;
    const isClean = Number.isInteger(g) || Number.isInteger(g / 10);
    if (isClean) return { size: g, unit: 'g', display: `${g} g` };
  }
  if (unit === 'l' && size >= 1) {
    const ml = size * 1000;
    const isClean = Number.isInteger(ml) || Number.isInteger(ml / 10);
    if (isClean) return { size: ml, unit: 'ml', display: `${ml} ml` };
  }
  return { size, unit, display: `${size} ${unit}` };
}