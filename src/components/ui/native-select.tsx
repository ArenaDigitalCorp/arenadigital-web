import type { ComponentProps } from "react"

/** Keeps native forms and keyboard behavior while sharing the web arrow inset. */
function NativeSelect(props: ComponentProps<"select">) {
  return <select {...props} data-slot="native-select" />
}

export { NativeSelect }
