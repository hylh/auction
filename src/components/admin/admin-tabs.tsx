import type { ReactNode } from "react";

export type AdminTabId = "live" | "sales" | "inventory-history" | "actions";

export type AdminTab = {
  id: AdminTabId;
  label: string;
  count: number;
};

type AdminTabsProps = {
  tabs: Array<AdminTab>;
  activeTab: AdminTabId;
  onChange: (tab: AdminTabId) => void;
};

export function AdminTabs({ tabs, activeTab, onChange }: AdminTabsProps): ReactNode {
  return (
    <div className="tabs" role="tablist" aria-label="Admin sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`admin-tab-${tab.id}`}
          aria-selected={tab.id === activeTab}
          aria-controls={`admin-panel-${tab.id}`}
          className={`tab${tab.id === activeTab ? " active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          <span className="tab-count">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}
