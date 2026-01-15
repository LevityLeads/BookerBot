import * as React from "react"

import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-border/50 bg-white/5 px-4 py-2 text-sm text-foreground transition-all duration-300 placeholder:text-muted-foreground/60 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] focus:shadow-[0_0_20px_rgba(0,229,204,0.1)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
