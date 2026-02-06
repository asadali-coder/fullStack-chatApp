import { X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { formatMessageTime } from "../lib/utils";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, isTyping } =
    useChatStore();
  const { onlineUsers } = useAuthStore();
  // Safety check: Ensure onlineUsers is an array before checking includes
  const isOnline = onlineUsers && onlineUsers.includes(selectedUser._id);

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img
                src={selectedUser.profilePicture || "/avatar.png"}
                alt={selectedUser.fullName}
              />
            </div>
          </div>

          {/* User Status Info */}
          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>

            {isTyping ? (
              <span className="text-primary font-semibold animate-pulse">
                Typing...
              </span>
            ) : isOnline ? (
              <span className="text-green-500 font-medium">Online</span>
            ) : (
              <span className="text-zinc-500">
                {selectedUser?.lastSeen
                  ? `Last seen ${formatMessageTime(selectedUser.lastSeen)}`
                  : "Offline"}
              </span>
            )}
          </div>
        </div>

        {/* Close button */}
        <button className="cursor-pointer" onClick={() => setSelectedUser(null)}>
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
};
export default ChatHeader;
