export interface Destination {
  destination: string;
  name: string;
  targetConcept: string;
  targetView: string;
  href: string;
  icon: string;
  group: string;
}

export function destinationByHref(
  destinations: Destination[],
  href: string,
): Destination | undefined {
  return destinations.find((destination) => (
    destination.href === href || href.startsWith(`${destination.href}/`)
  ));
}

export function destinationByName(
  destinations: Destination[],
  name: string,
): Destination | undefined {
  return destinations.find((destination) => destination.name === name);
}

export function groupDestinations(
  destinations: Destination[],
): Array<{ label: string; items: Destination[] }> {
  const groups = new Map<string, Destination[]>();
  for (const destination of destinations) {
    const existing = groups.get(destination.group) ?? [];
    existing.push(destination);
    groups.set(destination.group, existing);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}
