export interface ContractTypeOption {
  name: string;
  hasOvertime: boolean;
}

export interface MaritalStatusOption {
  name: string;
  allowChildren: boolean;
}

export function parseContractTypes(raw: string): ContractTypeOption[] {
  if (!raw) return getDefaultContractTypes();
  try {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
      return JSON.parse(trimmed);
    }
  } catch (e) {
    console.error("Failed to parse contract types JSON:", e);
  }
  // Backwards compatibility with comma-separated list
  return raw.split(",")
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .map(t => ({ name: t, hasOvertime: true }));
}

export function parseMaritalStatuses(raw: string): MaritalStatusOption[] {
  if (!raw) return getDefaultMaritalStatuses();
  try {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
      return JSON.parse(trimmed);
    }
  } catch (e) {
    console.error("Failed to parse marital statuses JSON:", e);
  }
  return raw.split(",")
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .map(t => ({ name: t, allowChildren: true }));
}

export function getDefaultContractTypes(): ContractTypeOption[] {
  return [
    { name: "CDI", hasOvertime: true },
    { name: "CDD", hasOvertime: true },
    { name: "Intérim", hasOvertime: true },
    { name: "ANAPEC", hasOvertime: true },
    { name: "Autre", hasOvertime: false }
  ];
}

export function getDefaultMaritalStatuses(): MaritalStatusOption[] {
  return [
    { name: "Célibataire", allowChildren: true },
    { name: "Marié(e)", allowChildren: true },
    { name: "Divorcé(e)", allowChildren: true },
    { name: "Veuf(ve)", allowChildren: true }
  ];
}

export interface LeaveTypeOption {
  name: string;
  isPaid: boolean;
}

export function parseLeaveTypes(raw: string): LeaveTypeOption[] {
  if (!raw) return getDefaultLeaveTypes();
  try {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
      return JSON.parse(trimmed);
    }
  } catch (e) {
    console.error("Failed to parse leave types JSON:", e);
  }
  return raw.split(",")
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .map(t => ({ name: t, isPaid: t.toLowerCase() === "congé payé" }));
}

export function getDefaultLeaveTypes(): LeaveTypeOption[] {
  return [
    { name: "Congé Payé", isPaid: true },
    { name: "Maladie", isPaid: false },
    { name: "RTT", isPaid: true },
    { name: "Congé Sans Solde", isPaid: false },
    { name: "Récupération", isPaid: true }
  ];
}
