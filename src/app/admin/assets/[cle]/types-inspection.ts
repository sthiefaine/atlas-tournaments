import type { AssetSpec } from '@/assets/spec';
export interface PropsInspection {
  spec: AssetSpec; fichiers: string[]; revision: string | null; precedente: string | null;
  reference: { id: string; revision: string; approuvee: boolean } | null;
}
