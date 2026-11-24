import React from 'react'
import { KeyRound, LogOut, Search, Shield, ShieldCheck } from 'lucide-react'
import { IMAGE_PROVIDERS, LLM_PROVIDERS } from '@/utils/providerConstants'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'

export type SettingsSection = 'admin' | 'api-keys' | 'text-provider' | 'image-provider' | 'web-search-provider' | 'privacy' | 'session'

const SettingSideBar = ({ selectedProvider, setSelectedProvider, presentonSelected = false, className = '' }: { selectedProvider: SettingsSection, setSelectedProvider: (provider: SettingsSection) => void, presentonSelected?: boolean, className?: string }) => {
    const { llm_config } = useSelector((state: RootState) => state.userConfig)
    const textProviderIcon = LLM_PROVIDERS[llm_config.LLM as keyof typeof LLM_PROVIDERS]?.icon
    const imageProviderIcon = IMAGE_PROVIDERS[llm_config.IMAGE_PROVIDER as keyof typeof IMAGE_PROVIDERS]?.icon || '/providers/pexel.png'
    return (
        <div className={`w-full max-w-[230px] h-screen px-3 pt-[22px] bg-[#F9FAFB] dark:bg-[#121216] border-r border-[#E1E1E5] dark:border-neutral-800 flex flex-col transition-colors ${className}`}>
            <p className='text-xs text-neutral-800 dark:text-neutral-300 font-medium border-b mt-[3.15rem] border-[#E1E1E5] dark:border-neutral-800 pb-3.5'>ADMIN CONSOLE:</p>
            <div className='mt-6 flex-1 overflow-y-auto'>
                <p className='text-[#3A3A3A] dark:text-neutral-400 text-xs font-medium pb-2.5'>Administration</p>
                <div className='space-y-2.5 mb-6'>
                    <button
                        className={`w-full rounded-[6px] p-3 py-3.5 flex items-center gap-2 border transition-colors ${selectedProvider === 'admin' ? 'bg-[#F4F3FF] dark:bg-[#1f1a3a] border-[#D9D6FE] dark:border-[#3478F6]' : 'bg-white dark:bg-[#18181c] border-[#EDEEEF] dark:border-neutral-800'}`}
                        onClick={() => setSelectedProvider('admin')}
                    >
                        <div className='relative w-6 h-6 rounded-full overflow-hidden border border-[#EDEEEF] dark:border-neutral-700 flex items-center justify-center bg-white dark:bg-neutral-800'>
                            <ShieldCheck className='w-3.5 h-3.5 text-[#3478F6] dark:text-[#3478F6]' />
                        </div>
                        <p className='text-[#191919] dark:text-neutral-200 text-xs font-semibold'>Administration</p>
                    </button>
                    <button
                        className={`w-full rounded-[6px] p-3 py-3.5 flex items-center gap-2 border transition-colors ${selectedProvider === 'api-keys' ? 'bg-[#F4F3FF] dark:bg-[#1f1a3a] border-[#D9D6FE] dark:border-[#3478F6]' : 'bg-white dark:bg-[#18181c] border-[#EDEEEF] dark:border-neutral-800'}`}
                        onClick={() => setSelectedProvider('api-keys')}
                    >
                        <div className='relative w-6 h-6 rounded-full overflow-hidden border border-[#EDEEEF] dark:border-neutral-700 flex items-center justify-center bg-white dark:bg-neutral-800'>
                            <KeyRound className='w-3.5 h-3.5 text-[#3478F6] dark:text-[#3478F6]' />
                        </div>
                        <p className='text-[#191919] dark:text-neutral-200 text-xs font-semibold'>API Key Pool</p>
                    </button>
                </div>

                <p className='text-[#3A3A3A] dark:text-neutral-400 text-xs font-medium pb-2.5'>AI Providers</p>
                <div className='space-y-2.5'>
                    <button className={`w-full rounded-[6px] px-3 py-3.5 flex items-center gap-2 border transition-colors ${selectedProvider === 'text-provider' ? 'bg-[#F4F3FF] dark:bg-[#1f1a3a] border-[#D9D6FE] dark:border-[#3478F6]' : 'bg-white dark:bg-[#18181c] border-[#EDEEEF] dark:border-neutral-800'}`} onClick={() => setSelectedProvider('text-provider')}>
                        <div className='relative w-[20px] h-[20px] rounded-full overflow-hidden border border-[#EDEEEF] dark:border-neutral-700'>
                            <img src={textProviderIcon} className='object-cover w-full h-full overflow-hidden' alt='text provider' />
                        </div>
                        <p className='text-[#191919] dark:text-neutral-200 text-xs font-medium'>Text Provider</p>
                    </button>
                    {!presentonSelected ? (
                        <>
                            <button className={`w-full rounded-[6px] px-3 py-3.5 flex items-center gap-2 border transition-colors ${selectedProvider === 'image-provider' ? 'bg-[#F4F3FF] dark:bg-[#1f1a3a] border-[#D9D6FE] dark:border-[#3478F6]' : 'bg-white dark:bg-[#18181c] border-[#EDEEEF] dark:border-neutral-800'}`} onClick={() => setSelectedProvider('image-provider')}>
                                <div className='relative w-[20px] h-[20px] rounded-full overflow-hidden border border-[#EDEEEF] dark:border-neutral-700'>
                                    <img src={imageProviderIcon} className='object-cover w-full h-full overflow-hidden' alt='image provider' />
                                </div>
                                <p className='text-[#191919] dark:text-neutral-200 text-xs font-medium'>Image Provider</p>
                            </button>
                            <button className={`w-full rounded-[6px] px-3 py-3.5 flex items-center gap-2 border transition-colors ${selectedProvider === 'web-search-provider' ? 'bg-[#F4F3FF] dark:bg-[#1f1a3a] border-[#D9D6FE] dark:border-[#3478F6]' : 'bg-white dark:bg-[#18181c] border-[#EDEEEF] dark:border-neutral-800'}`} onClick={() => setSelectedProvider('web-search-provider')}>
                                <div className='relative w-[20px] h-[20px] rounded-full overflow-hidden border border-[#EDEEEF] dark:border-neutral-700 flex items-center justify-center bg-white dark:bg-neutral-800'>
                                    <Search className='w-3 h-3 text-[#3478F6] dark:text-[#3478F6]' />
                                </div>
                                <p className='text-[#191919] dark:text-neutral-200 text-xs font-medium'>Web Search Provider</p>
                            </button>
                        </>
                    ) : null}
                </div>
            </div>

            <div className='border-t border-[#E1E1E5] dark:border-neutral-800 py-5 relative z-50'>
                <p className='text-[#3A3A3A] dark:text-neutral-400 text-xs font-medium pb-2.5'>System</p>
                <div className='space-y-2.5'>
                    <button
                        className={`w-full rounded-[6px] p-3 py-3.5 flex items-center gap-2 border transition-colors ${selectedProvider === 'privacy' ? 'bg-[#F4F3FF] dark:bg-[#1f1a3a] border-[#D9D6FE] dark:border-[#3478F6]' : 'bg-white dark:bg-[#18181c] border-[#EDEEEF] dark:border-neutral-800'}`}
                        onClick={() => setSelectedProvider('privacy')}
                    >
                        <div className='relative w-6 h-6 rounded-full overflow-hidden border border-[#EDEEEF] dark:border-neutral-700 flex items-center justify-center bg-white dark:bg-neutral-800'>
                            <Shield className='w-3.5 h-3.5 text-[#3478F6] dark:text-[#3478F6]' />
                        </div>
                        <p className='text-[#191919] dark:text-neutral-200 text-xs font-medium'>Usage Analytics</p>
                    </button>
                    <button
                        className={`w-full rounded-[6px] p-3 py-3.5 flex items-center gap-2 border transition-colors ${selectedProvider === 'session' ? 'bg-[#F4F3FF] dark:bg-[#1f1a3a] border-[#D9D6FE] dark:border-[#3478F6]' : 'bg-white dark:bg-[#18181c] border-[#EDEEEF] dark:border-neutral-800'}`}
                        onClick={() => setSelectedProvider('session')}
                    >
                        <div className='relative w-6 h-6 rounded-full overflow-hidden border border-[#EDEEEF] dark:border-neutral-700 flex items-center justify-center bg-white dark:bg-neutral-800'>
                            <LogOut className='w-3.5 h-3.5 text-[#3478F6] dark:text-[#3478F6]' />
                        </div>
                        <p className='text-[#191919] dark:text-neutral-200 text-xs font-medium'>Sign out</p>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default SettingSideBar
