import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get): any => ({
    messages: [],
    users: [],
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    replyingTo: null,
    isSending: false,
    isSendingAudio: false,

    getUsers: async () => {
        set({ isUsersLoading: true });
        try {
            const res = await axiosInstance.get("/messages/users");
            set({ users: res.data });
        } catch (error: any) {
            toast.error(error?.response?.data?.message ?? "Failed to load users");
        } finally {
            set({ isUsersLoading: false });
        }
    },

    getMessages: async (userId: any) => {
        set({ isMessagesLoading: true });
        try {
            const res = await axiosInstance.get(`/messages/${userId}`);
            set({ messages: res.data || [] });
        } catch (error: any) {
            toast.error(error?.response?.data?.message ?? "Failed to load messages");
        } finally {
            set({ isMessagesLoading: false });
        }
    },

    // sendMessage: async (messageData: any) => {
    //     const { selectedUser, messages } = get();
    //     try {
    //         const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
    //         set({ messages: [...messages, res.data] });
    //     } catch (error: any) {
    //         const message =
    //             error?.response?.data?.message ||
    //             error?.message ||
    //             "Failed to send message";
    //         toast.error(message);
    //     }

    // },


    sendMessage: async (messageData: any) => {
        const { selectedUser, messages, replyingTo } = get();
        const isAudio = !!messageData.audio;

        if (isAudio) {
            set({ isSendingAudio: true });
        } else {
            set({ isSending: true });
        }
        try {
            const dataToSend = {
                ...messageData,
                replyTo: replyingTo?._id || null,
            };

            const res = await axiosInstance.post(
                `/messages/send/${selectedUser._id}`,
                dataToSend
            );

            set({
                messages: [...messages, res.data],
                replyingTo: null, // reset after sending
            });
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                error?.message ||
                "Failed to send message";
            toast.error(message);
        } finally {
            set({ isSending: false });
        }
    },
    setIsSending: (val: boolean) => set({ isSending: val }),
    setReplyingTo: (message: any) => set({ replyingTo: message }),

    setIsSendingAudio: (val: boolean) => set({ isSendingAudio: val }),

    subscribeToMessages: () => {
        const { selectedUser } = get();
        if (!selectedUser) return;

        const socket = useAuthStore.getState().socket;

        socket.on("newMessage", (newMessage: any) => {
            const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
            if (!isMessageSentFromSelectedUser) return;

            set({
                messages: [...get().messages, newMessage],
            });
        });
    },

    unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        socket.off("newMessage");
    },

    setSelectedUser: (selectedUser: any) => set({ selectedUser }),
}));
