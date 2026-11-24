import React from 'react'
import DashboardSidebar from './Components/DashboardSidebar'
import { normalizePresentationGenerationMode } from '@/utils/presentationGenerationMode'

const layout = ({ children }: { children: React.ReactNode }) => {
    const presentationGenerationMode = normalizePresentationGenerationMode(
        process.env.PRESENTATION_GENERATION_MODE,
    )

    return (
        <div className='flex flex-col md:flex-row pr-0 md:pr-4 bg-white dark:bg-[#121216] min-h-screen'>
            <DashboardSidebar
                showTemplates={presentationGenerationMode !== "smart"}
            />
            <div className='w-full min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0'>

                {children}
            </div>
        </div>
    )
}

export default layout
