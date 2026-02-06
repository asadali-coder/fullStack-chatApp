import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef } from "react";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import MessageInput from "./MessageInput";
import ChatHeader from "./ChatHeader";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore() as any;

  const { authUser } = useAuthStore() as any;
  const messageEndRef = useRef(null);
  // Scroll to bottom when messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch messages and subscribe to new messages
  useEffect(() => {
    getMessages(selectedUser._id);
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [
    selectedUser._id,
    getMessages,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);
  const jumpToMessage = (id: any) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("msg-highlight");
    setTimeout(() => el.classList.remove("msg-highlight"), 1200);
  };
  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages?.map((message: any) => (
          <div
            key={message._id}
            id={`msg-${message._id}`}
            className={`chat ${
              message.senderId === authUser._id ? "chat-end" : "chat-start"
            }`}
            ref={messageEndRef}>
            <div className="chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={
                    message.senderId === authUser._id
                      ? authUser.profilePicture || "/avatar.png"
                      : selectedUser.profilePicture || "/avatar.png"
                  }
                  alt="profile pic"
                />
              </div>
            </div>

            <div className="chat-header mb-1">
              <time className="text-xs opacity-50 ml-1">
                {formatMessageTime(message.createdAt)}
              </time>
            </div>

            <div className="chat-bubble flex flex-col relative group">
              {/* REPLY PREVIEW */}
              {message.replyTo && (
                <div
                  onClick={() => jumpToMessage(message.replyTo._id)}
                  className="mb-1 px-3 py-2 rounded-md bg-zinc-800/80 border-l-4 border-blue-500 cursor-pointer hover:bg-zinc-800 transition">
                  <p className="text-xs text-blue-400 font-medium mb-0.5">
                    Replying to{" "}
                    {message.replyTo.senderId === authUser._id
                      ? "You"
                      : selectedUser.fullName}
                  </p>

                  <p className="text-sm text-zinc-300 truncate">
                    {message.replyTo.text ||
                      (message.replyTo.image && "📷 Photo") ||
                      (message.replyTo.audio && "🎵 Audio")}
                  </p>
                </div>
              )}

              {/* IMAGE MESSAGE */}
              {message.image && (
                <img
                  src={message.image}
                  alt="Attachment"
                  className="sm:max-w-[200px] rounded-md mb-2"
                />
              )}

              {/* AUDIO MESSAGE */}
              {message.audio && (
                <div className="flex items-center gap-3 bg-black/20 px-3 py-2 rounded-lg mb-1">
                  <audio controls className="w-40">
                    <source src={message.audio} type="audio/ogg" />
                    Your browser does not support audio playback.
                  </audio>
                  {message.audioDuration && (
                    <span className="text-xs opacity-70">
                      {Math.round(message.audioDuration)}s
                    </span>
                  )}
                </div>
              )}

              {/* TEXT MESSAGE */}
              {message.text && <p>{message.text}</p>}

              {/* REPLY BUTTON */}
              <button
                className="text-xs text-blue-600 mt-1 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                onClick={() => useChatStore.getState().setReplyingTo(message)}>
                Reply
              </button>
            </div>
          </div>
        ))}

        <div ref={messageEndRef} />
      </div>

      <MessageInput />
    </div>
  );
};

export default ChatContainer;
