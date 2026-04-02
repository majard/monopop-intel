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