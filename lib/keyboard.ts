/**
 * Normalizes keyboard input to a single ASCII digit '0'-'9'.
 * Handles:
 * - Standard top-row numeric keys ('0'-'9')
 * - Physical Numpad keys (e.key === '0'-'9' or e.code === 'Numpad0'-'Numpad9')
 * - Eastern Arabic numerals ('٠'-'٩')
 * - Persian numerals ('۰'-'۹')
 */
export function extractDigitKey(key: string, code?: string): string | null {
  if (/^[0-9]$/.test(key)) {
    return key;
  }

  // Eastern Arabic numerals (٠-٩) and Persian numerals (۰-۹)
  const arabicDigits: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  };

  if (arabicDigits[key]) {
    return arabicDigits[key];
  }

  // Fallback to physical key code if key was masked or transformed by OS layout
  if (code) {
    if (/^Numpad[0-9]$/.test(code)) {
      return code.slice(6);
    }
    if (/^Digit[0-9]$/.test(code)) {
      return code.slice(5);
    }
  }

  return null;
}
