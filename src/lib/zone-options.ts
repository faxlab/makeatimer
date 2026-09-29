const aliases: [string, string][] = [
  ['UTC', 'UTC · Coordinated Universal Time'],
  ['-08:00', 'PST · fixed UTC−08:00'],
  ['-05:00', 'EST · fixed UTC−05:00'],
  ['America/Los_Angeles', 'Los Angeles · Pacific Time (DST)'],
  ['America/New_York', 'New York · Eastern Time (DST)'],
  ['Europe/London', 'London · UK time (DST)'],
  ['Europe/Vilnius', 'Vilnius · Lithuania (DST)'],
  ['Asia/Kolkata', 'India · Kolkata · UTC+05:30'],
  ['Asia/Kathmandu', 'Kathmandu · Nepal · UTC+05:45'],
  ['Asia/Tokyo', 'Tokyo · Japan'],
  ['Australia/Sydney', 'Sydney · Australia (DST)'],
  ['Pacific/Auckland', 'Auckland · New Zealand (DST)'],
];
export function zoneOptions(): [string, string][] {
  const supported =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : [];
  return [
    ...aliases,
    ...supported
      .filter((z) => !aliases.some(([v]) => v === z))
      .map(
        (z) =>
          [z, z.replaceAll('_', ' ').replaceAll('/', ' · ')] as [
            string,
            string,
          ],
      ),
  ];
}
