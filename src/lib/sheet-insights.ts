export type TriggerStat = {
  name: string;
  count: number;
  correlation: number; // percentage
};

export async function fetchTopTriggers(phone: string): Promise<TriggerStat[]> {
  try {
    const res  = await fetch(`/api/triggers?phone=${encodeURIComponent(phone)}`);
    const data = await res.json() as { triggers?: TriggerStat[]; error?: string };
    return data.triggers ?? [];
  } catch {
    return [];
  }
}
