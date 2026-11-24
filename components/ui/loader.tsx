import { cn } from "@/lib/utils"

interface LoaderProps {
    text?: string
    className?: string
}

export const Loader = ({ text, className }: LoaderProps) => {
    return (
        <div className={cn("flex flex-col items-center justify-center", className)}>
            <div className="w-8 h-8 border-4 border-[#EFF5FF] border-t-[#3478F6] rounded-full animate-spin"></div>
        </div>
    )
} 