"use client"

import * as React from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitive.Provider

const ToastViewport = React.forwardRef(function ToastViewport(
  { className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>,
  ref: React.ForwardedRef<React.ElementRef<typeof ToastPrimitive.Viewport>>
) {
  return (
    <ToastPrimitive.Viewport
      ref={ref}
      className={cn(
        "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
        className
      )}
      {...props}
    />
  )
})
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

const Toast = React.forwardRef(function Toast(
  { className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>,
  ref: React.ForwardedRef<React.ElementRef<typeof ToastPrimitive.Root>>
) {
  return (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(
        "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all",
        className
      )}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitive.Root.displayName

const ToastClose = React.forwardRef(function ToastClose(
  { className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>,
  ref: React.ForwardedRef<React.ElementRef<typeof ToastPrimitive.Close>>
) {
  return (
    <ToastPrimitive.Close
      ref={ref}
      className={cn(
        "absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity hover:opacity-100",
        className
      )}
      toast-close=""
      {...props}
    >
      <X className="h-4 w-4" />
    </ToastPrimitive.Close>
  )
})
ToastClose.displayName = ToastPrimitive.Close.displayName

const ToastTitle = React.forwardRef(function ToastTitle(
  { className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>,
  ref: React.ForwardedRef<React.ElementRef<typeof ToastPrimitive.Title>>
) {
  return (
    <ToastPrimitive.Title
      ref={ref}
      className={cn("text-sm font-semibold", className)}
      {...props}
    />
  )
})
ToastTitle.displayName = ToastPrimitive.Title.displayName

const ToastDescription = React.forwardRef(function ToastDescription(
  { className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>,
  ref: React.ForwardedRef<React.ElementRef<typeof ToastPrimitive.Description>>
) {
  return (
    <ToastPrimitive.Description
      ref={ref}
      className={cn("text-sm opacity-90", className)}
      {...props}
    />
  )
})
ToastDescription.displayName = ToastPrimitive.Description.displayName

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
}