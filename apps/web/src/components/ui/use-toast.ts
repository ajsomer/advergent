// Simplified version of shadcn/ui use-toast
import { useState, useEffect } from "react"

type ToastProps = {
    title?: string
    description?: string
    variant?: "default" | "destructive"
}

function toast(props: ToastProps) {
    console.log("Global Toast:", props)
}

function useToast() {
    const [_, _setConfig] = useState({})

    useEffect(() => {
        // Placeholder for listener logic
        return () => {
            // cleanup
        }
    }, [])

    return {
        toast: (props: ToastProps) => {
            console.log("Toast:", props)
            if (props.variant === 'destructive') {
                console.error(props.title, props.description)
            } else {
                console.log(props.title, props.description)
            }
        },
        dismiss: (_toastId?: string) => {
            // Placeholder for dismiss logic
        }
    }
}

export { useToast, toast }
