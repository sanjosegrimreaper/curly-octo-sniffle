import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import QRCode from 'qrcode';

/** QR code as an inline SVG string (for the printable summary). */
export async function qrSvg(text: string): Promise<string> {
  try {
    return await QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, width: 120 });
  } catch {
    return '';
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/**
 * Turns HTML into a PDF and opens the share sheet (or the browser print dialog on web).
 * The file lives in the app's cache only; nothing is uploaded.
 */
export async function shareHtmlAsPdf(html: string, dialogTitle: string): Promise<'shared' | 'printed' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return 'printed';
    }
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle, UTI: 'com.adobe.pdf' });
      return 'shared';
    }
    await Print.printAsync({ uri });
    return 'printed';
  } catch {
    return 'failed';
  }
}
