# Levity BookerBot Design System

This document outlines the design language and styling guidelines for Levity BookerBot. Follow these guidelines to maintain visual consistency across the application.

## Brand Identity

### Name
**Levity BookerBot** - The "Levity" portion uses standard foreground text, while "BookerBot" uses a gradient text effect.

### Logo
The logo features a lightning bolt (Zap icon) inside a rounded square with a cyan gradient background and glow effect.

## Color Palette

### Primary Colors

| Color | HSL | Hex | Usage |
|-------|-----|-----|-------|
| **Navy (Background)** | `222 47% 6%` | `#0A1628` | Main background, cards |
| **Cyan (Primary)** | `172 100% 45%` | `#00E5CC` | Primary actions, highlights, branding |
| **Purple (Accent)** | `270 60% 50%` | `#8B5CF6` | Secondary accents, gradients |

### Extended Palette

```css
/* Status Colors */
--green: #22c55e   /* Success, booked */
--yellow: #eab308 /* Warning, in_conversation */
--orange: #f97316 /* Alert, unresponsive */
--red: #ef4444    /* Destructive, opted_out */
--blue: #3b82f6   /* Info, contacted */
--pink: #ec4899   /* Special, handed_off */
```

### Backgrounds

| Element | Color | CSS |
|---------|-------|-----|
| **Page background** | Navy with gradient overlays | See `body` in globals.css |
| **Card background** | `hsl(222, 47%, 8%)` | `bg-card` |
| **Popover** | `hsl(222, 47%, 10%)` | `bg-popover` |
| **Input** | `hsl(222, 47%, 12%)` | `bg-input` |

## Typography

### Font
System font stack (default Tailwind)

### Hierarchy
- **Page Title**: `text-2xl` or `text-3xl`, `font-bold`, `text-foreground`
- **Section Title**: `text-lg` or `text-xl`, `font-semibold`, `text-foreground`
- **Card Title**: `text-sm`, `font-medium`, `text-muted-foreground`
- **Body**: `text-sm`, `text-foreground`
- **Muted**: `text-sm`, `text-muted-foreground`

## Component Styling

### Cards

Cards use a neumorphic style with subtle gradients:

```tsx
<Card className="group hover:scale-[1.02] hover:shadow-glow-sm">
  {/* Card content */}
</Card>
```

**CSS Classes:**
- `card-neu` - Neumorphic card with shadows
- `hover-lift` - Lift effect on hover
- `glass` - Glassmorphism effect

### Buttons

**Variants:**
- `default` - Cyan gradient with glow, dark text
- `outline` - Transparent with cyan border, cyan text
- `ghost` - Transparent, subtle hover
- `destructive` - Red gradient for dangerous actions
- `glow` - Animated pulsing glow effect

**Usage:**
```tsx
<Button>Primary Action</Button>
<Button variant="outline">Secondary Action</Button>
<Button variant="ghost" size="icon"><Icon /></Button>
```

### Tables

Tables use the dark theme with subtle borders and cyan hover effects:

```tsx
<div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
  <Table>
    {/* Table content */}
  </Table>
</div>
```

**Row hover:** `hover:bg-cyan-500/5`

### Badges

Multiple color variants for different statuses:

```tsx
<Badge variant="default">Default (Cyan)</Badge>
<Badge variant="success">Success (Green)</Badge>
<Badge variant="warning">Warning (Yellow)</Badge>
<Badge variant="destructive">Destructive (Red)</Badge>
<Badge variant="purple">Purple</Badge>
<Badge variant="blue">Blue</Badge>
<Badge variant="orange">Orange</Badge>
```

### Inputs

Inputs have a glow effect on focus:

```tsx
<Input placeholder="Enter value..." />
```

**Focus state:** Cyan ring with glow shadow

### Dialogs

Dialogs use the card background with subtle border and shadow:

```tsx
<Dialog>
  <DialogContent>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### Dropdown Menus

Items highlight with cyan on hover:

```tsx
<DropdownMenu>
  <DropdownMenuContent>
    <DropdownMenuItem>Action</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Effects & Animations

### Glow Effects

```css
/* Utility classes */
.glow-cyan { box-shadow: 0 0 20px rgba(0, 229, 204, 0.4); }
.glow-cyan-lg { box-shadow: 0 0 40px rgba(0, 229, 204, 0.5); }
.shadow-glow-sm { box-shadow: 0 0 10px rgba(0, 229, 204, 0.3); }
.shadow-glow { box-shadow: 0 0 20px rgba(0, 229, 204, 0.4); }
.shadow-glow-lg { box-shadow: 0 0 40px rgba(0, 229, 204, 0.5); }
```

### Animations

```css
/* Pulsing glow */
.animate-glow-pulse { animation: glow-pulse 2s ease-in-out infinite; }

/* Shimmer effect */
.shimmer { animation: shimmer 2s infinite; }

/* Float effect */
.animate-float { animation: float 3s ease-in-out infinite; }
```

### Hover Effects

```css
/* Lift on hover */
.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

/* Scale on hover */
.group:hover { scale: 1.02; }
```

### Gradient Text

```tsx
<span className="gradient-text">Gradient Text</span>
```

Creates a cyan gradient from light to bright.

## Spacing & Layout

### Standard Padding
- **Page content**: `p-8`
- **Cards**: Internal padding via CardContent component
- **Section spacing**: `space-y-8` or `gap-6`

### Border Radius
- **Large (cards, dialogs)**: `rounded-2xl` (16px)
- **Medium (buttons, inputs)**: `rounded-xl` (12px)
- **Small (badges, menu items)**: `rounded-lg` (8px)

## Best Practices

### Do's
- Use `text-foreground` for primary text
- Use `text-muted-foreground` for secondary/helper text
- Use `bg-card` for card backgrounds
- Use `border-border` or `border-border/50` for borders
- Add hover effects to interactive elements
- Use cyan for primary actions and highlights
- Use subtle glow effects on hover states

### Don'ts
- Avoid using hardcoded white (`#fff`) or light grays
- Don't use `bg-white` - use `bg-card` or `bg-background`
- Avoid `text-gray-*` - use themed text colors
- Don't skip hover/focus states on interactive elements
- Avoid excessive animations that distract from content

## File Reference

### Core Style Files
- `/src/app/globals.css` - Global styles, custom classes, animations
- `/tailwind.config.ts` - Theme configuration, colors, shadows

### Component Files
- `/src/components/ui/` - All UI components with consistent styling
- `/src/components/sidebar.tsx` - Navigation with branding

## Status Color Mapping

For contact/workflow statuses, use these badge variants:

| Status | Badge Variant | Color |
|--------|---------------|-------|
| pending | `secondary` | Gray |
| contacted | `blue` | Blue |
| in_conversation | `warning` | Yellow |
| qualified | `purple` | Purple |
| booked | `success` | Green |
| opted_out | `destructive` | Red |
| unresponsive | `orange` | Orange |
| handed_off | `pink` | Pink |
