/**
 * WeatherCard — weather ui tool 의 component 렌더러.
 * 호스트 앱에서 직접 렌더되므로 `@v-platform/core` Card 와 lucide 아이콘을 사용한다.
 */

import { Cloud, CloudFog, CloudRain, Droplets, Sun, Wind } from "lucide-react";

import { Card, CardBody } from "@v-platform/core/components/ui/Card";

export interface WeatherCardProps {
  location: string;
  temperature: number;
  unit: "celsius" | "fahrenheit";
  condition: string;
  humidity: number;
  wind_kph: number;
}

const CONDITION_ICON: Record<string, typeof Sun> = {
  clear: Sun,
  clouds: Cloud,
  rain: CloudRain,
  fog: CloudFog,
};

export function WeatherCard({
  location,
  temperature,
  unit,
  condition,
  humidity,
  wind_kph,
}: WeatherCardProps) {
  const Icon = CONDITION_ICON[condition] ?? Cloud;
  const unitLabel = unit === "celsius" ? "°C" : "°F";

  return (
    <Card>
      <CardBody className="flex items-center justify-between gap-4 py-3">
        <div className="flex flex-col">
          <span className="text-caption text-content-tertiary">{location}</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-content-primary">
              {temperature}
            </span>
            <span className="text-body-sm text-content-secondary">
              {unitLabel}
            </span>
          </div>
          <span className="text-caption text-content-secondary capitalize">
            {condition}
          </span>
          <div className="mt-2 flex gap-3 text-[11px] text-content-tertiary">
            <span className="inline-flex items-center gap-1">
              <Droplets className="h-3 w-3" /> {humidity}%
            </span>
            <span className="inline-flex items-center gap-1">
              <Wind className="h-3 w-3" /> {wind_kph} kph
            </span>
          </div>
        </div>
        <Icon className="h-10 w-10 text-brand-500 shrink-0" />
      </CardBody>
    </Card>
  );
}
