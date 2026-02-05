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
  const typingTimeoutRef = useRef(null);
  const { sendMessage, replyingTo, setReplyingTo, isSending, isSendingAudio } =
    useChatStore();
  const { socket } = useAuthStore(); // Get socket
  const { selectedUser, onInputTyping } = useChatStore();
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
    <div className="p-4 w-full bg-base-100 border-t border-zinc-700">
      {/* WhatsApp-style REPLY BOX */}
      {replyingTo && (
        <div className="mb-3 p-3 bg-zinc-200 rounded-lg flex items-center justify-between border-l-4 border-blue-500 shadow-sm">
          <div className="flex-1 text-sm text-zinc-700 truncate">
            Replying to:{" "}
            <span className="font-medium text-black">
              {replyingTo.text ||
                (replyingTo.image && "Image") ||
                (replyingTo.audio && "Audio")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-full hover:bg-zinc-300">
            <X size={16} />
          </button>
        </div>
      )}

      {/* IMAGE PREVIEW */}
      {imagePreview && (
        <div className="mb-3 flex items-center gap-3">
          <div className="relative">
            <img
              src={imagePreview}
              className="w-24 h-24 rounded-lg object-cover border border-zinc-600 shadow"
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

      {/* INPUT ROW */}
      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        {/* INPUT BOX */}
        <div className="flex-1 relative flex items-center gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-xl input-sm sm:input-md bg-base-200"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onInputTyping();
            }}
          />

          {/* Emoji Button */}
          <button
            type="button"
            onClick={() => setShowEmoji(!showEmoji)}
            className="btn btn-circle btn-ghost hidden sm:flex">
            😊
          </button>

          {/* Emoji Picker */}
          {showEmoji && (
            <div ref={emojiRef} className="absolute bottom-14 left-0 z-50">
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </div>
          )}

          {/* Image Button */}
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
            className="btn btn-circle btn-ghost hidden sm:flex">
            <Image size={20} />
          </button>
        </div>

        {/* RECORD BUTTON */}
        <button
          type="button"
          className={`btn btn-circle ${
            isRecording ? "bg-red-500 text-white" : "bg-base-200"
          }`}
          disabled={isSendingAudio}
          onClick={isRecording ? stopRecording : startRecording}>
          {isSendingAudio ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Mic size={22} />
          )}
        </button>

        {/* SEND BUTTON */}
        <button
          type="submit"
          className="btn btn-circle btn-primary"
          disabled={isSending || (!text.trim() && !imagePreview)}>
          {isSending ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Send size={22} />
          )}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
