/**
 * Divider — divider ui tool 의 component 렌더러.
 * style/thickness/spacing 에 따른 수평선.
 */

export interface DividerProps {
  style: "solid" | "dashed" | "dotted";
  thickness: number;
  spacing: number;
}

export function Divider({ style, thickness, spacing }: DividerProps) {
  return (
    <hr
      className="w-full border-line"
      style={{
        borderTopStyle: style,
        borderTopWidth: thickness,
        borderBottom: 0,
        borderLeft: 0,
        borderRight: 0,
        marginTop: spacing,
        marginBottom: spacing,
      }}
    />
  );
}
