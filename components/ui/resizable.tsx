"use client"

import * as React from "react"
import { PanelGroup as PanelGroupPrimitive, Panel as ResizablePanelPrimitive, PanelResizeHandle as ResizablePanelHandlePrimitive } from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = React.forwardRef<
  React.ElementRef<typeof PanelGroupPrimitive>,
  React.ComponentProps<typeof PanelGroupPrimitive>
>(({ className, ...props }, ref) => (
  <PanelGroupPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
))
ResizablePanelGroup.displayName = "ResizablePanelGroup"

const ResizablePanel = ResizablePanelPrimitive

const ResizableHandle = ({
  className,
  withHandle,
  ...props
}: React.ComponentProps<typeof ResizablePanelHandlePrimitive> & { withHandle?: boolean }) => (
  <ResizablePanelHandlePrimitive
    className={cn(
      "relative flex w-px items-center justify-center bg-gray-200 after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 focus-visible:ring-offset-1 dark:bg-gray-800 dark:focus-visible:ring-gray-300",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-2.5 w-2.5"
        >
          <path d="M9 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
          <path d="M9 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
          <path d="M9 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
          <path d="M15 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
          <path d="M15 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
          <path d="M15 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
        </svg>
      </div>
    )}
  </ResizablePanelHandlePrimitive>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
