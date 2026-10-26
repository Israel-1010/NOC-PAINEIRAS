// "01-USW-FITNESS-BOXE" -> "FITNESS-BOXE"; "08-Core Servidores" -> "Core Servidores".
export function switchShortName(name: string) {
  return name.replace(/^\d+\s*-\s*/, '').replace(/^U?SW[-\s]+/i, '').trim().slice(0, 28) || name.slice(0, 28);
}
