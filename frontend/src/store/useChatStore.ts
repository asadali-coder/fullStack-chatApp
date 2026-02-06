import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { soundManager } from "../lib/soundManager";
import showNotification, { shouldNotifyInBackground } from "../lib/sharedMethod";

export const useChatStore = create((set, get): any => ({
    messages: [],
    users: [],
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    replyingTo: null,
    isSending: false,
    isSendingAudio: false,
    isTyping: false,
    chatHandlers: {
        onNewMessage: null,
        onTyping: null,
        onStopTyping: null,
    },
    typingTimeoutId: null,
    shouldFocusInput: 0,
    requestFocusInput: () => set((s: any) => ({ shouldFocusInput: s.shouldFocusInput + 1 })),

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

    sendMessage: async (messageData: any) => {
        const { selectedUser, messages, replyingTo, users } = get();
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
            get().emitStopTyping();
            const userIndex = users.findIndex((u) => u._id === selectedUser._id);
            if (userIndex !== -1) {
                const updatedUsers = [...users];
                const [movedUser] = updatedUsers.splice(userIndex, 1);

                // Update their last message for the preview text
                movedUser.lastMessage = res.data;

                // Add to top
                updatedUsers.unshift(movedUser);

                set({ users: updatedUsers });
            }
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                error?.message ||
                "Failed to send message";
            toast.error(message);
        } finally {
            set({ isSending: false, isSendingAudio: false });
        }
    },
    setIsSending: (val: boolean) => set({ isSending: val }),
    setReplyingTo: (message: any) => set((s: any) => ({
        replyingTo: message,
        shouldFocusInput: s.shouldFocusInput + 1,
    })),

    setIsSendingAudio: (val: boolean) => set({ isSendingAudio: val }),

    subscribeToMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        const onNewMessage = (newMessage) => {
            const selectedUser = get().selectedUser;
            if (selectedUser && newMessage.senderId === selectedUser._id) {
                set({ messages: [...get().messages, newMessage] });
            }
        };

        const onTyping = (payload: any) => {
            const senderId = typeof payload === "string" ? payload : payload?.senderId;
            if (senderId === get().selectedUser?._id) set({ isTyping: true });
        };

        const onStopTyping = (payload: any) => {
            const senderId = typeof payload === "string" ? payload : payload?.senderId;
            if (senderId === get().selectedUser?._id) set({ isTyping: false });
        };

        set({
            chatHandlers: { onNewMessage, onTyping, onStopTyping },
        });

        socket.on("newMessage", onNewMessage);
        socket.on("typing", onTyping);
        socket.on("stopTyping", onStopTyping);
    },
    unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        const { onNewMessage, onTyping, onStopTyping } = get().chatHandlers || {};

        if (onNewMessage) socket.off("newMessage", onNewMessage);
        if (onTyping) socket.off("typing", onTyping);
        if (onStopTyping) socket.off("stopTyping", onStopTyping);

        set({ chatHandlers: { onNewMessage: null, onTyping: null, onStopTyping: null } });
    },


    handleConversationUpdated: async ({ userId, lastMessage }) => {
        const { users, selectedUser } = get();
        const authUser = useAuthStore.getState().authUser;

        const isChatOpen = selectedUser?._id === userId;

        // if sender is me, don't count unread / don't play sound
        const isMine =
            String(lastMessage?.senderId) === String(authUser?._id);

        const idx = users.findIndex((u) => u._id === userId);

        if (idx !== -1) {
            const updated = [...users];
            const [u] = updated.splice(idx, 1);

            u.lastMessage = lastMessage;


            u.unreadCount = (isChatOpen || isMine) ? 0 : (u.unreadCount || 0) + 1;

            updated.unshift(u);
            set({ users: updated });

            if (!isMine && !isChatOpen && shouldNotifyInBackground()) {
                soundManager.playNotify();
                showNotification("New message", lastMessage.text ?? "New message received");
            }
            return;
        }

        //  New conversation user not in sidebar → refetch list
        try {
            const res = await axiosInstance.get("/messages/users");

            const refreshed = res.data.map((u) =>
                u._id === userId
                    ? {
                        ...u,
                        lastMessage,
                        unreadCount: (isMine || isChatOpen) ? 0 : 1,
                    }
                    : u
            );

            set({ users: refreshed });


            if (!isMine && !isChatOpen && shouldNotifyInBackground()) {
                soundManager.playNotify();
                showNotification("New message", lastMessage.text ?? "New message received");
            }
        } catch { }
    },
    emitTyping: () => {
        const socket = useAuthStore.getState().socket;
        const { selectedUser } = get();
        const authUser = useAuthStore.getState().authUser;

        if (!socket || !selectedUser || !authUser) return;

        socket.emit("typing", {
            receiverId: selectedUser._id,
            senderId: authUser._id,
        });
    },

    emitStopTyping: () => {
        const socket = useAuthStore.getState().socket;
        const { selectedUser } = get();
        const authUser = useAuthStore.getState().authUser;

        if (!socket || !selectedUser || !authUser) return;

        socket.emit("stopTyping", {
            receiverId: selectedUser._id,
            senderId: authUser._id,
        });
    },

    onInputTyping: () => {
        const { typingTimeoutId, emitTyping, emitStopTyping } = get();

        // start typing
        emitTyping();

        // debounce stopTyping
        if (typingTimeoutId) clearTimeout(typingTimeoutId);

        const id = setTimeout(() => {
            emitStopTyping();
            set({ typingTimeoutId: null });
        }, 900);

        set({ typingTimeoutId: id });
    },

    setSelectedUser: (selectedUser: any) =>
        set((state: any) => ({
            selectedUser,
            shouldFocusInput: (state.shouldFocusInput || 0) + 1,
            isTyping: false,
            users: state.users.map((u) =>
                u._id === selectedUser?._id ? { ...u, unreadCount: 0 } : u
            ),
        })),

}));
