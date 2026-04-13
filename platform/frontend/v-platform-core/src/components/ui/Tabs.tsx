/**
 * Tabs 컴포넌트
 *
 * 디자인 시스템 토큰 기반 탭 네비게이션
 */

import { ReactNode, createContext, useContext, useState } from "react";

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className = "",
}: TabsProps) {
  // Controlled vs Uncontrolled component 지원
  const [internalValue, setInternalValue] = useState(
    defaultValue || value || "",
  );

  // Controlled component인 경우 외부 value 사용
  const activeTab = value !== undefined ? value : internalValue;

  const setActiveTab = (newValue: string) => {
    // Uncontrolled component인 경우 내부 state 업데이트
    if (value === undefined) {
      setInternalValue(newValue);
    }
    // Controlled component인 경우 onValueChange 호출
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className = "" }: TabsListProps) {
  return (
    <div
      className={`border-b border-line overflow-x-auto scrollbar-thin ${className}`}
    >
      <nav
        className="flex space-x-4 min-w-max whitespace-nowrap"
        aria-label="Tabs"
      >
        {children}
      </nav>
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
}

export function TabsTrigger({ value, children, icon }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("TabsTrigger must be used within Tabs");
  }

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === value;

  return (
    <button
      type="button"
      onClick={() => setActiveTab(value)}
      className={`
        flex flex-shrink-0 items-center gap-2 px-4 py-2 border-b-2 text-body-base font-medium whitespace-nowrap transition-colors duration-normal
        ${
          isActive
            ? "border-brand-500 text-brand-600"
            : "border-transparent text-content-secondary hover:text-content-primary hover:border-line-heavy"
        }
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({
  value,
  children,
  className = "",
}: TabsContentProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("TabsContent must be used within Tabs");
  }

  if (context.activeTab !== value) return null;

  return <div className={`pt-section-gap ${className}`}>{children}</div>;
}
