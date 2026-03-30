import { useAppStore } from '@/stores/appStore'
import { translations } from '@/data/translations'

export function useTranslation() {
  const language = useAppStore((s) => s.language)
  return translations[language]
}
