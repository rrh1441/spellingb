import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef(function Card(
  { className, ...props }: React.HTMLAttributes<HTMLDivElement>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <div
      ref={ref}
      className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}
      {...props}
    />
  )
})
Card.displayName = "Card"

const CardHeader = React.forwardRef(function CardHeader(
  { className, ...props }: React.HTMLAttributes<HTMLDivElement>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
})
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(function CardTitle(
  { className, ...props }: React.HTMLAttributes<HTMLHeadingElement>,
  ref: React.ForwardedRef<HTMLParagraphElement>
) {
  return (
    <h3
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
})
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(function CardDescription(
  { className, ...props }: React.HTMLAttributes<HTMLParagraphElement>,
  ref: React.ForwardedRef<HTMLParagraphElement>
) {
  return (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef(function CardContent(
  { className, ...props }: React.HTMLAttributes<HTMLDivElement>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
})
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(function CardFooter(
  { className, ...props }: React.HTMLAttributes<HTMLDivElement>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
})
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }