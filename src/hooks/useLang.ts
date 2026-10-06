import { useTheme } from '@/design';
import type { Lang } from '@/i18n/languages';

export function useLang(): Lang {
  return useTheme().lang;
}
