export const COUNTRY_CODES = [
  { code: "55", label: "Brasil (+55)" },
  { code: "1", label: "EUA e Canadá (+1)" },
  { code: "54", label: "Argentina (+54)" },
  { code: "56", label: "Chile (+56)" },
  { code: "57", label: "Colômbia (+57)" },
  { code: "52", label: "México (+52)" },
  { code: "351", label: "Portugal (+351)" },
  { code: "34", label: "Espanha (+34)" },
  { code: "44", label: "Reino Unido (+44)" },
  { code: "33", label: "França (+33)" },
  { code: "49", label: "Alemanha (+49)" },
  { code: "39", label: "Itália (+39)" },
  { code: "81", label: "Japão (+81)" },
  { code: "86", label: "China (+86)" },
];

export const digitsOnly = (value = "") => String(value).replace(/\D/g, "");

export function splitPhone(value) {
  const phone = digitsOnly(value);
  const country = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length).find((item) => phone.startsWith(item.code));
  return country ? { countryCode: country.code, number: phone.slice(country.code.length) } : { countryCode: "55", number: phone };
}

export function formatPhoneNumber(value, countryCode) {
  const number = digitsOnly(value);
  if (!number) return "";
  if (countryCode === "55") {
    if (number.length <= 2) return number;
    const area = number.slice(0, 2);
    const local = number.slice(2, 11);
    if (local.length <= 4) return `(${area}) ${local}`;
    if (local.length <= 8) return `(${area}) ${local.slice(0, -4)}-${local.slice(-4)}`;
    return `(${area}) ${local.slice(0, 5)}-${local.slice(5)}`;
  }
  if (countryCode === "1") {
    if (number.length <= 3) return number;
    if (number.length <= 6) return `(${number.slice(0, 3)}) ${number.slice(3)}`;
    return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6, 10)}`;
  }
  return number.slice(0, 15).replace(/(\d{3})(?=\d)/g, "$1 ");
}

export function completePhone(countryCode, number) {
  const local = digitsOnly(number);
  return local ? `${digitsOnly(countryCode)}${local}` : "";
}
