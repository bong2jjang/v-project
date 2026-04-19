/**
 * DataTableCard — data_table ui tool 의 component 렌더러.
 * 플랫폼 Table 컴포넌트를 사용해 columns/rows 를 렌더한다.
 */

import { Card, CardBody } from "@v-platform/core/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v-platform/core/components/ui/Table";

export interface DataTableColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
}

export interface DataTableCardProps {
  title?: string | null;
  columns: DataTableColumn[];
  rows: Record<string, unknown>[];
}

function formatCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const ALIGN_CLASS: Record<NonNullable<DataTableColumn["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function DataTableCard({ title, columns, rows }: DataTableCardProps) {
  return (
    <Card>
      <CardBody className="py-3">
        {title && (
          <div className="mb-2 text-body-sm font-medium text-content-primary">
            {title}
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={ALIGN_CLASS[c.align ?? "left"]}
                >
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx}>
                {columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={ALIGN_CLASS[c.align ?? "left"]}
                  >
                    {formatCell(row[c.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}
