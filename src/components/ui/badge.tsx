import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-300",
  {
    variants: {
      variant: {
        default:
          "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
        secondary:
          "border-border bg-white/5 text-muted-foreground",
        destructive:
          "border-red-500/30 bg-red-500/10 text-red-400",
        outline:
          "border-border/50 bg-transparent text-foreground",
        success:
          "border-green-500/30 bg-green-500/10 text-green-400",
        warning:
          "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
        purple:
          "border-purple-500/30 bg-purple-500/10 text-purple-400",
        blue:
          "border-blue-500/30 bg-blue-500/10 text-blue-400",
        orange:
          "border-orange-500/30 bg-orange-500/10 text-orange-400",
        pink:
          "border-pink-500/30 bg-pink-500/10 text-pink-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
