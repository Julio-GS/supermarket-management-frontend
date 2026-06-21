import type { LucideIcon } from "lucide-react"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string
  change?: string
  trend?: "up" | "down"
  icon: LucideIcon
  hint?: string
}

export function StatCard({
  title,
  value,
  change,
  trend = "up",
  icon: Icon,
  hint,
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        <div className="flex items-center gap-1 text-xs">
          {change ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                trend === "up" ? "text-primary" : "text-destructive",
              )}
            >
              {trend === "up" ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <ArrowDownRight className="size-3.5" />
              )}
              {change}
            </span>
          ) : null}
          {hint ? <span className="text-muted-foreground">{hint}</span> : null}
        </div>
      </CardContent>
    </Card>
  )
}
