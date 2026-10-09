/**
 * Short names for zones whose English ICU name is only an offset ("GMT+1"), so a time always reads
 * "3:00 PM WAT", never "3:00 PM West Africa Standard Time" and never "3:00 PM GMT+1" (owner
 * 2026-10-09: three-letter zones). Zones ICU already abbreviates in English (EDT, PST, GMT, UTC,
 * NST, AKDT, HST) keep ICU's answer and are not listed.
 *
 * [standard, daylight]: the daylight name is used only when the zone is on summer time at that
 * instant. ⚠ calendar-client's ZonedTime (emails, PHP) carries the SAME table; change both.
 */
export const ZONE_ABBREVIATIONS: Record<string, [string, string?]> = {
  // Africa
  'Africa/Lagos': ['WAT'], 'Africa/Kinshasa': ['WAT'], 'Africa/Douala': ['WAT'], 'Africa/Luanda': ['WAT'],
  'Africa/Porto-Novo': ['WAT'], 'Africa/Niamey': ['WAT'], 'Africa/Ndjamena': ['WAT'], 'Africa/Libreville': ['WAT'],
  'Africa/Nairobi': ['EAT'], 'Africa/Addis_Ababa': ['EAT'], 'Africa/Kampala': ['EAT'], 'Africa/Dar_es_Salaam': ['EAT'],
  'Africa/Mogadishu': ['EAT'], 'Africa/Asmara': ['EAT'], 'Africa/Djibouti': ['EAT'],
  'Africa/Harare': ['CAT'], 'Africa/Lusaka': ['CAT'], 'Africa/Maputo': ['CAT'], 'Africa/Kigali': ['CAT'],
  'Africa/Blantyre': ['CAT'], 'Africa/Gaborone': ['CAT'], 'Africa/Lubumbashi': ['CAT'], 'Africa/Khartoum': ['CAT'],
  'Africa/Johannesburg': ['SAST'], 'Africa/Maseru': ['SAST'], 'Africa/Mbabane': ['SAST'],
  'Africa/Cairo': ['EET', 'EEST'], 'Africa/Tripoli': ['EET'], 'Africa/Casablanca': ['WET', 'WEST'], 'Africa/Algiers': ['CET'],
  'Africa/Tunis': ['CET'],
  // Asia
  'Asia/Kolkata': ['IST'], 'Asia/Calcutta': ['IST'], 'Asia/Karachi': ['PKT'], 'Asia/Dhaka': ['BST'], 'Asia/Kathmandu': ['NPT'],
  'Asia/Colombo': ['IST'], 'Asia/Manila': ['PHT'], 'Asia/Shanghai': ['CST'], 'Asia/Hong_Kong': ['HKT'], 'Asia/Taipei': ['CST'],
  'Asia/Singapore': ['SGT'], 'Asia/Kuala_Lumpur': ['MYT'], 'Asia/Jakarta': ['WIB'], 'Asia/Bangkok': ['ICT'],
  'Asia/Ho_Chi_Minh': ['ICT'], 'Asia/Saigon': ['ICT'], 'Asia/Tokyo': ['JST'], 'Asia/Seoul': ['KST'], 'Asia/Dubai': ['GST'],
  'Asia/Muscat': ['GST'], 'Asia/Riyadh': ['AST'], 'Asia/Qatar': ['AST'], 'Asia/Kuwait': ['AST'], 'Asia/Bahrain': ['AST'],
  'Asia/Baghdad': ['AST'], 'Asia/Tehran': ['IRST'], 'Asia/Kabul': ['AFT'], 'Asia/Tashkent': ['UZT'], 'Asia/Almaty': ['ALMT'],
  'Asia/Jerusalem': ['IST', 'IDT'], 'Asia/Beirut': ['EET', 'EEST'], 'Asia/Amman': ['AST'], 'Asia/Damascus': ['AST'],
  'Asia/Yerevan': ['AMT'], 'Asia/Tbilisi': ['GET'], 'Asia/Baku': ['AZT'], 'Asia/Yangon': ['MMT'],
  // Europe
  'Europe/London': ['GMT', 'BST'], 'Europe/Dublin': ['GMT', 'IST'], 'Europe/Lisbon': ['WET', 'WEST'],
  'Europe/Paris': ['CET', 'CEST'], 'Europe/Berlin': ['CET', 'CEST'], 'Europe/Madrid': ['CET', 'CEST'], 'Europe/Rome': ['CET', 'CEST'],
  'Europe/Amsterdam': ['CET', 'CEST'], 'Europe/Brussels': ['CET', 'CEST'], 'Europe/Vienna': ['CET', 'CEST'],
  'Europe/Zurich': ['CET', 'CEST'], 'Europe/Stockholm': ['CET', 'CEST'], 'Europe/Oslo': ['CET', 'CEST'],
  'Europe/Copenhagen': ['CET', 'CEST'], 'Europe/Warsaw': ['CET', 'CEST'], 'Europe/Prague': ['CET', 'CEST'],
  'Europe/Budapest': ['CET', 'CEST'], 'Europe/Belgrade': ['CET', 'CEST'], 'Europe/Athens': ['EET', 'EEST'],
  'Europe/Bucharest': ['EET', 'EEST'], 'Europe/Helsinki': ['EET', 'EEST'], 'Europe/Kiev': ['EET', 'EEST'],
  'Europe/Kyiv': ['EET', 'EEST'], 'Europe/Sofia': ['EET', 'EEST'], 'Europe/Istanbul': ['TRT'], 'Europe/Moscow': ['MSK'],
  // Americas
  'America/Sao_Paulo': ['BRT'], 'America/Bogota': ['COT'], 'America/Lima': ['PET'], 'America/Caracas': ['VET'],
  'America/Argentina/Buenos_Aires': ['ART'], 'America/Buenos_Aires': ['ART'], 'America/Santiago': ['CLT', 'CLST'],
  'America/La_Paz': ['BOT'], 'America/Guayaquil': ['ECT'], 'America/Montevideo': ['UYT'], 'America/Asuncion': ['PYT', 'PYST'],
  // Oceania
  'Australia/Sydney': ['AEST', 'AEDT'], 'Australia/Melbourne': ['AEST', 'AEDT'], 'Australia/Hobart': ['AEST', 'AEDT'],
  'Australia/Brisbane': ['AEST'], 'Australia/Adelaide': ['ACST', 'ACDT'], 'Australia/Darwin': ['ACST'], 'Australia/Perth': ['AWST'],
  'Pacific/Auckland': ['NZST', 'NZDT'], 'Pacific/Fiji': ['FJT'], 'Pacific/Kiritimati': ['LINT'],
};
