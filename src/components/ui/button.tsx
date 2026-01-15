import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-cyan-500 to-cyan-400 text-navy-900 font-semibold shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 active:translate-y-0",
        destructive:
          "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50",
        outline:
          "border border-cyan-500/50 bg-transparent text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500 hover:shadow-glow-sm",
        secondary:
          "bg-white/5 text-foreground border border-border hover:bg-white/10 hover:border-border/80",
        ghost:
          "text-muted-foreground hover:text-foreground hover:bg-white/5",
        link:
          "text-cyan-400 underline-offset-4 hover:underline hover:text-cyan-300",
        glow:
          "bg-gradient-to-r from-cyan-500 to-cyan-400 text-navy-900 font-semibold shadow-glow-lg hover:shadow-glow-xl hover:-translate-y-1 active:translate-y-0 animate-glow-pulse",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
