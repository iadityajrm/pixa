import { DEFAULT_OPENAI_IMAGE_PROVIDER } from "@/utils/providerConstants";
import { LLMConfig } from "@/types/llm_config";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserConfigState {
  role: "admin" | "user" | null;
  credits: number;
  free_presentation_used: boolean;
  has_purchased_credits: boolean;
  llm_config: LLMConfig;
}

const initialState: UserConfigState = {
  llm_config: {
    LLM: "",
    IMAGE_PROVIDER: DEFAULT_OPENAI_IMAGE_PROVIDER,
    GPT_IMAGE_2_5_QUALITY: "medium",

  },
  role: null,
  credits: 0,
  free_presentation_used: false,
  has_purchased_credits: false,
}

const userConfigSlice = createSlice({
  name: "userConfig",
  initialState: initialState,
  reducers: {
    setLLMConfig: (state, action: PayloadAction<LLMConfig>) => {
      state.llm_config = action.payload;
    },
    setUserRole: (state, action: PayloadAction<UserConfigState["role"]>) => {
      state.role = action.payload;
    },
    setUserCredits: (state, action: PayloadAction<number>) => {
      state.credits = action.payload;
    },
    setCreditStatus: (
      state,
      action: PayloadAction<{
        credits?: number;
        free_presentation_used?: boolean;
        has_purchased_credits?: boolean;
      }>
    ) => {
      if (action.payload.credits !== undefined) {
        state.credits = action.payload.credits;
      }
      if (action.payload.free_presentation_used !== undefined) {
        state.free_presentation_used = action.payload.free_presentation_used;
      }
      if (action.payload.has_purchased_credits !== undefined) {
        state.has_purchased_credits = action.payload.has_purchased_credits;
      }
    },
  },
});

export const { setLLMConfig, setUserRole, setUserCredits, setCreditStatus } =
  userConfigSlice.actions;
export default userConfigSlice.reducer;
