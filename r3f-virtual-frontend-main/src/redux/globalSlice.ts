import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Type definitions
interface User {
  id: string | null;
  name: string;
  email: string;
  avatar: string;
  isLoggedIn: boolean;
  token: string;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  facialExpression: string;
  animation: string;
}

interface ChatState {
  messages: ChatMessage[];
  currentText: string;
  facialExpression: string;
  animation: string;
  isSpeaking: boolean;
}

interface VoiceSettings {
  ttsProvider: string;
  sttProvider: string;
  volume: number;
  speed: number;
}

interface AudioChunk {
  seq: number;
  data: string; // base64-encoded audio
}

interface AudioResponseState {
  chunks: AudioChunk[];
  isStreaming: boolean;
  totalChunks: number | null;
}

interface VoiceState {
  isRecording: boolean;
  voiceSettings: VoiceSettings;
  audioResponse: AudioResponseState;
}

interface ProfileState {
  bio: string;
  preferences: Record<string, any>;
}

interface UIState {
  authModalOpen: boolean;
  historyModalOpen: boolean;
  profileModalOpen: boolean;
  loading: boolean;
}

interface SettingsState {
  theme: "light" | "dark";
  language: string;
}

interface GlobalState {
  user: User;
  chat: ChatState;
  voice: VoiceState;
  profile: ProfileState;
  ui: UIState;
  settings: SettingsState;
}

const initialState: GlobalState = {
  // User/Auth State
  user: {
    id: null,
    name: "",
    email: "",
    avatar: "",
    isLoggedIn: false,
    token: "",
  },
  // Chat State
  chat: {
    messages: [],
    currentText: "",
    facialExpression: "",
    animation: "",
    isSpeaking: false,
  },
  // Voice State
  voice: {
    isRecording: false,
    voiceSettings: {
      ttsProvider: "default",
      sttProvider: "default",
      volume: 1.0,
      speed: 1.0,
    },
    audioResponse: {
      chunks: [],
      isStreaming: false,
      totalChunks: null,
    },
  },
  // Profile State
  profile: {
    bio: "",
    preferences: {},
  },
  // UI State
  ui: {
    authModalOpen: false,
    historyModalOpen: false,
    profileModalOpen: false,
    loading: false,
  },
  // App Settings
  settings: {
    theme: "light",
    language: "en",
  },
};

const globalSlice = createSlice({
  name: "global",
  initialState,
  reducers: {
    // User/Auth Reducers
    setUser: (state, action: PayloadAction<Partial<User>>) => {
      state.user = { ...state.user, ...action.payload };
    },
    logout: (state) => {
      state.user = initialState.user;
    },
    // Chat Reducers
    setChatMessages: (state, action: PayloadAction<ChatMessage[]>) => {
      state.chat.messages = action.payload;
    },
    addChatMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.chat.messages.push(action.payload);
    },
    setCurrentChat: (
      state,
      action: PayloadAction<{
        text: string;
        facialExpression: string;
        animation: string;
      }>
    ) => {
      state.chat.currentText = action.payload.text;
      state.chat.facialExpression = action.payload.facialExpression;
      state.chat.animation = action.payload.animation;
    },
    setIsSpeaking: (state, action: PayloadAction<boolean>) => {
      state.chat.isSpeaking = action.payload;
    },
    // Voice Reducers
    setRecording: (state, action: PayloadAction<boolean>) => {
      state.voice.isRecording = action.payload;
    },
    updateVoiceSettings: (state, action: PayloadAction<Partial<VoiceSettings>>) => {
      state.voice.voiceSettings = { ...state.voice.voiceSettings, ...action.payload };
    },
    enqueueAudioChunk: (state, action: PayloadAction<AudioChunk>) => {
      state.voice.audioResponse.chunks.push(action.payload);
      state.voice.audioResponse.isStreaming = true;
    },
    clearAudioChunks: (state) => {
      state.voice.audioResponse.chunks = [];
      state.voice.audioResponse.isStreaming = false;
      state.voice.audioResponse.totalChunks = null;
    },
    setAudioResponseMeta: (state, action: PayloadAction<{ isStreaming?: boolean; totalChunks?: number | null }>) => {
      if (action.payload.isStreaming !== undefined)
        state.voice.audioResponse.isStreaming = action.payload.isStreaming;
      if (action.payload.totalChunks !== undefined)
        state.voice.audioResponse.totalChunks = action.payload.totalChunks;
    },
    // Profile Reducers
    setProfile: (state, action: PayloadAction<Partial<ProfileState>>) => {
      state.profile = { ...state.profile, ...action.payload };
    },
    // UI Reducers
    setModalOpen: (
      state,
      action: PayloadAction<{
        modal: keyof UIState;
        open: boolean;
      }>
    ) => {
      const { modal, open } = action.payload;
      state.ui[modal] = open as never;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.ui.loading = action.payload;
    },
    // Settings Reducers
    setTheme: (state, action: PayloadAction<"light" | "dark">) => {
      state.settings.theme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.settings.language = action.payload;
    },
  },
});

export const {
  setUser,
  logout,
  setChatMessages,
  addChatMessage,
  setCurrentChat,
  setIsSpeaking,
  setRecording,
  updateVoiceSettings,
  enqueueAudioChunk,
  clearAudioChunks,
  setAudioResponseMeta,
  setProfile,
  setModalOpen,
  setLoading,
  setTheme,
  setLanguage,
} = globalSlice.actions;

export default globalSlice.reducer;
export type { GlobalState, User, ChatState, VoiceState, ProfileState, UIState, SettingsState, ChatMessage, VoiceSettings, AudioChunk, AudioResponseState };
