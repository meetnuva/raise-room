export interface ScheduledEvent {
  id: string;
  minute: number;
  label: string;
  instruction: string;
}

export interface ManagerProfile {
  name: string;
  budgetDefensiveness: string;
  evidenceDemand: string;
  patience: string;
  directness: string;
  warmth: string;
  authority: string;
  hiddenStance: string;
}

export interface Scenario {
  company: string;
  role: string;
  tenureMonths: number;
  compensation: {
    currentMonthlySalary: number;
    requestedMonthlySalary: number;
    minimumMonthlySalary: number;
  };
  achievements: string;
  reason: string;
  manager: ManagerProfile;
  events: ScheduledEvent[];
}

export const defaultScenario: Scenario = {
  company: "nuva",
  role: "產品營運專員",
  tenureMonths: 18,
  compensation: {
    currentMonthlySalary: 0,
    requestedMonthlySalary: 0,
    minimumMonthlySalary: 0,
  },
  achievements: "整理跨部門流程並提升交付穩定度",
  reason: "希望依據近期責任與成果討論薪資調整",
  manager: {
    name: "王主管",
    budgetDefensiveness: "高",
    evidenceDemand: "高",
    patience: "中",
    directness: "高",
    warmth: "中",
    authority: "高",
    hiddenStance: "先觀察對方能否以具體成果說明請求",
  },
  events: [
    {
      id: "opening-question",
      minute: 1,
      label: "要求先說明成果",
      instruction: "請對方先以具體成果說明這次請求",
    },
    {
      id: "budget-freeze",
      minute: 3,
      label: "預算暫緩",
      instruction: "告知目前預算防守較嚴格",
    },
    {
      id: "priority-shift",
      minute: 5,
      label: "優先事項改變",
      instruction: "提出團隊優先事項可能調整",
    },
    {
      id: "peer-comparison",
      minute: 7,
      label: "職級對照",
      instruction: "詢問與同職級貢獻的對照依據",
    },
    {
      id: "next-step",
      minute: 9,
      label: "確認下一步",
      instruction: "要求提出可追蹤的後續安排",
    },
  ],
};

export function eventsDueAt(
  scenario: Scenario,
  elapsedSeconds: number,
): ScheduledEvent[] {
  return scenario.events.filter(
    (event) => event.minute * 60 === elapsedSeconds,
  );
}

export function buildManagerBrief(scenario: Scenario): string {
  return [
    `主管姓名：${scenario.manager.name}`,
    `預算防守：${scenario.manager.budgetDefensiveness}`,
    `證據要求：${scenario.manager.evidenceDemand}`,
  ].join("\n");
}
