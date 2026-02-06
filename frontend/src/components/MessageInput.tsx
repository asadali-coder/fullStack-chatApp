import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X, Mic, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import EmojiPicker from "emoji-picker-react";
import { useAuthStore } from "../store/useAuthStore";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const emojiRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { authUser } = useAuthStore() as any;
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const {
    sendMessage,
    replyingTo,
    setReplyingTo,
    isSending,
    isSendingAudio,
    selectedUser,
    onInputTyping,
    shouldFocusInput,
  } = useChatStore();
  useEffect(() => {
    setTimeout(() => textInputRef.current?.focus(), 0);
  }, [shouldFocusInput, selectedUser?._id]);

  // EMOJI BOX
  useEffect(() => {
    const closeEmoji = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };

    document.addEventListener("mousedown", closeEmoji);
    return () => document.removeEventListener("mousedown", closeEmoji);
  }, []);

  const handleEmojiClick = (emojiData: any) => {
    setText((prev) => prev + emojiData.emoji);
  };

  // IMAGE UPLOAD
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  //  AUDIO RECORD
  const getAudioDuration = (blob: any) =>
    new Promise((resolve) => {
      const audio = document.createElement("audio");
      audio.src = URL.createObjectURL(blob);
      audio.onloadedmetadata = () => resolve(audio.duration);
    });

  const startRecording = async () => {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) =>
        audioChunksRef.current.push(e.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, {
          type: "audio/ogg; codecs=opus",
        });

        const duration = await getAudioDuration(blob);

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio: any = reader.result;
          const clean = base64Audio.split(",")[1];

          await sendMessage({
            audio: clean,
            audioDuration: duration,
            replyTo: replyingTo?._id,
          });

          setReplyingTo(null);
        };

        reader.readAsDataURL(blob);
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);

      setTimeout(() => {
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
      }, 10000);
    } catch (err) {
      toast.error("Microphone permission denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  //SEND MSG
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;

    await sendMessage({
      text: text.trim(),
      image: imagePreview,
      replyTo: replyingTo?._id,
    });

    setText("");
    setImagePreview(null);
    setReplyingTo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  return (
    <div className="w-full bg-base-100 border-t border-zinc-700 p-2 sm:p-4">
      {/* Reply preview */}
      {replyingTo && (
        <div className="mb-2 sm:mb-3 flex items-center justify-between bg-zinc-800 px-3 sm:px-4 py-2 rounded-lg border-l-4 border-blue-500 shadow">
          <div className="flex flex-col text-sm overflow-hidden">
            <span className="text-blue-400 font-medium text-xs">
              Replying to{" "}
              {replyingTo.senderId === authUser._id
                ? "You"
                : selectedUser.fullName}
            </span>

            <span className="text-zinc-300 truncate max-w-[240px] sm:max-w-[380px]">
              {replyingTo.text ||
                (replyingTo.image && "📷 Photo") ||
                (replyingTo.audio && "🎵 Audio")}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="ml-2 sm:ml-3 p-2 sm:p-1 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="mb-2 sm:mb-3">
          <div className="relative inline-block">
            <img
              src={imagePreview}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover border border-zinc-600 shadow"
            />
            <button
              onClick={removeImage}
              type="button"
              className="absolute -top-2 -right-2 bg-zinc-700 text-white w-6 h-6 rounded-full flex items-center justify-center shadow">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Input row */}
      <form onSubmit={handleSendMessage} className="flex items-end gap-2">
        {/* Left actions */}
        <div className="flex items-center gap-1">
          {/* Emoji */}
          <button
            type="button"
            onClick={() => setShowEmoji(!showEmoji)}
            className="btn btn-ghost btn-circle btn-sm sm:btn-md">
            😊
          </button>

          {/* Image */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-ghost btn-circle btn-sm sm:btn-md">
            <Image size={18} />
          </button>
        </div>

        {/* Text input */}
        <div className="relative flex-1">
          {/* Emoji picker */}
          {showEmoji && (
            <div ref={emojiRef} className="absolute bottom-14 left-0 z-50">
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </div>
          )}

          <input
            type="text"
            ref={textInputRef}
            className="w-full input input-bordered rounded-xl bg-base-200 input-md"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onInputTyping();
            }}
          />
        </div>

        {/* Record */}
        <button
          type="button"
          className={`btn btn-circle btn-sm sm:btn-md ${
            isRecording ? "bg-red-500 text-white" : "bg-base-200"
          }`}
          disabled={isSendingAudio}
          onClick={isRecording ? stopRecording : startRecording}>
          {isSendingAudio ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Mic size={20} />
          )}
        </button>

        {/* Send */}
        <button
          type="submit"
          className="btn btn-circle btn-primary btn-sm sm:btn-md"
          disabled={isSending || (!text.trim() && !imagePreview)}>
          {isSending ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Send size={20} />
          )}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
