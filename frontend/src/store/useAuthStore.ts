import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { useChatStore } from "./useChatStore";
// const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5000/api" : ""

export const useAuthStore = create<any>((set, get) => ({
    authUser: null,
    isSigningUp: false,
    isLoggingIn: false,
    isUpdatingProfile: false,
    isCheckingAuth: true,
    onlineUsers: [],
    socket: null,


    checkAuth: async () => {
        try {
            const res = await axiosInstance.get("/auth/check")
            set({ authUser: res?.data })
            get().connectSocket();
        } catch (error) {
            console.log("error in authCheck ", error)
            set({ authUser: null })
        } finally {
            set({ isCheckingAuth: false })
        }
    },
    signUp: async (data: any) => {
        set({ isSigningUp: true })
        try {
            const res = await axiosInstance.post("/auth/signup", data)
            set({ authUser: res.data })
            toast.success("Account Created Successfully")
            get().connectSocket()
        } catch (error: any) {
            toast.error(error.response.data.message)
        } finally {
            set({ isSigningUp: false })
        }
    },
    login: async (data: any) => {
        set({ isLoggingIn: true })
        try {
            const res = await axiosInstance.post("/auth/login", data)
            set({ authUser: res.data })
            toast.success("Logged in successfully");
            get().connectSocket()
        } catch (error: any) {
            toast.error(error.response.data.message)
        } finally {
            set({ isLoggingIn: false })
        }

    },
    logout: async () => {
        try {
            await axiosInstance.post("/auth/logout")
            set({ authUser: null })
            toast.success("Logged Out successfully")
            get().disconnectSocket()
        } catch (error: any) {
            toast.error(error.response.data.message)
        }
    },
    updateProfile: async (formData: FormData) => {
        set({ isUpdatingProfile: true });
        try {
            const res = await axiosInstance.put("/auth/update-profile", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });
            set({ authUser: res.data });
            toast.success("Profile updated successfully");
        } catch (error: any) {
            console.log("error in update profile:", error);
            toast.error(error.response?.data?.message || "Something went wrong");
        } finally {
            set({ isUpdatingProfile: false });
        }
    },


    connectSocket: () => {
        const { authUser, socket } = get();

        if (!authUser || socket?.connected) return;

        const newSocket = io("http://localhost:5000", {
            auth: {
                userId: authUser._id,
            },
            withCredentials: true,
        });

        newSocket.on("connect", () => {
        });

        newSocket.on("getOnlineUsers", (userIds) => {
            set({ onlineUsers: userIds });
        });

        newSocket.on("connect_error", (err) => {
            console.log("socket error:", err.message);
        });
        newSocket.off("conversationUpdated");
        newSocket.on("conversationUpdated", (payload) => {
            useChatStore.getState().handleConversationUpdated(payload);
        });
       
        set({ socket: newSocket });
    },

    disconnectSocket: () => {
        const socket = get().socket;
        if (socket) {
            socket.disconnect();
            set({ socket: null, onlineUsers: [] });
        }
    }


}))