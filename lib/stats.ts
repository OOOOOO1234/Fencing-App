export const ACTIONS = [
  "simple attack",
  "attack on the preparation",
  "compound attack",
  "beat attack",
  "counterattack",
  "parry-riposte",
  "remise",
  "point in line",
  "preparation only",
] as const;

export type BoutResult = "success" | "failed" | "neither";

export type ExchangeLike = {
  action: string;
  result: string;
};

export type ActionStat = {
  action: string;
  attempts: number;
  successful: number;
  failed: number;
  neither: number;
  successRate: number;
};

export function summarize(exchanges: ExchangeLike[]): ActionStat[] {
  const names = [...ACTIONS] as string[];
  for (const exchange of exchanges) {
    if (!names.includes(exchange.action)) names.push(exchange.action);
  }
  return names.map((action) => {
    const rows = exchanges.filter((exchange) => exchange.action === action);
    const attempts = rows.length;
    const successful = rows.filter((exchange) => exchange.result === "success").length;
    const failed = rows.filter((exchange) => exchange.result === "failed").length;
    const neither = rows.filter((exchange) => exchange.result === "neither").length;
    return {
      action,
      attempts,
      successful,
      failed,
      neither,
      successRate: attempts === 0 ? 0 : successful / attempts,
    };
  });
}

export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
